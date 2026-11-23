import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { ausenciaNoDia } from '@/lib/ausencias'
import { semAtendimentoNoDia } from '@/lib/diasSemAtendimento'
import { PREFIXO_SEM_ATENDIMENTO } from '@/domain/diaSemAtendimento'
import { podeLancarNoDia, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { hojeNoFuso } from '@/lib/fuso'

const esquema = z.object({
  vinculoId: z.string().min(1, 'Vínculo inválido.'),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dia inválido.')
    .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00`).getTime()), {
      message: 'Dia inválido.',
    }),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'),
})

// Garante a linha do atendimento (cria como AGENDADO se ainda não existe).
export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para continuar.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados.' },
      { status: 400 },
    )
  }

  const vinculo = await prisma.vinculo.findUnique({
    where: { id: validado.data.vinculoId },
  })
  if (!vinculo) {
    return NextResponse.json({ erro: 'Vínculo não encontrado.' }, { status: 404 })
  }
  if (
    sessao.user.perfil !== 'ADMIN' &&
    sessao.user.perfil !== 'SECRETARIA' &&
    vinculo.profissionalId !== sessao.user.id
  ) {
    return NextResponse.json({ erro: 'Este atendimento não é seu.' }, { status: 403 })
  }

  // Datas futuras seguem livres (a secretária prepara lembretes); só o passado tem limite.
  if (!podeLancarNoDia(sessao.user.perfil, validado.data.data, hojeNoFuso())) {
    return NextResponse.json({ erro: AVISO_LIMITE_LANCAR }, { status: 403 })
  }

  const atendimento = await prisma.atendimento.upsert({
    where: {
      vinculoId_data_hora: {
        vinculoId: vinculo.id,
        data: new Date(`${validado.data.data}T12:00:00`),
        hora: validado.data.hora,
      },
    },
    update: {},
    create: {
      vinculoId: vinculo.id,
      data: new Date(`${validado.data.data}T12:00:00`),
      hora: validado.data.hora,
    },
  })

  // Nasceu em dia de ausência do profissional ou em dia sem atendimento do centro: já nasce cancelado.
  const falta = await ausenciaNoDia(vinculo.profissionalId, validado.data.data)
  if (falta && atendimento.situacao === 'AGENDADO') {
    await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        situacao: 'CANCELADO',
        observacao: `Profissional ausente: ${falta.tipo}`,
        ausenciaId: falta.id,
      },
    })
  } else if (atendimento.situacao === 'AGENDADO') {
    const motivo = await semAtendimentoNoDia(validado.data.data)
    if (motivo) {
      await prisma.atendimento.update({
        where: { id: atendimento.id },
        data: { situacao: 'CANCELADO', observacao: `${PREFIXO_SEM_ATENDIMENTO}${motivo}` },
      })
    }
  }
  return NextResponse.json({ id: atendimento.id })
}
