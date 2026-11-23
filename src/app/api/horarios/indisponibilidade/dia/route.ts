import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, quando, nomeDoUsuario } from '@/lib/registro'
import { slotsDoProfissional } from '@/lib/slots'
import { horasDoDia } from '@/domain/grade'

const esquema = z.object({
  profissionalId: z.string().min(1),
  diaSemana: z.number().int().min(1).max(5),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode bloquear o dia.' }, { status: 403 })
  }
  const corpo = await req.json().catch(() => null)
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    )
  }
  const { profissionalId, diaSemana } = validado.data
  const horas = horasDoDia(await slotsDoProfissional(profissionalId), diaSemana)
  await prisma.$transaction(
    horas.map((hora) =>
      prisma.horarioIndisponivel.upsert({
        where: { profissionalId_diaSemana_hora: { profissionalId, diaSemana, hora } },
        create: { profissionalId, diaSemana, hora, criadoPor: sessao.user.id },
        update: {},
      }),
    ),
  )
  await registrarAcesso(sessao.user.id, 'BLOQUEOU_DIA', `${await nomeDoUsuario(profissionalId)} (${quando(diaSemana, '').trim()} inteira)`)
  return NextResponse.json({ ok: true, marcados: horas.length })
}

export async function DELETE(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode liberar o dia.' }, { status: 403 })
  }
  const corpo = await req.json().catch(() => null)
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    )
  }
  const { profissionalId, diaSemana } = validado.data
  await prisma.horarioIndisponivel.deleteMany({ where: { profissionalId, diaSemana } })
  await registrarAcesso(sessao.user.id, 'LIBEROU_DIA', `${await nomeDoUsuario(profissionalId)} (${quando(diaSemana, '').trim()} inteira)`)
  return NextResponse.json({ ok: true })
}
