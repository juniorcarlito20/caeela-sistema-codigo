'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function Campo({
  id,
  rotulo,
  children,
  opcional,
}: {
  id: string
  rotulo: string
  children: React.ReactNode
  opcional?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
      >
        {rotulo}{' '}
        {opcional && <span className="font-normal normal-case">(opcional)</span>}
      </label>
      {children}
    </div>
  )
}

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none'

export default function FormularioAluno() {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const encaminhar = submitter?.value === 'encaminhar'
    const dados = new FormData(e.currentTarget)
    const corpo: Record<string, string> = {}
    for (const [chave, valor] of dados.entries()) {
      if (chave === 'acao') continue
      corpo[chave] = String(valor)
    }
    const resposta = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    const resultado = (await resposta.json()) as { erro?: string; id?: string }
    setEnviando(false)
    if (!resposta.ok || !resultado.id) {
      setErro(resultado.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    router.push(encaminhar ? `/agendas?aluno=${resultado.id}` : `/alunos/${resultado.id}`)
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo id="nome" rotulo="Nome completo">
            <input
              id="nome"
              name="nome"
              required
              minLength={3}
              placeholder="Ex.: Pedro Nunes da Silva"
              className={classeCampo}
            />
          </Campo>
          <Campo id="nascimento" rotulo="Data de nascimento" opcional>
            <input id="nascimento" name="nascimento" type="date" className={classeCampo} />
          </Campo>
          <Campo id="cpf" rotulo="CPF" opcional>
            <input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              className={classeCampo}
            />
          </Campo>
          <Campo id="escola" rotulo="Escola" opcional>
            <input
              id="escola"
              name="escola"
              placeholder="Escolha ou digite"
              className={classeCampo}
            />
          </Campo>
          <Campo id="serie" rotulo="Série/ano" opcional>
            <input id="serie" name="serie" placeholder="Ex.: 2º ano" className={classeCampo} />
          </Campo>
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Situação
            </span>
            <p className="min-h-[44px] rounded-lg bg-[#f4f7fc] px-3 py-2.5 text-sm font-bold text-slate-700">
              Lista de espera
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-[15px] font-extrabold">Responsável</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo id="responsavel" rotulo="Nome do responsável" opcional>
            <input
              id="responsavel"
              name="responsavel"
              placeholder="Ex.: Cláudia Nunes"
              className={classeCampo}
            />
          </Campo>
          <Campo id="whatsapp" rotulo="WhatsApp" opcional>
            <input
              id="whatsapp"
              name="whatsapp"
              inputMode="tel"
              placeholder="(77) 9____-____"
              className={classeCampo}
            />
          </Campo>
        </div>
        <div className="mt-4">
          <Campo id="observacoes" rotulo="Observações" opcional>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={3}
              placeholder="Ex.: chega sempre acompanhado da avó"
              className={classeCampo}
            />
          </Campo>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="acao"
          value="ficha"
          disabled={enviando}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar aluno'}
        </button>
        <button
          type="submit"
          name="acao"
          value="encaminhar"
          disabled={enviando}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-5 py-2.5 text-sm font-bold text-[#0A63C9] disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar e encaminhar a um profissional →'}
        </button>
      </div>
    </form>
  )
}
