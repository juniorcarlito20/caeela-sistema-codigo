'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type ProfissionalOpcao = { id: string; nome: string }

const TIPOS = [
  { id: 'FALTA', rotulo: 'Falta' },
  { id: 'ATESTADO', rotulo: 'Atestado' },
  { id: 'LICENCA', rotulo: 'Licença' },
  { id: 'FERIAS', rotulo: 'Férias' },
  { id: 'CAPACITACAO', rotulo: 'Capacitação' },
  { id: 'OUTRO', rotulo: 'Outro' },
] as const

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

export default function FormAusencia({
  profissionais,
  fixo,
}: {
  profissionais: ProfissionalOpcao[]
  fixo?: string
}) {
  const router = useRouter()
  const [profissionalId, setProfissionalId] = useState(fixo ?? '')
  const [tipo, setTipo] = useState<string>('FALTA')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aberto, setAberto] = useState(!!fixo)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setOk('')
    if (!profissionalId || !inicio || !fim) {
      setErro('Escolha o profissional, o início e o fim.')
      return
    }
    setEnviando(true)
    try {
      const dados = new FormData()
      dados.set('profissionalId', profissionalId)
      dados.set('tipo', tipo)
      dados.set('inicio', inicio)
      dados.set('fim', fim)
      dados.set('justificativa', justificativa)
      if (arquivo) dados.set('atestado', arquivo, arquivo.name)
      const r = await fetch('/api/ausencias', { method: 'POST', body: dados })
      const corpo = (await r.json()) as { erro?: string; cancelados?: number }
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não consegui salvar. Tente de novo.')
        setEnviando(false)
        return
      }
      setOk(
        `Ausência registrada. ${corpo.cancelados ?? 0} atendimento(s) cancelados nesses dias.`,
      )
      setArquivo(null)
      router.refresh()
    } catch {
      setErro('Não consegui salvar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
      >
        + Registrar ausência
      </button>
    )
  }

  return (
    <form onSubmit={salvar} className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-[15px] font-extrabold">Registrar ausência</h2>
      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="mb-4 rounded-lg border border-[#2EA84A]/30 bg-[#2EA84A]/10 px-4 py-3 text-sm font-bold text-[#1c7a33]">
          {ok}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {!fixo && (
          <div>
            <label htmlFor="aus-prof" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Profissional
            </label>
            <select
              id="aus-prof"
              required
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className={classeCampo}
            >
              <option value="">Escolha…</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="aus-tipo" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Tipo
          </label>
          <select
            id="aus-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={classeCampo}
          >
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aus-inicio" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            De
          </label>
          <input
            id="aus-inicio"
            type="date"
            required
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={classeCampo}
          />
        </div>
        <div>
          <label htmlFor="aus-fim" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Até
          </label>
          <input
            id="aus-fim"
            type="date"
            required
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className={classeCampo}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="aus-just" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Justificativa <span className="font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            id="aus-just"
            rows={2}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className={classeCampo}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="aus-atestado" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Atestado <span className="font-normal normal-case">(foto ou PDF, opcional)</span>
          </label>
          <input
            id="aus-atestado"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="min-h-[44px] w-full text-sm text-slate-700"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Salvando…' : 'Salvar ausência'}
      </button>
    </form>
  )
}
