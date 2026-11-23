'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Botão do Histórico: volta uma mudança de agenda. Pede confirmação na própria tela.
export default function DesfazerAlteracaoBotao({ registroId }: { registroId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function desfazer() {
    setOcupado(true)
    setErro('')
    const resposta = await fetch(`/api/registro-acessos/${registroId}/desfazer`, { method: 'POST' })
    setOcupado(false)
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível desfazer.')
      setConfirmando(false)
      return
    }
    router.refresh()
  }

  if (!confirmando) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setConfirmando(true); setErro('') }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-2 text-xs font-bold text-[#0A63C9]"
        >
          ↩ Desfazer
        </button>
        {erro && <p role="alert" className="mt-1 max-w-[260px] text-xs font-bold text-[#B3261E]">{erro}</p>}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-slate-600">Voltar como estava?</span>
      <button
        type="button"
        disabled={ocupado}
        onClick={desfazer}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {ocupado ? 'Desfazendo…' : 'Sim, desfazer'}
      </button>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => setConfirmando(false)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
      >
        Não
      </button>
    </div>
  )
}
