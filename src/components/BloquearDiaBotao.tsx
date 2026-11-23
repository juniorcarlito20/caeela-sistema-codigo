'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BloquearDiaBotao({
  profissionalId,
  diaSemana,
  totalmenteIndisponivel,
}: {
  profissionalId: string
  diaSemana: number
  totalmenteIndisponivel: boolean
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)

  async function alternar() {
    setEnviando(true)
    await fetch('/api/horarios/indisponibilidade/dia', {
      method: totalmenteIndisponivel ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profissionalId, diaSemana }),
    })
    setEnviando(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      disabled={enviando}
      onClick={alternar}
      className="mt-0.5 block w-full text-[9.5px] font-bold text-slate-400 underline decoration-dotted hover:text-slate-600 disabled:opacity-60"
    >
      {totalmenteIndisponivel ? 'liberar dia' : 'bloquear dia'}
    </button>
  )
}
