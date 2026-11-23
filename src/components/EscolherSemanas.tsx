'use client'

import { alternarSemana, estaNaSemana } from '@/domain/semanas'
import EtiquetaSemanas from './EtiquetaSemanas'

// Os botões [1] [2] [3] [4]: ligar e desligar em quais semanas o aluno vem. Semana em que o
// horário já tem outro aluno fica apagada. Com 1 semana só, não aparece.
export default function EscolherSemanas({
  semanasNoCiclo, valor, ocupadas = 0, aoMudar, desabilitado = false,
}: {
  semanasNoCiclo: number
  valor: number
  ocupadas?: number
  aoMudar: (m: number) => void
  desabilitado?: boolean
}) {
  if (semanasNoCiclo <= 1) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold text-slate-500">Semanas:</span>
      {Array.from({ length: semanasNoCiclo }, (_, i) => i + 1).map((n) => {
        const marcada = estaNaSemana(valor, n)
        const ocupada = !marcada && estaNaSemana(ocupadas, n)
        return (
          <button
            key={n}
            type="button"
            aria-pressed={marcada}
            disabled={desabilitado || ocupada}
            title={ocupada ? 'Esse horário já tem aluno nessa semana' : undefined}
            onClick={() => aoMudar(alternarSemana(valor, n))}
            className={`inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-lg border-[1.5px] px-3 text-xs font-bold disabled:cursor-not-allowed ${
              marcada
                ? 'border-[#0A63C9] bg-[#0A63C9] text-white'
                : ocupada
                  ? 'border-slate-200 bg-slate-100 text-slate-300 line-through'
                  : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {marcada ? `✓ ${n}` : n}
          </button>
        )
      })}
      <EtiquetaSemanas semanas={valor} semanasNoCiclo={semanasNoCiclo} completa />
    </div>
  )
}
