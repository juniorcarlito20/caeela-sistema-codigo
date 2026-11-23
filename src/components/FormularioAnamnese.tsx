'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { agruparPorSecao, validarRespostas, type Campo } from '@/domain/anamnese'
import ResumoEscala from './ResumoEscala'
import ResultadoImc from './ResultadoImc'
import QuadroResultadoEscala from './QuadroResultadoEscala'

const classeCampo =
  'min-h-[56px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-3 text-base text-slate-800 focus:border-[#0A63C9] focus:outline-none'

function CampoResposta({
  campo,
  valor,
  aoMudar,
}: {
  campo: Campo
  valor: string
  aoMudar: (v: string) => void
}) {
  const id = `campo-${campo.id}`
  if (campo.tipo === 'textarea') {
    return (
      <textarea
        id={id}
        rows={3}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeCampo}
      />
    )
  }
  if (campo.tipo === 'data') {
    return (
      <input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeCampo}
      />
    )
  }
  if (campo.tipo === 'sim_nao') {
    const opcoes = ['Sim', 'Não', 'Não informado']
    return (
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => aoMudar(valor === o ? '' : o)}
            aria-pressed={valor === o}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold ${
              valor === o
                ? 'bg-[#2EA84A] text-white outline outline-2 outline-offset-2 outline-[#2EA84A]'
                : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'escala') {
    return (
      <div role="group" aria-labelledby={`rotulo-${campo.id}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(campo.opcoes ?? []).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => aoMudar(valor === o ? '' : o)}
            aria-pressed={valor === o}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm font-bold ${
              valor === o
                ? 'bg-[#0A63C9] text-white outline outline-2 outline-offset-2 outline-[#0A63C9]'
                : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'escolha') {
    return (
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={classeCampo}>
        <option value="">Escolha…</option>
        {(campo.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      id={id}
      type="text"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      className={classeCampo}
    />
  )
}

export default function FormularioAnamnese({
  alunoId,
  modeloId,
  modeloNome,
  campos,
  anamneseInicial,
  respostasIniciais,
}: {
  alunoId: string
  modeloId: string
  modeloNome: string
  campos: Campo[]
  anamneseInicial: string | null
  respostasIniciais: Record<string, string>
}) {
  const router = useRouter()
  const secoes = agruparPorSecao(campos)
  const [secao, setSecao] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>(respostasIniciais)
  const [anamneseId, setAnamneseId] = useState<string | null>(anamneseInicial)
  const [erros, setErros] = useState<string[]>([])
  const [status, setStatus] = useState(
    anamneseInicial ? 'Rascunho aberto.' : 'Ainda não salvo.',
  )
  const [salvando, setSalvando] = useState(false)

  const atual = secoes[secao]
  const preenchidos = (camposSecao: Campo[]) =>
    camposSecao.filter((c) => (respostas[c.id] ?? '').trim() !== '').length

  function definir(id: string, valor: string) {
    setRespostas((r) => ({ ...r, [id]: valor }))
  }

  async function persistir(todas: Record<string, string>): Promise<boolean> {
    const problemas = validarRespostas(campos, todas)
    if (problemas.length > 0) {
      setErros(problemas.slice(0, 3))
      return false
    }
    setSalvando(true)
    try {
      if (anamneseId) {
        const r = await fetch(`/api/anamneses/${anamneseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respostas: todas }),
        })
        if (!r.ok) {
          const corpo = (await r.json()) as { erro?: string }
          setErros([corpo.erro ?? 'Não consegui salvar. Tente de novo.'])
          setSalvando(false)
          return false
        }
      } else {
        const r = await fetch('/api/anamneses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alunoId, modeloId, respostas: todas }),
        })
        const corpo = (await r.json()) as { erro?: string; id?: string }
        if (!r.ok || !corpo.id) {
          setErros([corpo.erro ?? 'Não consegui salvar. Tente de novo.'])
          setSalvando(false)
          return false
        }
        setAnamneseId(corpo.id)
        router.replace(`/alunos/${alunoId}/anamnese/${modeloId}?a=${corpo.id}`, { scroll: false })
      }
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setStatus(`Rascunho salvo às ${hora}.`)
      setErros([])
      setSalvando(false)
      return true
    } catch {
      setErros(['Não consegui salvar. Verifique a internet e tente de novo.'])
      setSalvando(false)
      return false
    }
  }

  async function irPara(nova: number) {
    if (nova < 0 || nova >= secoes.length) return
    const problemas = validarRespostas(atual.campos, respostas)
    if (problemas.length > 0) {
      setErros(problemas.slice(0, 3))
      return
    }
    setErros([])
    await persistir(respostas)
    setSecao(nova)
    window.scrollTo({ top: 0 })
  }

  async function rascunho() {
    await persistir(respostas)
  }

  function voltarFicha() {
    router.push(`/alunos/${alunoId}?aba=anamnese`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[13px] text-slate-500">
          Modelo: <strong>{modeloNome}</strong> · {status}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {secoes.map((s, i) => {
            const n = preenchidos(s.campos)
            return (
              <button
                key={s.secao}
                type="button"
                onClick={() => irPara(i)}
                className={`inline-flex min-h-[44px] items-center rounded-full px-3 py-2 font-bold ${
                  i === secao
                    ? 'bg-[#0A63C9] text-white'
                    : n > 0
                      ? 'bg-[#e4f6e8] text-[#1c7a33]'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1} · {s.secao}
                {n > 0 ? ` (${n})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      <QuadroResultadoEscala campos={campos} respostas={respostas} />

      {erros.length > 0 && (
        <div role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erros.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-[15px] font-extrabold">
          {secao + 1} · {atual.secao}
        </h2>
        <div className="flex flex-col gap-4">
          {atual.campos.map((c) =>
            c.tipo === 'resumo' ? (
              <ResumoEscala key={c.id} campos={campos} respostas={respostas} campo={c} />
            ) : c.tipo === 'imc' ? (
              <ResultadoImc key={c.id} campo={c} respostas={respostas} />
            ) : c.tipo === 'aviso' ? (
              <p key={c.id} className="rounded-lg border border-slate-200 bg-[#f4f7fc] px-3 py-2 text-[13px] text-slate-600">
                {c.rotulo}
              </p>
            ) : (
              <div key={c.id}>
                {c.tipo === 'escala' ? (
                  <p id={`rotulo-${c.id}`} className="mb-1 block text-sm font-bold text-slate-700">
                    {c.rotulo}
                  </p>
                ) : (
                  <label htmlFor={`campo-${c.id}`} className="mb-1 block text-sm font-bold text-slate-700">
                    {c.rotulo}
                  </label>
                )}
                <CampoResposta campo={c} valor={respostas[c.id] ?? ''} aoMudar={(v) => definir(c.id, v)} />
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={secao === 0 || salvando}
          onClick={() => irPara(secao - 1)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2.5 text-sm font-bold text-[#0A63C9] disabled:opacity-40"
        >
          ← Seção anterior
        </button>
        <button
          type="button"
          disabled={secao >= secoes.length - 1 || salvando}
          onClick={() => irPara(secao + 1)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {salvando ? 'Salvando…' : 'Próxima seção →'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={rascunho}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          onClick={voltarFicha}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold text-slate-500"
        >
          Voltar à ficha
        </button>
      </div>
      <p className="text-xs text-slate-500">🔒 Só você e a direção veem esta anamnese.</p>
    </div>
  )
}
