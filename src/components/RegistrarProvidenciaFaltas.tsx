'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

const TIPOS = [
  { id: 'CONTATO_FAMILIA', rotulo: 'Contato com a família' },
  { id: 'ASSISTENCIA_SOCIAL', rotulo: 'Acionou a assistência social' },
  { id: 'OUTRA', rotulo: 'Outra' },
] as const

const MAXIMO = 300

// A direção registra o que fez diante das faltas seguidas de um aluno. Ao confirmar, o aviso
// sai da lista e a contagem recomeça (volta sozinho se houver novas faltas seguidas).
export default function RegistrarProvidenciaFaltas({
  alunoId,
  alunoNome,
}: {
  alunoId: string
  alunoNome: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    if (tipo === '') {
      setErro('Escolha o que foi feito.')
      return
    }
    setEnviando(true)
    try {
      const r = await fetch(`/api/alunos/${alunoId}/providencia-faltas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, observacao: observacao.trim() }),
      })
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não foi possível registrar. Tente de novo.')
        setEnviando(false)
        return
      }
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Não foi possível registrar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
      >
        Registrar providência
      </button>
    )
  }

  return (
    <div className="min-w-[260px] rounded-xl border-[1.5px] border-[#0A63C9]/40 bg-[#e6f0ff]/40 p-4 text-sm text-[#16243b]">
      <p className="font-extrabold">Providência: {alunoNome.split(' ')[0]}</p>
      <fieldset className="mt-2">
        <legend className="text-[12px] font-bold text-slate-600">O que foi feito</legend>
        <div className="mt-1 flex flex-col gap-1">
          {TIPOS.map((t) => (
            <label key={t.id} className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`providencia-${alunoId}`}
                checked={tipo === t.id}
                onChange={() => setTipo(t.id)}
                className="h-4 w-4 accent-[#0A63C9]"
              />
              <span className="font-bold">{t.rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-2">
        <label htmlFor={`providencia-obs-${alunoId}`} className="mb-1 block text-[12px] font-bold text-slate-600">
          Observação (opcional)
        </label>
        <textarea
          id={`providencia-obs-${alunoId}`}
          rows={2}
          maxLength={MAXIMO}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={classeCampo}
        />
        <p className="mt-0.5 text-right text-[11.5px] text-slate-500">
          {observacao.length}/{MAXIMO}
        </p>
      </div>
      <p className="mt-1 text-[12.5px] text-slate-500">
        O aviso sai da lista e a contagem recomeça. Ele volta sozinho se houver duas novas faltas seguidas.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Registrando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-60"
        >
          Cancelar
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
