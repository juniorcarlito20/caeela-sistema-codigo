'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SemanaDoCartao } from '@/domain/diaSemAtendimento'

// Cartão da semana: quem cuida da agenda toca no dia que não terá atendimento (feriado,
// decreto, reunião) e escreve o motivo. Vale só para aquele dia. Usado no Painel (direção) e
// nos Lembretes (direção e Secretaria).
export default function CartaoSemana({ semanas }: { semanas: SemanaDoCartao[] }) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
  const [aberto, setAberto] = useState<string | null>(null)
  const [semAtendimento, setSemAtendimento] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const semana = semanas[indice]
  const dia = semana.dias.find((d) => d.iso === aberto) ?? null

  function abrir(iso: string) {
    setErro('')
    if (aberto === iso) {
      setAberto(null)
      return
    }
    const d = semana.dias.find((x) => x.iso === iso)
    if (!d) return
    setAberto(iso)
    setSemAtendimento(d.motivo !== null)
    setMotivo(d.motivo ?? '')
  }

  async function salvar() {
    if (!dia) return
    setErro('')
    if (semAtendimento && motivo.trim().length < 3) {
      setErro('Escreva o motivo (ex.: Feriado municipal).')
      return
    }
    if (!semAtendimento && dia.motivo === null) {
      setAberto(null)
      return
    }
    setSalvando(true)
    const resposta = semAtendimento
      ? await fetch('/api/dias-sem-atendimento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dia.iso, motivo: motivo.trim() }),
        })
      : await fetch(`/api/dias-sem-atendimento?data=${dia.iso}`, { method: 'DELETE' })
    setSalvando(false)
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível salvar.')
      return
    }
    setAberto(null)
    router.refresh()
  }

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold">{semana.titulo}</h2>
        <button
          type="button"
          onClick={() => {
            setIndice(indice === 0 ? 1 : 0)
            setAberto(null)
            setErro('')
          }}
          className="min-h-[40px] text-[12.5px] font-bold text-[#0A63C9]"
        >
          {indice === 0 ? 'Semana seguinte ›' : '‹ Semana anterior'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {semana.dias.map((d) => {
          const travado = d.sabado || d.passado
          const marcado = d.motivo !== null
          return (
            <button
              key={d.iso}
              type="button"
              disabled={travado}
              aria-pressed={aberto === d.iso}
              onClick={() => abrir(d.iso)}
              title={d.sabado ? 'O centro não atende aos sábados' : d.passado ? 'Esse dia já passou' : undefined}
              className={`min-h-[64px] rounded-lg border-[1.5px] px-2 py-1.5 text-left text-[12px] disabled:cursor-not-allowed ${
                marcado
                  ? 'border-[#B3261E] bg-[#fde7e7] text-[#B3261E]'
                  : travado
                    ? 'border-slate-200 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#0A63C9]'
              } ${aberto === d.iso ? 'outline outline-2 outline-[#0A63C9]' : ''} ${d.passado && !d.sabado ? 'opacity-70' : ''}`}
            >
              <strong className="block text-[13px]">
                {d.rotulo}
                {d.hoje && <span className="ml-1 text-[10px] font-bold text-[#1c7a33]">● hoje</span>}
              </strong>
              {d.sabado ? (
                <span>—</span>
              ) : marcado ? (
                <>
                  <span className="block font-bold">✕ Sem atendimento</span>
                  <span className="block truncate">{d.motivo}</span>
                </>
              ) : (
                <span>✓ Normal</span>
              )}
            </button>
          )
        })}
      </div>

      {dia && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-[#f4f7fc] p-3">
          <p className="mb-2 text-[13.5px] font-bold">{dia.rotulo}</p>
          <div className="flex flex-wrap gap-4 text-[13px]">
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="cartao-semana"
                checked={!semAtendimento}
                onChange={() => setSemAtendimento(false)}
                className="h-4 w-4 accent-[#0A63C9]"
              />
              Atendimento normal
            </label>
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="cartao-semana"
                checked={semAtendimento}
                onChange={() => setSemAtendimento(true)}
                className="h-4 w-4 accent-[#B3261E]"
              />
              Não haverá atendimento
            </label>
          </div>
          {semAtendimento && (
            <label className="mt-2 block text-[12px] text-slate-600">
              Motivo (aparece para os profissionais e vai no aviso às famílias)
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Feriado municipal"
                className="mt-1 min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
              />
            </label>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={salvar}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            {dia.motivo !== null && (
              <Link
                href={`/lembretes?data=${dia.iso}`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-xs font-bold text-[#0A63C9]"
              >
                Avisar as famílias ›
              </Link>
            )}
          </div>
          {erro && (
            <p role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
              {erro}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
