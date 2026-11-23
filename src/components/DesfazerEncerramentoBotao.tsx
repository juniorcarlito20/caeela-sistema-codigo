'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DesfazerEncerramentoBotao({
  vinculoId,
  aoDesfazer,
}: {
  vinculoId: string
  aoDesfazer?: () => void
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    setEnviando(true)
    const resposta = await fetch(`/api/vinculos/${vinculoId}/desfazer`, { method: 'POST' })
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível desfazer. Tente de novo.')
      return
    }
    setConfirmando(false)
    aoDesfazer?.()
    router.refresh()
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
      >
        ↩️ Desfazer
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600">Reabrir este atendimento?</span>
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-[#0A63C9] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Desfazendo…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}
