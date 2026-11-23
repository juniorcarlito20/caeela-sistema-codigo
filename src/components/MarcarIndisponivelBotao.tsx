'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MarcarIndisponivelBotao({
  profissionalId,
  diaSemana,
  hora,
  indisponivel,
}: {
  profissionalId: string
  diaSemana: number
  hora: string
  indisponivel: boolean
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)

  async function alternar() {
    setEnviando(true)
    await fetch('/api/horarios/indisponibilidade', {
      method: indisponivel ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profissionalId, diaSemana, hora }),
    })
    setEnviando(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      disabled={enviando}
      onClick={alternar}
      title={indisponivel ? 'Liberar este horário' : 'Marcar como indisponível'}
      className={`inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full text-[11px] font-bold disabled:opacity-60 ${
        indisponivel
          ? 'border-[1.5px] border-slate-300 bg-white text-slate-500'
          : 'border-[1.5px] border-[#B3261E] bg-white text-[#B3261E]'
      }`}
    >
      {indisponivel ? '✓' : '✕'}
    </button>
  )
}
