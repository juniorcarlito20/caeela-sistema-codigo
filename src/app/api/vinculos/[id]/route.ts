import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({
  situacaoAluno: z.enum(['PAUSA', 'ALTA', 'DESLIGADO']).nullable().optional(),
  pausaRetomarEm: z.string().trim().min(1).nullable().optional(),
})

const ROTULO_SITUACAO: Record<string, string> = {
  PAUSA: 'pausa',
  ALTA: 'alta',
  DESLIGADO: 'desligamento',
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para continuar.' }, { status: 401 })
  }

  const { id } = await params
  const vinculo = await prisma.vinculo.findUnique({ where: { id }, include: { aluno: true } })
  if (!vinculo || vinculo.fim) {
    return NextResponse.json({ erro: 'Vínculo não encontrado.' }, { status: 404 })
  }

  // O profissional responsável também pode encerrar o próprio atendimento —
  // só a direção pode encerrar um vínculo de outro profissional.
  if (sessao.user.perfil !== 'ADMIN' && sessao.user.id !== vinculo.profissionalId) {
    return NextResponse.json(
      { erro: 'Você só pode encerrar atendimentos dos seus próprios alunos.' },
      { status: 403 },
    )
  }

  let corpo: unknown = {}
  try {
    corpo = await req.json()
  } catch {
    corpo = {}
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: 'Escolha uma situação válida.' }, { status: 400 })
  }

  const outrosVigentes = await prisma.vinculo.count({
    where: { alunoId: vinculo.alunoId, fim: null, id: { not: id } },
  })
  if (outrosVigentes === 0 && !validado.data.situacaoAluno) {
    return NextResponse.json(
      {
        erro: 'Escolha a situação do aluno: pausa, alta ou desligado.',
        precisaSituacao: true,
      },
      { status: 400 },
    )
  }

  // motivoFim fica guardado no vínculo sempre que for informado — mesmo quando o
  // aluno continua com outros profissionais, pra dar pra ver depois "pausou com
  // fulano" sem precisar que isso mude a situação geral do aluno.
  // Quando isso muda a situação geral do aluno, guarda o "antes" junto — é o
  // que permite desfazer um clique errado sem precisar recriar o vínculo à mão.
  const mudaSituacaoGeral = outrosVigentes === 0 && !!validado.data.situacaoAluno
  await prisma.vinculo.update({
    where: { id },
    data: {
      fim: new Date(),
      motivoFim: validado.data.situacaoAluno ?? null,
      situacaoAlunoAntes: mudaSituacaoGeral ? vinculo.aluno.situacao : null,
      situacaoDesdeAntes: mudaSituacaoGeral ? vinculo.aluno.situacaoDesde : null,
      pausaRetomarEmAntes: mudaSituacaoGeral ? vinculo.aluno.pausaRetomarEm : null,
    },
  })

  const motivoRotulo = validado.data.situacaoAluno
    ? ROTULO_SITUACAO[validado.data.situacaoAluno]
    : 'encerramento'
  await registrarAcesso(
    sessao.user.id,
    'ENCERROU_ATENDIMENTO',
    `${vinculo.aluno.nome} (${motivoRotulo})`,
  )

  if (mudaSituacaoGeral && validado.data.situacaoAluno) {
    const pausaRetomarEm =
      validado.data.situacaoAluno === 'PAUSA' && validado.data.pausaRetomarEm
        ? new Date(`${validado.data.pausaRetomarEm}T12:00:00`)
        : null
    await prisma.aluno.update({
      where: { id: vinculo.alunoId },
      data: {
        situacao: validado.data.situacaoAluno,
        situacaoDesde: new Date(),
        pausaRetomarEm,
      },
    })
  }
  return NextResponse.json({ ok: true })
}
