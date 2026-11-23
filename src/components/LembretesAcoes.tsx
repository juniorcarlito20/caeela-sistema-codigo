'use client'

import { useState } from 'react'

// Prepara o lembrete de uma família: garante o atendimento do dia e pede o link do WhatsApp com a
// mensagem pronta. Não abre nada nem recarrega a página: quem chama decide.
export async function prepararLembrete(
  vinculoId: string,
  diaISO: string,
  hora: string,
): Promise<{ link?: string; erro?: string }> {
  try {
    const g = await fetch('/api/atendimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vinculoId, data: diaISO, hora }),
    })
    const gg = (await g.json()) as { erro?: string; id?: string }
    if (!g.ok || !gg.id) return { erro: gg.erro ?? 'Não consegui preparar. Tente de novo.' }
    const r = await fetch('/api/lembretes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atendimentoId: gg.id }),
    })
    const corpo = (await r.json()) as { erro?: string; link?: string }
    if (!r.ok || !corpo.link) return { erro: corpo.erro ?? 'Não consegui preparar. Tente de novo.' }
    return { link: corpo.link }
  } catch {
    return { erro: 'Não consegui enviar. Verifique a internet e tente de novo.' }
  }
}

export function BotaoEnviar({
  vinculoId,
  diaISO,
  hora,
  aviso = false,
}: {
  vinculoId: string
  diaISO: string
  hora: string
  aviso?: boolean
}) {
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setErro('')
    setEnviando(true)
    const r = await prepararLembrete(vinculoId, diaISO, hora)
    if (!r.link) {
      setErro(r.erro ?? 'Não consegui preparar. Tente de novo.')
      setEnviando(false)
      return
    }
    window.open(r.link, '_blank', 'noopener')
    window.location.reload()
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={enviar}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Preparando…' : aviso ? '📲 Avisar' : '📲 Enviar'}
      </button>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}

export function NumeroForm({ alunoId, atual, rotulo = '+ Adicionar número' }: { alunoId: string; atual: string | null; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const [numero, setNumero] = useState(atual ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      const r = await fetch(`/api/alunos/${alunoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: numero }),
      })
      const corpo = (await r.json()) as { erro?: string }
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não consegui salvar. Tente de novo.')
        setSalvando(false)
        return
      }
      window.location.reload()
    } catch {
      setErro('Não consegui salvar. Verifique a internet e tente de novo.')
    }
    setSalvando(false)
  }

  if (!aberto) {
    const discreto = rotulo !== '+ Adicionar número'
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={discreto ? 'inline-flex min-h-[32px] items-center px-1 text-xs font-bold text-[#0A63C9] underline' : 'inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]'}
      >
        {rotulo}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="(77) 9____-____"
          aria-label="WhatsApp do responsável"
          className="min-h-[44px] w-40 rounded-lg border-[1.5px] border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        <button
          type="button"
          disabled={salvando}
          onClick={salvar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {salvando ? '…' : 'Salvar'}
        </button>
      </div>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
    </div>
  )
}
