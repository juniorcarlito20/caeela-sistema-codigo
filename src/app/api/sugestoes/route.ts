import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerAluno } from '@/domain/permissoes'
import { validarNovaSugestao, rotuloTipo, MSG_TIPO_INVALIDO } from '@/domain/sugestoes'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({
  alunoId: z.string().min(1, 'Aluno inválido.'),
  tipo: z.enum(['PROFISSIONAL_DO_CENTRO', 'EXAME_OU_CONSULTA', 'OUTRA'], {
    message: MSG_TIPO_INVALIDO,
  }),
  areaId: z.string().nullable().optional(),
  texto: z.string(),
})

// O profissional que atende o aluno sugere algo à direção (outro profissional, exame, consulta…).
export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para fazer uma sugestão.' }, { status: 401 })
  }
  if (sessao.user.perfil !== 'PROFISSIONAL') {
    return NextResponse.json({ erro: 'Só profissionais fazem sugestões à direção.' }, { status: 403 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados da sugestão.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { alunoId, tipo, areaId, texto } = validado.data

  const aluno = await prisma.aluno.findFirst({ where: { id: alunoId, excluidoEm: null } })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }
  const vinculos = await prisma.vinculo.findMany({ where: { alunoId }, select: { profissionalId: true, fim: true } })
  if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
    return NextResponse.json({ erro: 'Você não tem vínculo com este aluno.' }, { status: 403 })
  }

  const recusa = validarNovaSugestao({ tipo, areaId, texto })
  if (recusa) return NextResponse.json({ erro: recusa }, { status: 400 })

  let area: { id: string; nome: string } | null = null
  if (tipo === 'PROFISSIONAL_DO_CENTRO') {
    area = await prisma.area.findUnique({ where: { id: areaId! }, select: { id: true, nome: true } })
    if (!area) return NextResponse.json({ erro: 'Área não encontrada.' }, { status: 400 })
  }

  const criada = await prisma.sugestao.create({
    data: {
      alunoId,
      autorId: sessao.user.id,
      tipo,
      areaId: area?.id ?? null,
      texto: texto.trim(),
    },
  })
  // O Histórico guarda quem e sobre quem, nunca o texto (pode ter dado clínico).
  await registrarAcesso(sessao.user.id, 'SUGERIU_ENCAMINHAMENTO', `${aluno.nome}: ${rotuloTipo(tipo, area?.nome)}`)
  return NextResponse.json({ id: criada.id }, { status: 201 })
}
