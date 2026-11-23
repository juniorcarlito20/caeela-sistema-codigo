import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno } from '@/lib/registro'
import { podeLancarNoDia, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { isoDia } from '@/domain/diaSemAtendimento'
import { hojeNoFuso } from '@/lib/fuso'

const esquema = z.object({
  atendimentoId: z.string().min(1, 'Atendimento inválido.'),
  atividade: z.string().trim().min(1, 'Descreva a atividade.'),
  objetivo: z.string().trim().min(1, 'Descreva o objetivo.'),
  observacoes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim()
      return t === '' ? null : t
    }),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para escrever a evolução.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie a evolução.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const { atendimentoId, atividade, objetivo, observacoes } = validado.data

  const atendimento = await prisma.atendimento.findUnique({
    where: { id: atendimentoId },
    include: { vinculo: true, evolucao: true },
  })
  if (!atendimento) {
    return NextResponse.json({ erro: 'Atendimento não encontrado.' }, { status: 404 })
  }
  if (atendimento.vinculo.profissionalId !== sessao.user.id) {
    return NextResponse.json(
      { erro: 'Só o profissional do atendimento pode escrever a evolução.' },
      { status: 403 },
    )
  }
  if (!podeLancarNoDia(sessao.user.perfil, isoDia(atendimento.data), hojeNoFuso())) {
    return NextResponse.json({ erro: AVISO_LIMITE_LANCAR }, { status: 403 })
  }
  if (atendimento.situacao !== 'REALIZADO') {
    return NextResponse.json(
      { erro: 'A evolução só pode ser escrita para atendimento realizado.' },
      { status: 400 },
    )
  }
  if (atendimento.evolucao) {
    return NextResponse.json(
      { erro: 'Este atendimento já tem evolução. Edite a existente.' },
      { status: 409 },
    )
  }

  const criada = await prisma.evolucao.create({
    data: {
      atendimentoId,
      autorId: sessao.user.id,
      atividade,
      objetivo,
      observacoes,
    },
  })
  await registrarAcesso(sessao.user.id, 'ESCREVEU_EVOLUCAO', await nomeDoAluno(atendimento.vinculo.alunoId))
  return NextResponse.json({ id: criada.id }, { status: 201 })
}
