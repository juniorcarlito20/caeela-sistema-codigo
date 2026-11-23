'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'min-h-[40px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none'

export default function EncerrarAtendimentoBotao({
  vinculoId,
  alunoNome,
  aoEncerrar,
}: {
  vinculoId: string
  alunoNome: string
  aoEncerrar?: () => void
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [situacao, setSituacao] = useState('')
  const [pausaRetomarEm, setPausaRetomarEm] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    setEnviando(true)
    const resposta = await fetch(`/api/vinculos/${vinculoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        situacaoAluno: situacao === '' ? null : situacao,
        pausaRetomarEm: situacao === 'PAUSA' && pausaRetomarEm !== '' ? pausaRetomarEm : null,
      }),
    })
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível encerrar. Tente de novo.')
      return
    }
    setAberto(false)
    aoEncerrar?.()
    router.refresh()
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-[#B3261E] bg-white px-3 py-1.5 text-xs font-bold text-[#B3261E]"
      >
        Encerrar atendimento
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Situação de ${alunoNome} após encerrar`}
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          className={classeCampo}
        >
          <option value="">Se último vínculo, vira…</option>
          <option value="PAUSA">Pausa</option>
          <option value="ALTA">Alta</option>
          <option value="DESLIGADO">Desligado</option>
        </select>
        {situacao === 'PAUSA' && (
          <input
            type="date"
            aria-label="Previsão de retorno (opcional)"
            value={pausaRetomarEm}
            onChange={(e) => setPausaRetomarEm(e.target.value)}
            title="Previsão de retorno (opcional)"
            className={classeCampo}
          />
        )}
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#B3261E] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Encerrando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}
