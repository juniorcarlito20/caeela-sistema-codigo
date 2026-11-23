import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAlunoDaEvolucao } from '@/lib/registro'
import { podeLancarNoDia, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { isoDia } from '@/domain/diaSemAtendimento'
import { hojeNoFuso } from '@/lib/fuso'

const esquema = z.object({
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para editar a evolução.' }, { status: 401 })
  }

  const { id } = await params
  const evolucao = await prisma.evolucao.findUnique({
    where: { id },
    include: { atendimento: { select: { data: true } } },
  })
  if (!evolucao) {
    return NextResponse.json({ erro: 'Evolução não encontrada.' }, { status: 404 })
  }
  if (evolucao.autorId !== sessao.user.id) {
    return NextResponse.json(
      { erro: 'Só quem escreveu pode editar esta evolução.' },
      { status: 403 },
    )
  }

  if (!podeLancarNoDia(sessao.user.perfil, isoDia(evolucao.atendimento.data), hojeNoFuso())) {
    return NextResponse.json({ erro: AVISO_LIMITE_LANCAR }, { status: 403 })
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

  await prisma.evolucao.update({ where: { id }, data: validado.data })
  await registrarAcesso(sessao.user.id, 'EDITOU_EVOLUCAO', await nomeDoAlunoDaEvolucao(id))
  return NextResponse.json({ ok: true })
}
