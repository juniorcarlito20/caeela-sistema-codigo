'use client'

import { useState } from 'react'
import { prepararLembrete } from '@/components/LembretesAcoes'

type Pendente = { vinculoId: string; hora: string; aluno: string }

// Fila de lembretes de um profissional: um toque por família, sem procurar ninguém.
// O WhatsApp só abre a partir de um toque, então o sistema não envia sozinho.
// Não recarrega a página entre uma família e outra (perderia a fila).
export default function FilaLembretes({
  profissional,
  pendentes,
  semZap,
  diaISO,
  aviso = false,
}: {
  profissional: string // primeiro nome
  pendentes: Pendente[]
  semZap: number
  diaISO: string
  aviso?: boolean
}) {
  const [aberta, setAberta] = useState(false)
  const [indice, setIndice] = useState(0)
  const [abertos, setAbertos] = useState(0)
  const [preparando, setPreparando] = useState(false)
  const [erro, setErro] = useState('')

  const total = pendentes.length
  const terminou = aberta && indice >= total
  const atual = pendentes[indice]

  function recarregar() {
    window.location.reload()
  }

  function iniciar() {
    setIndice(0)
    setAbertos(0)
    setErro('')
    setAberta(true)
  }

  function pular() {
    setErro('')
    setIndice((i) => i + 1)
  }

  async function abrirWhatsApp() {
    if (!atual) return
    setErro('')
    setPreparando(true)
    const r = await prepararLembrete(atual.vinculoId, diaISO, atual.hora)
    setPreparando(false)
    if (!r.link) {
      setErro(r.erro ?? 'Não consegui preparar. Tente de novo.')
      return
    }
    window.open(r.link, '_blank', 'noopener')
    setAbertos((n) => n + 1)
    setIndice((i) => i + 1)
  }

  if (!aberta) {
    return (
      <div className="flex flex-col items-stretch gap-1">
        <button
          type="button"
          onClick={iniciar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2 text-sm font-bold text-white"
        >
          {aviso
            ? `📲 Avisar famílias de ${profissional} (${total})`
            : `📲 Enviar lembretes de ${profissional} (${total})`}
        </button>
        {semZap > 0 && (
          <p className="text-xs text-slate-500">{semZap} sem WhatsApp: cadastre o número na lista abaixo.</p>
        )}
      </div>
    )
  }

  if (terminou) {
    return (
      <div className="flex flex-col items-stretch gap-2 rounded-xl border border-[#2EA84A]/40 bg-[#e4f6e8] p-3">
        <p className="text-sm font-bold text-[#1c7a33]">
          Pronto! {abertos} {abertos === 1 ? 'lembrete aberto' : 'lembretes abertos'}.
        </p>
        <button
          type="button"
          onClick={recarregar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-sm font-bold text-white"
        >
          Fechar
        </button>
      </div>
    )
  }

  const primeiroNomeAluno = atual.aluno.trim().split(/\s+/)[0] ?? atual.aluno

  return (
    <div className="flex flex-col items-stretch gap-2 rounded-xl border border-slate-200 bg-[#f4f7fc] p-3">
      <p className="text-[13px] font-bold text-slate-700">
        {indice + 1} de {total} · {atual.aluno} às {atual.hora}
      </p>
      <button
        type="button"
        disabled={preparando}
        onClick={abrirWhatsApp}
        className="inline-flex min-h-[52px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-3 text-base font-bold text-white disabled:opacity-60"
      >
        {preparando ? 'Preparando…' : erro ? '📲 Tentar de novo' : `📲 Abrir WhatsApp de ${primeiroNomeAluno}`}
      </button>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
      <p className="text-xs text-slate-500">Envie a mensagem no WhatsApp, volte para esta tela e toque no próximo.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={preparando}
          onClick={pular}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
        >
          Pular
        </button>
        <button
          type="button"
          onClick={recarregar}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border-[1.5px] border-[#B3261E] bg-white px-4 py-2 text-sm font-bold text-[#B3261E]"
        >
          Parar
        </button>
      </div>
    </div>
  )
}
