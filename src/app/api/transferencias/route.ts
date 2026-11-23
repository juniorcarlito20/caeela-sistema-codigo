import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { carregarDuracoes, duracaoEfetiva, slotsDoProfissional } from '@/lib/slots'
import { temSlot } from '@/domain/grade'
import { todasAsSemanas } from '@/domain/semanas'
import { registrarAcesso, quando } from '@/lib/registro'
import { conflitoDaMudanca, horariosVigentes, type HorarioVigente } from '@/lib/agendaVigente'

const esquema = z.object({
  vinculoId: z.string().min(1, 'Vínculo inválido.'),
  // Qual horário do vínculo vai junto. Sem informar, acha pelo dia/hora (jeito antigo).
  horarioId: z.string().min(1).optional(),
  diaSemana: z.number().int().min(1).max(5),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'),
  profissionalId: z.string().min(1, 'Escolha o profissional que recebe.'),
  // Semanas na agenda de quem recebe. Sem informar: as mesmas, quando der para saber.
  semanas: z.number().int().min(1).max(15).optional(),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção transfere alunos.' }, { status: 403 })
  }
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
  const { vinculoId, horarioId, diaSemana, hora, profissionalId } = validado.data

  const vinculo = await prisma.vinculo.findUnique({
    where: { id: vinculoId },
    include: { horarios: { where: { excluidoEm: null } }, profissional: true },
  })
  if (!vinculo || vinculo.fim) return NextResponse.json({ erro: 'Vínculo não encontrado.' }, { status: 404 })
  const horario = horarioId
    ? vinculo.horarios.find((h) => h.id === horarioId)
    : vinculo.horarios.find((h) => h.diaSemana === diaSemana && h.hora === hora)
  if (!horario) return NextResponse.json({ erro: 'Horário não encontrado.' }, { status: 404 })

  const novo = await prisma.usuario.findFirst({ where: { id: profissionalId, ativo: true, perfil: 'PROFISSIONAL' } })
  if (!novo || novo.id === vinculo.profissionalId) {
    return NextResponse.json({ erro: 'Escolha outro profissional ativo.' }, { status: 400 })
  }
  if (!temSlot(await slotsDoProfissional(novo.id), diaSemana, hora)) {
    return NextResponse.json(
      { erro: 'Esse horário não existe na agenda do profissional que recebe. Peça para a direção incluir o horário antes.' },
      { status: 400 },
    )
  }

  // Semanas na agenda de quem recebe: as pedidas; senão "toda semana" continua toda semana e,
  // com o mesmo número de semanas, as mesmas semanas. Fora disso a direção precisa escolher.
  const todasDestino = todasAsSemanas(novo.semanasNoCiclo)
  let semanas = validado.data.semanas !== undefined ? validado.data.semanas & todasDestino : 0
  if (validado.data.semanas === undefined) {
    if (horario.semanas === todasAsSemanas(vinculo.profissional.semanasNoCiclo)) semanas = todasDestino
    else if (vinculo.profissional.semanasNoCiclo === novo.semanasNoCiclo) semanas = horario.semanas
  }
  if (semanas === 0) {
    return NextResponse.json(
      { erro: `${novo.nome} tem ${novo.semanasNoCiclo} semanas na agenda: escolha em quais o aluno fica.` },
      { status: 400 },
    )
  }

  const duracoes = await carregarDuracoes()
  const vigentes = await horariosVigentes()
  const origem = vigentes.find((h) => h.id === horario.id)
  const chegando: HorarioVigente = {
    id: 'novo',
    vinculoId: 'novo',
    alunoNome: origem?.alunoNome ?? 'O aluno',
    profissionalNome: novo.nome,
    areaNome: origem?.areaNome ?? '',
    profissionalId: novo.id,
    alunoId: vinculo.alunoId,
    diaSemana,
    hora,
    semanas,
    semanasNoCiclo: novo.semanasNoCiclo,
    cicloInicio: novo.cicloInicio,
    duracaoMin: duracaoEfetiva(duracoes, novo.id, diaSemana, hora, horario.duracaoMin),
  }
  const conflito = conflitoDaMudanca(vigentes, [...vigentes.filter((h) => h.id !== horario.id), chegando])
  if (conflito) return NextResponse.json({ erro: `Não dá para transferir: ${conflito}.` }, { status: 409 })

  const agora = new Date()
  const novoVinculo = await prisma.vinculo.create({
    data: { alunoId: vinculo.alunoId, profissionalId: novo.id, areaId: vinculo.areaId, inicio: agora },
  })
  await prisma.horario.create({
    data: { vinculoId: novoVinculo.id, diaSemana, hora, duracaoMin: horario.duracaoMin, local: horario.local, semanas },
  })
  // Agendados futuros do horário de origem mudam de dono junto.
  const futuros = await prisma.atendimento.findMany({
    where: { vinculoId: vinculo.id, hora: horario.hora, data: { gte: agora }, situacao: 'AGENDADO' },
    select: { id: true, data: true },
  })
  const doHorario = futuros
    .filter((a) => ((a.data.getDay() + 6) % 7) + 1 === horario.diaSemana)
    .map((a) => a.id)
  if (doHorario.length > 0) {
    await prisma.atendimento.updateMany({ where: { id: { in: doHorario } }, data: { vinculoId: novoVinculo.id } })
  }
  await prisma.horario.delete({ where: { id: horario.id } })
  const restantes = await prisma.horario.count({ where: { vinculoId: vinculo.id, excluidoEm: null } })
  if (restantes === 0) {
    await prisma.vinculo.update({ where: { id: vinculo.id }, data: { fim: agora } })
  }
  const transferencia = await prisma.transferencia.create({
    data: {
      alunoId: vinculo.alunoId,
      deProfissionalId: vinculo.profissionalId,
      paraProfissionalId: novo.id,
      vinculoAnteriorId: vinculo.id,
      vinculoNovoId: novoVinculo.id,
    },
  })
  await prisma.aluno.update({ where: { id: vinculo.alunoId }, data: { situacao: 'ATENDIMENTO' } })
  const alunoReg = await prisma.aluno.findUnique({ where: { id: vinculo.alunoId }, select: { nome: true } })
  await registrarAcesso(
    sessao.user.id,
    'TRANSFERIU_ALUNO',
    `${alunoReg?.nome ?? 'aluno'} de ${vinculo.profissional.nome} para ${novo.nome} (${quando(diaSemana, hora)})`,
  )
  return NextResponse.json({ id: transferencia.id }, { status: 201 })
}
