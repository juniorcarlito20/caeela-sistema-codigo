import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { gerarMatriculaUnica, MENSAGEM_MATRICULA } from '@/domain/matricula'
import {
  campoCpf,
  campoNascimento,
  campoNome,
  campoTextoOpcional,
} from '@/lib/esquemaAluno'

const esquema = z.object({
  nome: campoNome,
  cpf: campoCpf,
  nascimento: campoNascimento,
  escola: campoTextoOpcional,
  serie: campoTextoOpcional,
  responsavel: campoTextoOpcional,
  whatsapp: campoTextoOpcional,
  observacoes: campoTextoOpcional,
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção pode cadastrar alunos.' },
      { status: 403 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados do aluno.' }, { status: 400 })
  }

  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const dados = validado.data

  const ano = new Date().getFullYear()
  const buscarUltima = async () =>
    (
      await prisma.aluno.findFirst({
        where: { matricula: { startsWith: `${ano}-` } },
        orderBy: { matricula: 'desc' },
        select: { matricula: true },
      })
    )?.matricula

  try {
    const criado = await gerarMatriculaUnica(ano, buscarUltima, (matricula) =>
      prisma.aluno.create({ data: { ...dados, matricula, situacao: 'ESPERA' } }),
    )
    await registrarAcesso(sessao.user.id, 'CADASTROU_ALUNO', `${criado.nome} (${criado.matricula})`)
    return NextResponse.json({ id: criado.id, matricula: criado.matricula }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === MENSAGEM_MATRICULA) {
      return NextResponse.json({ erro: MENSAGEM_MATRICULA }, { status: 500 })
    }
    throw e
  }
}
