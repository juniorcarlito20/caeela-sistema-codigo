import { prisma } from '@/db/prisma'

// Ausência vigente do profissional num dia (AAAA-MM-DD). Usado para criar
// já cancelado o atendimento que nascer em dia de ausência.
export async function ausenciaNoDia(profissionalId: string, diaISO: string) {
  const dia = new Date(`${diaISO}T12:00:00`)
  if (Number.isNaN(dia.getTime())) return null
  const inicioDia = new Date(dia)
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(inicioDia.getTime() + 86400000)
  return prisma.ausencia.findFirst({
    where: {
      profissionalId,
      excluidoEm: null,
      inicio: { lte: fimDia },
      fim: { gte: inicioDia },
    },
    orderBy: { inicio: 'desc' },
  })
}
