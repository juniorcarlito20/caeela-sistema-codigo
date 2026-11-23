import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { podeVerAluno } from '@/domain/permissoes'
import { validarRespostas, type Campo } from '@/domain/anamnese'

const esquema = z.object({
  alunoId: z.string().min(1, 'Aluno inválido.'),
  modeloId: z.string().min(1, 'Modelo inválido.'),
  respostas: z.record(z.string(), z.string()),
})

async function buscaCampos(modeloId: string): Promise<Campo[] | null> {
  const modelo = await prisma.modeloAnamnese.findUnique({
    where: { id: modeloId },
    select: { campos: true, ativo: true },
  })
  if (!modelo || !modelo.ativo) return null
  return modelo.campos as unknown as Campo[]
}

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para preencher a anamnese.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie as respostas.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const { alunoId, modeloId, respostas } = validado.data

  const aluno = await prisma.aluno.findFirst({
    where: { id: alunoId, excluidoEm: null },
  })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }
  const campos = await buscaCampos(modeloId)
  if (!campos) {
    return NextResponse.json({ erro: 'Modelo não encontrado.' }, { status: 404 })
  }

  if (sessao.user.perfil !== 'ADMIN') {
    const vinculos = await prisma.vinculo.findMany({
      where: { alunoId },
      select: { profissionalId: true, fim: true },
    })
    if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
      return NextResponse.json(
        { erro: 'Você não tem acesso a este aluno.' },
        { status: 403 },
      )
    }
  }

  const erros = validarRespostas(campos, respostas)
  if (erros.length > 0) {
    return NextResponse.json({ erro: erros[0] }, { status: 400 })
  }

  const criada = await prisma.anamnese.create({
    data: { alunoId, modeloId, autorId: sessao.user.id, respostas },
  })
  await registrarAcesso(sessao.user.id, 'PREENCHEU_ANAMNESE', aluno.nome)
  return NextResponse.json({ id: criada.id }, { status: 201 })
}
