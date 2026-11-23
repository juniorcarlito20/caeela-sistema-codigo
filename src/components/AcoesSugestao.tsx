'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LIMITE_OBSERVACAO } from '@/domain/sugestoes'

const classeBotao =
  'inline-flex min-h-[40px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold'

// Os botões da direção numa sugestão pendente: abrir a ficha para encaminhar (só no tipo do
// centro), marcar como resolvida e descartar. Resolver e descartar abrem uma caixa para a
// observação (opcional), que o profissional passa a ver.
export default function AcoesSugestao({ sugestaoId, linkFicha }: { sugestaoId: string; linkFicha?: string }) {
  const router = useRouter()
  const [acao, setAcao] = useState<'resolver' | 'descartar' | null>(null)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Trocar de ação limpa a observação: o que foi escrito para resolver não vira
  // observação de descarte. Clicar no mesmo botão de novo não apaga o que já foi escrito.
  function escolher(nova: 'resolver' | 'descartar') {
    if (nova !== acao) setObservacao('')
    setAcao(nova)
    setErro('')
  }

  async function salvar() {
    if (!acao) return
    setSalvando(true)
    setErro('')
    try {
      const resposta = await fetch(`/api/sugestoes/${sugestaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, observacao }),
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
        return
      }
      setAcao(null)
    } catch {
      setErro('Não foi possível salvar. Verifique a internet e tente de novo.')
    } finally {
      setSalvando(false)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {linkFicha && (
          <Link href={linkFicha} className={`${classeBotao} bg-[#0A63C9] text-white`}>
            Abrir ficha para encaminhar
          </Link>
        )}
        <button
          type="button"
          onClick={() => escolher('resolver')}
          className={`${classeBotao} bg-[#2EA84A] text-white`}
        >
          Marcar como resolvida
        </button>
        <button
          type="button"
          onClick={() => escolher('descartar')}
          className={`${classeBotao} border-[1.5px] border-slate-400 bg-white text-slate-600`}
        >
          Descartar
        </button>
      </div>
      {acao && (
        <div className="rounded-lg border border-slate-200 bg-[#f4f7fc] p-3">
          <label htmlFor={`obs-${sugestaoId}`} className="mb-1 block text-xs font-bold text-slate-700">
            Observação para quem sugeriu (opcional)
          </label>
          <textarea
            id={`obs-${sugestaoId}`}
            rows={3}
            maxLength={LIMITE_OBSERVACAO}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="min-h-[74px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={salvar}
              className={`${classeBotao} ${acao === 'resolver' ? 'bg-[#2EA84A]' : 'bg-slate-600'} text-white disabled:opacity-60`}
            >
              {salvando ? 'Salvando…' : acao === 'resolver' ? 'Salvar como resolvida' : 'Salvar como descartada'}
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => { setAcao(null); setErro('') }}
              className={`${classeBotao} border-[1.5px] border-slate-300 bg-white text-slate-600`}
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
      )}
    </div>
  )
}
