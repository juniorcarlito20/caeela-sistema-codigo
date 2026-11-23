import { frequencia, rotuloSemanas, type Frequencia } from '@/domain/semanas'

// Cores da frequência. Verde fica reservado para "horário livre".
const COR: Record<Frequencia, string> = {
  SEMANAL: 'bg-[#e6f0ff] text-[#0A63C9]',
  QUINZENAL: 'bg-[#efe7fb] text-[#6b3fb8]',
  MENSAL: 'bg-[#fff6d6] text-[#8a6100]',
  OUTRA: 'bg-slate-100 text-slate-600',
}

const CURTO: Record<Frequencia, string> = {
  SEMANAL: 'toda semana',
  QUINZENAL: 'quinzenal',
  MENSAL: 'mensal',
  OUTRA: '',
}

export function corDaFrequencia(semanas: number, semanasNoCiclo: number): string {
  return COR[frequencia(semanas, semanasNoCiclo)]
}

// "quinzenal" (curta) ou "Quinzenal · Semanas 1 e 3" (completa). Profissional de 1 semana não tem etiqueta.
export default function EtiquetaSemanas({
  semanas, semanasNoCiclo, completa = false,
}: { semanas: number; semanasNoCiclo: number; completa?: boolean }) {
  if (semanasNoCiclo <= 1) return null
  const f = frequencia(semanas, semanasNoCiclo)
  const texto = completa || f === 'OUTRA' ? rotuloSemanas(semanas, semanasNoCiclo) : CURTO[f]
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${COR[f]}`}>
      {texto || 'nenhuma semana'}
    </span>
  )
}
