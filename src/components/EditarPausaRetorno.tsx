'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EditarPausaRetorno({
  alunoId,
  valorAtual,
}: {
  alunoId: string
  valorAtual: string | null
}) {
  const router = useRouter()
  const [data, setData] = useState(valorAtual ?? '')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    setErro('')
    setEnviando(true)
    const resposta = await fetch(`/api/alunos/${alunoId}/pausa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pausaRetomarEm: data === '' ? null : data }),
    })
    const corpo = (await resposta.json()) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Previsão de retorno da pausa
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        <button
          type="button"
          disabled={enviando}
          onClick={salvar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {erro && <p role="alert" className="mt-1 text-xs font-bold text-[#B3261E]">{erro}</p>}
      <p className="mt-1 text-[11.5px] text-slate-500">
        Qualquer profissional vinculado ou a direção pode ajustar essa data.
      </p>
    </div>
  )
}
