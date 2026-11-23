import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, quando, nomeDoUsuario } from '@/lib/registro'

const esquema = z.object({
  profissionalId: z.string().min(1),
  diaSemana: z.number().int().min(1).max(5),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode marcar indisponibilidade.' }, { status: 403 })
  }
  const corpo = await req.json().catch(() => null)
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    )
  }
  const { profissionalId, diaSemana, hora } = validado.data
  await prisma.horarioIndisponivel.upsert({
    where: { profissionalId_diaSemana_hora: { profissionalId, diaSemana, hora } },
    create: { profissionalId, diaSemana, hora, criadoPor: sessao.user.id },
    update: {},
  })
  await registrarAcesso(sessao.user.id, 'MARCOU_INDISPONIVEL', `${await nomeDoUsuario(profissionalId)} (${quando(diaSemana, hora)})`)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode liberar um horário.' }, { status: 403 })
  }
  const corpo = await req.json().catch(() => null)
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    )
  }
  const { profissionalId, diaSemana, hora } = validado.data
  await prisma.horarioIndisponivel.deleteMany({ where: { profissionalId, diaSemana, hora } })
  await registrarAcesso(sessao.user.id, 'LIBEROU_HORARIO', `${await nomeDoUsuario(profissionalId)} (${quando(diaSemana, hora)})`)
  return NextResponse.json({ ok: true })
}
