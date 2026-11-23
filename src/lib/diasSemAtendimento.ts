import { prisma } from '@/db/prisma'
import { dataDoDia, isoDia } from '@/domain/diaSemAtendimento'

// Dias sem atendimento do centro entre duas datas: AAAA-MM-DD → motivo.
export async function diasSemAtendimentoEntre(inicio: Date, fim: Date): Promise<Map<string, string>> {
  const de = new Date(inicio)
  de.setHours(0, 0, 0, 0)
  const ate = new Date(fim)
  ate.setHours(23, 59, 59, 999)
  const linhas = await prisma.diaSemAtendimento.findMany({
    where: { data: { gte: de, lte: ate } },
    select: { data: true, motivo: true },
  })
  return new Map(linhas.map((l) => [isoDia(l.data), l.motivo]))
}

// Motivo do dia sem atendimento (AAAA-MM-DD), ou null se o centro atende nesse dia.
export async function semAtendimentoNoDia(iso: string): Promise<string | null> {
  const data = dataDoDia(iso)
  if (Number.isNaN(data.getTime())) return null
  const dia = await prisma.diaSemAtendimento.findUnique({ where: { data }, select: { motivo: true } })
  return dia?.motivo ?? null
}

// O dia sem atendimento com a hora em que foi marcado (para a tela de avisos saber o que foi
// enviado antes e depois da marcação), ou null se o centro atende nesse dia.
export async function marcacaoDoDia(iso: string): Promise<{ motivo: string; marcadoEm: Date } | null> {
  const data = dataDoDia(iso)
  if (Number.isNaN(data.getTime())) return null
  const dia = await prisma.diaSemAtendimento.findUnique({ where: { data }, select: { motivo: true, criadoEm: true } })
  return dia ? { motivo: dia.motivo, marcadoEm: dia.criadoEm } : null
}
