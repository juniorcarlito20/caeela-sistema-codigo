import { acontece, semanaEmMonday, todasAsSemanas } from './semanas'

export type HorarioFixo = {
  vinculoId: string; diaSemana: number; hora: string; vigenteAte: Date | null
  vinculoFim?: Date | null
  semanas?: number; semanasNoCiclo?: number; cicloInicio?: Date | null
}

export function gerarSemana(horarios: HorarioFixo[], segunda: Date) {
  const inicio = new Date(segunda)
  inicio.setHours(0, 0, 0, 0)
  const referencia = semanaEmMonday(segunda)
  return horarios.flatMap((h) => {
    const data = new Date(segunda)
    data.setDate(segunda.getDate() + (h.diaSemana - 1))
    if (h.vigenteAte && h.vigenteAte < data) return []
    if (h.vinculoFim && h.vinculoFim < inicio) return []
    const semanasNoCiclo = h.semanasNoCiclo ?? 1
    if (!acontece(
      { semanasNoCiclo, cicloInicio: h.cicloInicio ?? null, semanas: h.semanas ?? todasAsSemanas(semanasNoCiclo) },
      referencia,
    )) return []
    return [{ data, hora: h.hora, vinculoId: h.vinculoId }]
  }).sort((a, b) => a.data.getTime() - b.data.getTime() || a.hora.localeCompare(b.hora))
}

// Devolve a segunda-feira (00:00) da semana de qualquer data.
export function segundaDaSemana(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}
