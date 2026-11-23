'use client'

import { useState } from 'react'

export type ProfissionalOpcao = { id: string; nome: string }

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FolhaMensal({
  profissionais,
}: {
  profissionais: ProfissionalOpcao[]
}) {
  const [mes, setMes] = useState(mesAtual())
  const [profissionalId, setProfissionalId] = useState('')
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)

  async function gerar() {
    setErro('')
    if (!mes) {
      setErro('Escolha o mês.')
      return
    }
    setGerando(true)
    try {
      const [ano, mm] = mes.split('-')
      const p = new URLSearchParams({ ano, mes: String(Number(mm)) })
      if (profissionalId) p.set('profissionalId', profissionalId)
      const r = await fetch(`/api/presencas/mensal?${p.toString()}`)
      if (!r.ok) {
        const corpo = (await r.json()) as { erro?: string }
        setErro(corpo.erro ?? 'Não consegui gerar. Tente de novo.')
        setGerando(false)
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presenca-${mes}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não consegui gerar. Verifique a internet e tente de novo.')
    }
    setGerando(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="folha-mes" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Mês
          </label>
          <input
            id="folha-mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="folha-prof" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Profissional
          </label>
          <select
            id="folha-prof"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          >
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        disabled={gerando}
        onClick={gerar}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {gerando ? 'Gerando…' : '📄 Gerar folha em PDF'}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Em meses muito cheios (mais de 200 registros), gere um profissional por vez.
      </p>
    </div>
  )
}
