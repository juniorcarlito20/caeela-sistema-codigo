'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type ItemLixeira = {
  tipo: 'aluno' | 'documento' | 'evolucao' | 'horario' | 'relatorio' | 'profissional'
  id: string
  titulo: string
  detalhe: string
  excluidoPor: string
  excluidoEm: string
}

export default function BotaoRestaurar({ item }: { item: ItemLixeira }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [restaurado, setRestaurado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function restaurar() {
    setErro('')
    setEnviando(true)
    try {
      const r = await fetch('/api/lixeira/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: item.tipo, id: item.id }),
      })
      if (!r.ok) {
        setErro('Não consegui restaurar. Tente de novo.')
        setEnviando(false)
        return
      }
      setRestaurado(true)
      router.refresh()
    } catch {
      setErro('Não consegui restaurar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (restaurado) {
    return <span className="text-xs font-bold text-[#1c7a33]">Restaurado.</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={restaurar}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {enviando ? '…' : '↩ Restaurar'}
      </button>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}
