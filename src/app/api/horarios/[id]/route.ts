import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, quando } from '@/lib/registro'
import { camposDoHorario } from '@/domain/desfazer'
import { carregarDuracoes, duracaoEfetiva, slotsDoProfissional } from '@/lib/slots'
import { temSlot } from '@/domain/grade'
import { horariosLivres } from '@/domain/conflitos'
import { rotuloSemanas, todasAsSemanas } from '@/domain/semanas'
import { conflitoDaMudanca, horariosVigentes } from '@/lib/agendaVigente'

const esquema = z
  .object({
    diaSemana: z.number().int().min(1).max(5).optional(),
    hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.').optional(),
    semanas: z.number().int().min(0).max(15).optional(),
  })
  .refine((d) => d.diaSemana !== undefined || d.hora !== undefined || d.semanas !== undefined, {
    message: 'Nada para mudar.',
  })

// Muda o dia/hora (mover) e as semanas de um horário de aluno, sem encerrar o vínculo.
// Passa pela checagem de choque de sempre.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode editar horários.' }, { status: 403 })
  }
  const { id } = await params
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }

  const vigentes = await horariosVigentes()
  const atual = vigentes.find((h) => h.id === id)
  if (!atual) return NextResponse.json({ erro: 'Horário não encontrado.' }, { status: 404 })

  const diaSemana = validado.data.diaSemana ?? atual.diaSemana
  const hora = validado.data.hora ?? atual.hora
  const semanas = (validado.data.semanas ?? atual.semanas) & todasAsSemanas(atual.semanasNoCiclo)
  if (semanas === 0) {
    return NextResponse.json({ erro: 'Para tirar o aluno de todas as semanas, use Encerrar.' }, { status: 400 })
  }
  const mudouSlot = diaSemana !== atual.diaSemana || hora !== atual.hora
  if (!mudouSlot && semanas === atual.semanas) return NextResponse.json({ ok: true })

  const slots = await slotsDoProfissional(atual.profissionalId)
  if (mudouSlot && !temSlot(slots, diaSemana, hora)) {
    return NextResponse.json({ erro: 'Esse horário não existe na agenda deste profissional.' }, { status: 400 })
  }
  const duracoes = await carregarDuracoes()
  const depois = vigentes.map((h) =>
    h.id === id
      ? { ...h, diaSemana, hora, semanas, duracaoMin: duracaoEfetiva(duracoes, h.profissionalId, diaSemana, hora, h.duracaoMin) }
      : h,
  )
  const conflito = conflitoDaMudanca(vigentes, depois)
  if (conflito) {
    return NextResponse.json(
      { erro: `Não dá: ${conflito}.`, livres: horariosLivres(atual.profissionalId, vigentes, slots) },
      { status: 409 },
    )
  }

  const antes = camposDoHorario(atual)
  await prisma.horario.update({ where: { id }, data: { diaSemana, hora, semanas } })
  const o = `${atual.alunoNome} na agenda de ${atual.profissionalNome}`
  const rotulo = rotuloSemanas(semanas, atual.semanasNoCiclo)
  await registrarAcesso(
    sessao.user.id,
    mudouSlot ? 'MOVEU_HORARIO' : 'EDITOU_SEMANAS',
    mudouSlot
      ? `${o}: de ${quando(atual.diaSemana, atual.hora)} para ${quando(diaSemana, hora)}${semanas !== atual.semanas && rotulo ? ` · ${rotulo}` : ''}`
      : `${o} (${quando(diaSemana, hora)}): ${rotulo || 'toda semana'}`,
    { horarios: [{ id, antes, depois: { diaSemana, hora, semanas } }] },
  )
  return NextResponse.json({ ok: true })
}

// Liberar horário: tira o aluno deste horário sem encerrar o atendimento. O vínculo continua
// aberto (o aluno fica "aguardando horário") e o horário vai para a Lixeira, de onde volta.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode liberar horários.' }, { status: 403 })
  }
  const { id } = await params
  const horario = await prisma.horario.findFirst({
    where: { id, excluidoEm: null, vinculo: { fim: null } },
    include: {
      vinculo: { select: { aluno: { select: { nome: true } }, profissional: { select: { nome: true } } } },
    },
  })
  if (!horario) return NextResponse.json({ erro: 'Horário não encontrado.' }, { status: 404 })

  await prisma.horario.update({
    where: { id },
    data: { excluidoEm: new Date(), excluidoPor: sessao.user.name ?? sessao.user.id },
  })
  await registrarAcesso(
    sessao.user.id,
    'TIROU_DO_HORARIO',
    `${horario.vinculo.aluno.nome} na agenda de ${horario.vinculo.profissional.nome}: ${quando(horario.diaSemana, horario.hora)} liberado (continua aguardando horário)`,
  )
  return NextResponse.json({ ok: true })
}
