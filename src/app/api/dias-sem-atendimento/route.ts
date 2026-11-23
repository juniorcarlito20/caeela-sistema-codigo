import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { hojeNoFuso } from '@/lib/fuso'
import { PREFIXO_SEM_ATENDIMENTO, dataDoDia, motivoParaNaoMarcar } from '@/domain/diaSemAtendimento'

const esquema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dia inválido.'),
  motivo: z.string().trim().min(3, 'Escreva o motivo (3 letras ou mais).').max(120, 'O motivo tem até 120 letras.'),
})

const podeMarcar = (perfil: string | undefined) => perfil === 'ADMIN' || perfil === 'SECRETARIA'
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function limitesDoDia(iso: string): { inicio: Date; fim: Date } {
  const inicio = new Date(`${iso}T00:00:00`)
  return { inicio, fim: new Date(inicio.getTime() + 86400000) }
}

// Marca um dia como sem atendimento no centro inteiro (feriado, decreto, reunião).
export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user || !podeMarcar(sessao.user.perfil)) {
    return NextResponse.json({ erro: 'Só a direção e a secretaria marcam dia sem atendimento.' }, { status: 403 })
  }
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie o dia e o motivo.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { data: iso, motivo } = validado.data
  const recusa = motivoParaNaoMarcar(iso, hojeNoFuso())
  if (recusa) return NextResponse.json({ erro: recusa }, { status: 400 })

  const data = dataDoDia(iso)
  await prisma.diaSemAtendimento.upsert({
    where: { data },
    update: { motivo },
    create: { data, motivo, criadoPorId: sessao.user.id },
  })
  // O que estava só agendado fica cancelado (ou tem o motivo atualizado). Presença, falta e
  // justificativa já registradas não mudam, nem o que uma ausência de profissional cancelou.
  const { inicio, fim } = limitesDoDia(iso)
  const cancelados = await prisma.atendimento.updateMany({
    where: {
      data: { gte: inicio, lt: fim },
      OR: [
        { situacao: 'AGENDADO' },
        { situacao: 'CANCELADO', ausenciaId: null, observacao: { startsWith: PREFIXO_SEM_ATENDIMENTO } },
      ],
    },
    data: { situacao: 'CANCELADO', observacao: `${PREFIXO_SEM_ATENDIMENTO}${motivo}` },
  })
  await registrarAcesso(sessao.user.id, 'MARCOU_DIA_SEM_ATENDIMENTO', `${ddmm(iso)}: ${motivo}`)
  return NextResponse.json({ ok: true, cancelados: cancelados.count })
}

// Desmarca: o dia volta a ter atendimento normal.
export async function DELETE(req: Request) {
  const sessao = await auth()
  if (!sessao?.user || !podeMarcar(sessao.user.perfil)) {
    return NextResponse.json({ erro: 'Só a direção e a secretaria desmarcam dia sem atendimento.' }, { status: 403 })
  }
  const iso = new URL(req.url).searchParams.get('data') ?? ''
  const recusa = motivoParaNaoMarcar(iso, hojeNoFuso())
  if (recusa) return NextResponse.json({ erro: recusa }, { status: 400 })

  const data = dataDoDia(iso)
  const dia = await prisma.diaSemAtendimento.findUnique({ where: { data } })
  if (!dia) return NextResponse.json({ erro: 'Esse dia não está marcado.' }, { status: 404 })

  await prisma.diaSemAtendimento.delete({ where: { data } })
  // Voltam a agendados só os que este aviso tinha cancelado.
  const { inicio, fim } = limitesDoDia(iso)
  await prisma.atendimento.updateMany({
    where: {
      data: { gte: inicio, lt: fim },
      situacao: 'CANCELADO',
      ausenciaId: null,
      observacao: { startsWith: PREFIXO_SEM_ATENDIMENTO },
    },
    data: { situacao: 'AGENDADO', observacao: null },
  })
  await registrarAcesso(sessao.user.id, 'DESMARCOU_DIA_SEM_ATENDIMENTO', `${ddmm(iso)}: ${dia.motivo}`)
  return NextResponse.json({ ok: true })
}
