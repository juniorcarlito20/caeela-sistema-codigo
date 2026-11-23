import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({
  situacao: z.enum(['ALTA', 'PAUSA', 'DESLIGADO'], { message: 'Escolha o motivo: alta, pausa ou desligado.' }),
  pausaRetomarEm: z.string().trim().min(1).nullable().optional(),
})

const ROTULO: Record<string, string> = { ALTA: 'alta', PAUSA: 'pausa', DESLIGADO: 'desligado' }

// Desliga o aluno por inteiro, de uma vez: encerra todos os atendimentos abertos dele (os horários
// saem das agendas) e muda a situação. Só a direção. Nada é apagado: o histórico fica, e cada
// atendimento encerrado guarda o "antes" e pode ser desfeito em "Profissionais anteriores".
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode desligar um aluno.' }, { status: 403 })
  }

  const { id } = await params
  const aluno = await prisma.aluno.findFirst({ where: { id, excluidoEm: null } })
  if (!aluno) return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })

  let corpo: unknown = {}
  try {
    corpo = await req.json()
  } catch {
    corpo = {}
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { situacao, pausaRetomarEm } = validado.data

  if (aluno.situacao === situacao) {
    return NextResponse.json({ erro: `Este aluno já está com a situação "${ROTULO[situacao]}".` }, { status: 400 })
  }
  let retorno: Date | null = null
  if (situacao === 'PAUSA' && pausaRetomarEm) {
    retorno = new Date(`${pausaRetomarEm}T12:00:00`)
    if (Number.isNaN(retorno.getTime())) {
      return NextResponse.json({ erro: 'Confira a data de retorno.' }, { status: 400 })
    }
  }

  const vinculos = await prisma.vinculo.findMany({
    where: { alunoId: id, fim: null },
    select: { id: true },
  })
  const agora = new Date()
  await prisma.$transaction([
    ...vinculos.map((v) =>
      prisma.vinculo.update({
        where: { id: v.id },
        data: {
          fim: agora,
          motivoFim: situacao,
          situacaoAlunoAntes: aluno.situacao,
          situacaoDesdeAntes: aluno.situacaoDesde,
          pausaRetomarEmAntes: aluno.pausaRetomarEm,
        },
      }),
    ),
    prisma.aluno.update({
      where: { id },
      data: { situacao, situacaoDesde: agora, pausaRetomarEm: retorno },
    }),
  ])

  await registrarAcesso(
    sessao.user.id,
    'DESLIGOU_ALUNO',
    `${aluno.nome} (${ROTULO[situacao]}; ${vinculos.length} ${vinculos.length === 1 ? 'atendimento encerrado' : 'atendimentos encerrados'})`,
  )
  return NextResponse.json({ ok: true, encerrados: vinculos.length })
}
