'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BotaoMoverEspera({ alunoId }: { alunoId: string }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function mover() {
    setErro('')
    setEnviando(true)
    const resposta = await fetch(`/api/alunos/${alunoId}/mover-espera`, { method: 'POST' })
    const corpo = (await resposta.json()) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível mover. Tente de novo.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={mover}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Movendo…' : 'Mover pra fila de espera'}
      </button>
      {erro && <p role="alert" className="text-[11px] font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}
