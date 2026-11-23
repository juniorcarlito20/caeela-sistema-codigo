import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { conflitoDaMudanca, horariosVigentes, type HorarioVigente } from '@/lib/agendaVigente'
import { registrarAcesso, quando } from '@/lib/registro'
import { horariosLivres } from '@/domain/conflitos'
import { rotuloSemanas, todasAsSemanas, vagasParaMaisUm } from '@/domain/semanas'
import { garantirVagas, slotsDoProfissional } from '@/lib/slots'
import { LIMITE_VAGAS, duracaoDoSlot, temSlot, vagasDoSlot } from '@/domain/grade'

const esquema = z.object({
  alunoId: z.string().min(1, 'Escolha o aluno.'),
  areaId: z.string().min(1, 'Escolha a área.'),
  profissionalId: z.string().min(1, 'Escolha o profissional.'),
  diaSemana: z.number().int().min(1).max(5),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'),
  inicio: z
    .string()
    .min(1, 'Escolha a data de início.')
    .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00`).getTime()), {
      message: 'Confira a data de início.',
    }),
  fim: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || !Number.isNaN(new Date(`${v}T12:00:00`).getTime()), {
      message: 'Confira a previsão de término.',
    })
    .transform((v) => (v === '' ? null : new Date(`${v}T12:00:00`))),
  // Em quais semanas do profissional o aluno fica (máscara: 1 = Semana 1, 2 = Semana 2,
  // 4 = Semana 3, 8 = Semana 4, somados). Sem informar: todas.
  semanas: z.number().int().min(1).max(15).optional(),
  // "+" na agenda: o horário vira de grupo sozinho (as vagas sobem o quanto precisar, até o limite).
  grupo: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode encaminhar alunos.' }, { status: 403 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados do encaminhamento.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const dados = validado.data

  const [aluno, profissional, area] = await Promise.all([
    prisma.aluno.findFirst({ where: { id: dados.alunoId, excluidoEm: null } }),
    prisma.usuario.findFirst({ where: { id: dados.profissionalId, ativo: true, perfil: 'PROFISSIONAL' } }),
    prisma.area.findUnique({ where: { id: dados.areaId } }),
  ])
  if (!aluno) return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 400 })
  if (!profissional) return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 400 })
  if (!area) return NextResponse.json({ erro: 'Área não encontrada.' }, { status: 400 })

  const todas = todasAsSemanas(profissional.semanasNoCiclo)
  const semanas = (dados.semanas ?? todas) & todas
  if (semanas === 0) return NextResponse.json({ erro: 'Escolha pelo menos uma semana.' }, { status: 400 })

  const slots = await slotsDoProfissional(profissional.id)
  if (!temSlot(slots, dados.diaSemana, dados.hora)) {
    return NextResponse.json(
      { erro: 'Esse horário não existe na agenda deste profissional.', livres: horariosLivres(profissional.id, [], slots) },
      { status: 400 },
    )
  }
  const duracaoMin = duracaoDoSlot(slots, dados.diaSemana, dados.hora) ?? 40
  let vigentes = await horariosVigentes()
  const vagasAtuais = vagasDoSlot(slots, dados.diaSemana, dados.hora)
  let vagasNovas = vagasAtuais
  if (dados.grupo) {
    const nesteHorario = vigentes.filter(
      (h) => h.profissionalId === profissional.id && h.diaSemana === dados.diaSemana && h.hora === dados.hora,
    )
    vagasNovas = Math.max(
      vagasAtuais,
      vagasParaMaisUm(nesteHorario.map((h) => h.semanas), semanas, profissional.semanasNoCiclo),
    )
    if (vagasNovas > LIMITE_VAGAS) {
      return NextResponse.json({ erro: `Um horário aceita no máximo ${LIMITE_VAGAS} crianças.` }, { status: 400 })
    }
    // Enquanto não grava, a checagem de choque já enxerga o horário com as vagas novas.
    vigentes = vigentes.map((h) => (nesteHorario.includes(h) ? { ...h, vagas: vagasNovas } : h))
  }
  const novo: HorarioVigente = {
    id: 'novo',
    vinculoId: 'novo',
    alunoNome: aluno.nome,
    profissionalNome: profissional.nome,
    areaNome: area.nome,
    profissionalId: profissional.id,
    alunoId: aluno.id,
    diaSemana: dados.diaSemana,
    hora: dados.hora,
    semanas,
    semanasNoCiclo: profissional.semanasNoCiclo,
    cicloInicio: profissional.cicloInicio,
    duracaoMin,
    vagas: vagasNovas,
  }
  const conflito = conflitoDaMudanca(vigentes, [...vigentes, novo])
  if (conflito) {
    return NextResponse.json(
      { erro: `Não dá para encaminhar: ${conflito}.`, livres: horariosLivres(profissional.id, vigentes, slots) },
      { status: 409 },
    )
  }

  if (vagasNovas > vagasAtuais) {
    await garantirVagas(profissional.id, slots, dados.diaSemana, dados.hora, vagasNovas)
  }

  // Já atende este aluno nesta área (ex.: aguardando horário depois de "Liberar horário")?
  // O horário novo entra no mesmo atendimento, sem abrir um segundo.
  const existente = await prisma.vinculo.findFirst({
    where: { alunoId: aluno.id, profissionalId: profissional.id, areaId: area.id, fim: null },
    select: { id: true },
  })
  let vinculoId: string
  if (existente) {
    await prisma.horario.create({
      data: { vinculoId: existente.id, diaSemana: dados.diaSemana, hora: dados.hora, duracaoMin, semanas },
    })
    vinculoId = existente.id
  } else {
    const vinculo = await prisma.vinculo.create({
      data: {
        alunoId: aluno.id,
        profissionalId: profissional.id,
        areaId: area.id,
        inicio: new Date(`${dados.inicio}T12:00:00`),
        fim: dados.fim,
        horarios: { create: { diaSemana: dados.diaSemana, hora: dados.hora, duracaoMin, semanas } },
      },
    })
    vinculoId = vinculo.id
  }
  await prisma.aluno.update({
    where: { id: aluno.id },
    data: { situacao: 'ATENDIMENTO', situacaoDesde: new Date(), pausaRetomarEm: null },
  })
  const rotulo = rotuloSemanas(semanas, profissional.semanasNoCiclo)
  await registrarAcesso(
    sessao.user.id,
    'ENCAMINHOU_ALUNO',
    `${aluno.nome} para ${profissional.nome} (${quando(dados.diaSemana, dados.hora)}${rotulo ? ` · ${rotulo}` : ''})`,
  )
  return NextResponse.json({ id: vinculoId }, { status: 201 })
}
