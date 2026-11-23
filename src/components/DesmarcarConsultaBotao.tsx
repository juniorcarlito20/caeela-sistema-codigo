'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Desmarca uma consulta avulsa que ainda não foi registrada, depois de pedir a confirmação.
export default function DesmarcarConsultaBotao({
  consultaId,
  pessoa,
  quando,
}: {
  consultaId: string
  pessoa: string
  quando: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    setEnviando(true)
    try {
      const r = await fetch(`/api/consultas/${consultaId}`, { method: 'DELETE' })
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não foi possível desmarcar. Tente de novo.')
        setEnviando(false)
        return
      }
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Não foi possível desmarcar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#B3261E] bg-white px-4 py-2 text-sm font-bold text-[#B3261E]"
      >
        Desmarcar
      </button>
    )
  }

  return (
    <div className="rounded-xl border-[1.5px] border-[#B3261E]/50 bg-[#B3261E]/5 p-3 text-sm text-[#16243b]">
      <p className="font-bold">
        Desmarcar a consulta de {pessoa} ({quando})?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#B3261E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Desmarcando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-60"
        >
          Voltar
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
    </div>
  )
}
