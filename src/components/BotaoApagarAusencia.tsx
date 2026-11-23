'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BotaoApagarAusencia({ id, nome }: { id: string; nome: string }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function apagar() {
    if (
      !window.confirm(
        `Apagar a ausência de ${nome}? Os atendimentos cancelados por ela voltam a ficar agendados.`,
      )
    ) {
      return
    }
    setErro('')
    setEnviando(true)
    try {
      const r = await fetch(`/api/ausencias/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const corpo = (await r.json()) as { erro?: string }
        setErro(corpo.erro ?? 'Não consegui apagar. Tente de novo.')
        setEnviando(false)
        return
      }
      router.refresh()
    } catch {
      setErro('Não consegui apagar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={apagar}
        className="inline-flex min-h-[44px] items-center px-2 text-xs font-bold text-[#B3261E] disabled:opacity-60"
      >
        {enviando ? '…' : 'Apagar'}
      </button>
      {erro && <span className="text-xs font-bold text-[#B3261E]">{erro}</span>}
    </span>
  )
}
