import { prisma } from '@/db/prisma'
import { DURACAO_PADRAO, duracaoDoSlot, slotsEfetivos, vagasDoSlot, type Slot } from '@/domain/grade'

// Horários de atendimento que valem hoje para cada profissional: os que a direção salvou
// (ou a grade padrão, se ainda não personalizou) mais qualquer atendimento que já exista
// fora deles — assim nada fica escondido na agenda. Cada horário traz as suas vagas (1 = individual).
export async function slotsPorProfissional(ids?: string[]): Promise<Record<string, Slot[]>> {
  const profissionais =
    ids ?? (await prisma.usuario.findMany({ where: { perfil: 'PROFISSIONAL' }, select: { id: true } })).map((u) => u.id)
  const [salvos, vinculos] = await Promise.all([
    prisma.slotProfissional.findMany({
      where: { profissionalId: { in: profissionais } },
      select: { profissionalId: true, diaSemana: true, hora: true, duracaoMin: true, vagas: true },
    }),
    prisma.vinculo.findMany({
      where: { fim: null, profissionalId: { in: profissionais } },
      select: {
        profissionalId: true,
        horarios: { where: { excluidoEm: null }, select: { diaSemana: true, hora: true, duracaoMin: true } },
      },
    }),
  ])
  const resultado: Record<string, Slot[]> = {}
  for (const id of profissionais) {
    resultado[id] = slotsEfetivos(
      salvos
        .filter((s) => s.profissionalId === id)
        .map((s) => ({ diaSemana: s.diaSemana, hora: s.hora, duracaoMin: s.duracaoMin, vagas: s.vagas })),
      vinculos.filter((v) => v.profissionalId === id).flatMap((v) => v.horarios),
    )
  }
  return resultado
}

export async function slotsDoProfissional(id: string): Promise<Slot[]> {
  return (await slotsPorProfissional([id]))[id] ?? []
}

// Quanto dura cada horário é decidido pelo horário de atendimento do profissional (o que a
// direção edita), não pelo que ficou gravado no atendimento: mover um aluno para outro
// horário já leva a duração certa, e editar a duração vale para todos de uma vez.
export type Duracoes = Map<string, number>

export async function carregarDuracoes(): Promise<Duracoes> {
  const linhas = await prisma.slotProfissional.findMany({
    select: { profissionalId: true, diaSemana: true, hora: true, duracaoMin: true },
  })
  return new Map(linhas.map((l) => [`${l.profissionalId}|${l.diaSemana}|${l.hora}`, l.duracaoMin]))
}

export function duracaoEfetiva(
  duracoes: Duracoes, profissionalId: string, diaSemana: number, hora: string, reserva?: number | null,
): number {
  return duracoes.get(`${profissionalId}|${diaSemana}|${hora}`) ?? reserva ?? DURACAO_PADRAO
}

// Vagas de cada horário (atendimento em grupo): quantas crianças cabem ao mesmo tempo.
// Horário sem registro (grade padrão) é individual: 1 vaga.
export type VagasPorHorario = Map<string, number>

export async function carregarVagas(): Promise<VagasPorHorario> {
  const linhas = await prisma.slotProfissional.findMany({
    select: { profissionalId: true, diaSemana: true, hora: true, vagas: true },
  })
  return new Map(linhas.map((l) => [`${l.profissionalId}|${l.diaSemana}|${l.hora}`, l.vagas]))
}

export function vagasEfetivas(vagas: VagasPorHorario, profissionalId: string, diaSemana: number, hora: string): number {
  return vagas.get(`${profissionalId}|${diaSemana}|${hora}`) ?? 1
}

// "+" na agenda: sobe as vagas do horário até `vagas` (nunca baixa). Quem ainda usa a grade padrão
// não tem nada salvo, e gravar só este horário faria o resto da grade sumir: então grava a grade
// inteira que ele já vê, com este horário já com as vagas novas.
export async function garantirVagas(
  profissionalId: string, slots: Slot[], diaSemana: number, hora: string, vagas: number,
): Promise<void> {
  if (vagas <= vagasDoSlot(slots, diaSemana, hora)) return
  const salvos = await prisma.slotProfissional.findMany({
    where: { profissionalId }, select: { id: true, diaSemana: true, hora: true },
  })
  if (salvos.length === 0) {
    await prisma.slotProfissional.createMany({
      data: slots.map((s) => ({
        profissionalId, diaSemana: s.diaSemana, hora: s.hora, duracaoMin: s.duracaoMin,
        vagas: s.diaSemana === diaSemana && s.hora === hora ? vagas : (s.vagas ?? 1),
      })),
    })
    return
  }
  const dele = salvos.find((s) => s.diaSemana === diaSemana && s.hora === hora)
  if (dele) {
    await prisma.slotProfissional.update({ where: { id: dele.id }, data: { vagas } })
    return
  }
  await prisma.slotProfissional.create({
    data: { profissionalId, diaSemana, hora, duracaoMin: duracaoDoSlot(slots, diaSemana, hora) ?? DURACAO_PADRAO, vagas },
  })
}
