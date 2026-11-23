'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type DadosAluno = {
  nome: string
  nascimento: string
  cpf: string
  escola: string
  serie: string
  responsavel: string
  whatsapp: string
  observacoes: string
}

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none'

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
      >
        {rotulo}
      </label>
      {children}
    </div>
  )
}

export default function EditarDadosAluno({
  alunoId,
  inicial,
}: {
  alunoId: string
  inicial: DadosAluno
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState(inicial)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function mudar(campo: keyof DadosAluno, valor: string) {
    setDados((d) => ({ ...d, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const resposta = await fetch(`/api/alunos/${alunoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    setAberto(false)
    router.refresh()
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setDados(inicial)
          setAberto(true)
        }}
        className="mb-3 inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
      >
        ✏️ Editar dados
      </button>
    )
  }

  return (
    <form onSubmit={salvar} className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-[15px] font-extrabold">Editar dados do aluno</h2>
      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]"
        >
          {erro}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Campo id="ed-nome" rotulo="Nome completo">
          <input
            id="ed-nome"
            required
            minLength={3}
            value={dados.nome}
            onChange={(e) => mudar('nome', e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-nascimento" rotulo="Data de nascimento">
          <input
            id="ed-nascimento"
            type="date"
            value={dados.nascimento}
            onChange={(e) => mudar('nascimento', e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-cpf" rotulo="CPF">
          <input
            id="ed-cpf"
            inputMode="numeric"
            value={dados.cpf}
            onChange={(e) => mudar('cpf', e.target.value)}
            placeholder="000.000.000-00"
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-escola" rotulo="Escola">
          <input
            id="ed-escola"
            value={dados.escola}
            onChange={(e) => mudar('escola', e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-serie" rotulo="Série/ano">
          <input
            id="ed-serie"
            value={dados.serie}
            onChange={(e) => mudar('serie', e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-responsavel" rotulo="Nome do responsável">
          <input
            id="ed-responsavel"
            value={dados.responsavel}
            onChange={(e) => mudar('responsavel', e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo id="ed-whatsapp" rotulo="WhatsApp">
          <input
            id="ed-whatsapp"
            inputMode="tel"
            value={dados.whatsapp}
            onChange={(e) => mudar('whatsapp', e.target.value)}
            placeholder="(77) 9____-____"
            className={classeCampo}
          />
        </Campo>
      </div>
      <div className="mt-4">
        <Campo id="ed-observacoes" rotulo="Observações">
          <textarea
            id="ed-observacoes"
            rows={3}
            value={dados.observacoes}
            onChange={(e) => mudar('observacoes', e.target.value)}
            className={classeCampo}
          />
        </Campo>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar alterações'}
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
    </form>
  )
}
