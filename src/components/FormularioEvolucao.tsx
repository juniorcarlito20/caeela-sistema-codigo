'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'min-h-[56px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none'

export default function FormularioEvolucao({
  atendimentoId,
  alunoId,
  inicial,
}: {
  atendimentoId: string
  alunoId: string
  inicial: {
    id: string
    atividade: string
    objetivo: string
    observacoes: string | null
  } | null
}) {
  const router = useRouter()
  const [atividade, setAtividade] = useState(inicial?.atividade ?? '')
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '')
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    setErro('')
    if (atividade.trim() === '') {
      setErro('Descreva a atividade.')
      return
    }
    if (objetivo.trim() === '') {
      setErro('Descreva o objetivo.')
      return
    }
    setEnviando(true)
    const corpo = JSON.stringify({ atividade, objetivo, observacoes })
    const resposta = inicial
      ? await fetch(`/api/evolucoes/${inicial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: corpo,
        })
      : await fetch('/api/evolucoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atendimentoId, atividade, objetivo, observacoes }),
        })
    const resultado = (await resposta.json()) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    router.push(`/alunos/${alunoId}?aba=evolucao`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {erro && (
        <p role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div>
        <label
          htmlFor="ev-atividade"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
        >
          Atividade
        </label>
        <textarea
          id="ev-atividade"
          rows={3}
          value={atividade}
          onChange={(e) => setAtividade(e.target.value)}
          placeholder="Ex.: Jogo da casinha"
          className={classeCampo}
        />
      </div>
      <div>
        <label
          htmlFor="ev-objetivo"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
        >
          Objetivo
        </label>
        <textarea
          id="ev-objetivo"
          rows={3}
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Ex.: Estimular perguntas e respostas"
          className={classeCampo}
        />
      </div>
      <div>
        <label
          htmlFor="ev-observacoes"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
        >
          Observações <span className="font-normal normal-case">(opcional)</span>
        </label>
        <textarea
          id="ev-observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="O que mais você observou"
          className={classeCampo}
        />
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3">
        <button
          type="button"
          disabled={enviando}
          onClick={salvar}
          className="mx-auto flex min-h-[44px] w-full max-w-[560px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar evolução'}
        </button>
      </div>
    </div>
  )
}
