import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { normalizarTelefone } from '@/domain/lembrete'
import { registrarAcesso } from '@/lib/registro'
import { soCamposDaSecretaria } from '@/domain/acesso'
import {
  campoCpf,
  campoNascimento,
  campoNome,
  campoTextoOpcional,
} from '@/lib/esquemaAluno'

const esquema = z.object({
  nome: campoNome.optional(),
  cpf: campoCpf,
  nascimento: campoNascimento,
  escola: campoTextoOpcional,
  serie: campoTextoOpcional,
  responsavel: campoTextoOpcional,
  observacoes: campoTextoOpcional,
  whatsapp: campoTextoOpcional.refine((v) => v === null || normalizarTelefone(v) !== null, {
    message: 'Confira o número do WhatsApp.',
  }),
})

const ROTULO_CAMPO: Record<string, string> = {
  nome: 'nome',
  cpf: 'CPF',
  nascimento: 'nascimento',
  escola: 'escola',
  serie: 'série',
  responsavel: 'responsável',
  whatsapp: 'WhatsApp',
  observacoes: 'observações',
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  const perfil = sessao?.user.perfil
  if (!sessao?.user || (perfil !== 'ADMIN' && perfil !== 'SECRETARIA')) {
    return NextResponse.json(
      { erro: 'Só a direção pode alterar a ficha do aluno.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const aluno = await prisma.aluno.findFirst({
    where: { id, excluidoEm: null },
  })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
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

  // Só mexe no que veio no pedido — quem manda só o WhatsApp não apaga o resto.
  const enviados = Object.keys((corpo ?? {}) as Record<string, unknown>)
  // A Secretaria só corrige o WhatsApp do responsável; qualquer outro campo é recusado.
  if (perfil === 'SECRETARIA' && !soCamposDaSecretaria(enviados)) {
    return NextResponse.json({ erro: 'Seu acesso só permite corrigir o WhatsApp do responsável.' }, { status: 403 })
  }
  const dados: Record<string, unknown> = {}
  for (const campo of Object.keys(ROTULO_CAMPO)) {
    if (!enviados.includes(campo)) continue
    const valor = validado.data[campo as keyof typeof validado.data]
    if (campo === 'nome' && valor === undefined) continue
    dados[campo] = valor
  }
  if (Object.keys(dados).length === 0) {
    return NextResponse.json({ erro: 'Nada para alterar.' }, { status: 400 })
  }

  await prisma.aluno.update({ where: { id }, data: dados })
  await registrarAcesso(
    sessao.user.id,
    'EDITOU_ALUNO',
    `${aluno.nome} (${Object.keys(dados).map((c) => ROTULO_CAMPO[c]).join(', ')})`,
  )
  return NextResponse.json({ ok: true })
}
