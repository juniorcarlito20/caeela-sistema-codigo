'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Resumo = {
  area: string
  profissional: string
  periodo: string
  resumo: { total: number; realizados: number; faltas: number; justificadas: number; cancelados: number }
}

export type RelatorioFeito = {
  id: string
  tipo: string
  criadoEm: string
  autorNome: string
  comAnamnese: boolean
  podeExcluir: boolean
}

// Excluir um relatório emitido: pede confirmação e manda para a lixeira da direção (30 dias).
function ExcluirRelatorioBotao({ id }: { id: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function excluir() {
    setErro('')
    setEnviando(true)
    try {
      const r = await fetch(`/api/relatorios/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'Não consegui excluir. Tente de novo.')
        setEnviando(false)
        return
      }
      router.refresh()
    } catch {
      setErro('Não consegui excluir. Verifique a internet e tente de novo.')
      setEnviando(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#B3261E]/40 bg-white px-4 py-2 text-xs font-bold text-[#B3261E]"
      >
        🗑 Excluir
      </button>
    )
  }
  return (
    <div className="w-full rounded-lg border-[1.5px] border-[#B3261E]/40 bg-[#B3261E]/5 p-3 text-[12.5px] text-[#16243b]">
      <p>
        Excluir este relatório? Ele sai da lista e da pasta do aluno e vai para a lixeira da direção, de onde
        pode ser restaurado por 30 dias.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={excluir}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#B3261E] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Excluindo…' : 'Excluir'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
    </div>
  )
}

// Anamneses do aluno que quem está emitindo o relatório pode anexar.
export type AnamneseAnexavel = { id: string; modelo: string; data: string; autor: string }

const TIPOS = [
  { id: 'ACOMPANHAMENTO', rotulo: 'Acompanhamento' },
  { id: 'PAUSA', rotulo: 'Pausa nos atendimentos' },
  { id: 'ALTA', rotulo: 'Alta' },
] as const

const SUBTITULOS: Record<string, string> = {
  ACOMPANHAMENTO: 'DE ACOMPANHAMENTO',
  PAUSA: 'DE PAUSA NOS ATENDIMENTOS',
  ALTA: 'DE ALTA',
}

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RelatoriosAluno({
  alunoId,
  alunoNome,
  matricula,
  feitos,
  anamneses,
}: {
  alunoId: string
  alunoNome: string
  matricula: string
  feitos: RelatorioFeito[]
  anamneses: AnamneseAnexavel[]
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<string>('ACOMPANHAMENTO')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState(hojeISO())
  const [texto, setTexto] = useState('')
  const [numeros, setNumeros] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const [novoId, setNovoId] = useState<string | null>(null)
  const [comAnexo, setComAnexo] = useState(false)
  const [escolhidas, setEscolhidas] = useState<string[]>([])

  function escolherCom() {
    setComAnexo(true)
    // Já vem marcada a anamnese mais recente.
    if (escolhidas.length === 0 && anamneses[0]) setEscolhidas([anamneses[0].id])
  }
  function alternar(id: string) {
    setEscolhidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }
  const nomesAnexos = anamneses.filter((a) => escolhidas.includes(a.id)).map((a) => a.modelo)

  useEffect(() => {
    async function carregar() {
      const p = new URLSearchParams({ alunoId, inicio, fim })
      const r = await fetch(`/api/relatorios/resumo?${p.toString()}`)
      if (!r.ok) {
        setNumeros(null)
        return
      }
      setNumeros((await r.json()) as Resumo)
    }
    carregar()
  }, [alunoId, inicio, fim])

  async function gerar() {
    setErro('')
    if (texto.trim() === '') {
      setErro('Escreva o texto do relatório.')
      return
    }
    if (comAnexo && escolhidas.length === 0) {
      setErro('Marque pelo menos uma anamnese, ou escolha “Sem anamnese”.')
      return
    }
    setGerando(true)
    try {
      const r = await fetch('/api/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alunoId, tipo, texto, inicio: inicio || null, fim: fim || null,
          anamneseIds: comAnexo ? escolhidas : [],
        }),
      })
      const corpo = (await r.json()) as { erro?: string; id?: string }
      if (!r.ok || !corpo.id) {
        setErro(corpo.erro ?? 'Não consegui gerar. Tente de novo.')
        setGerando(false)
        return
      }
      setNovoId(corpo.id)
      router.refresh()
    } catch {
      setErro('Não consegui gerar. Verifique a internet e tente de novo.')
    }
    setGerando(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <label htmlFor="rel-tipo" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Tipo de relatório
            </label>
            <select
              id="rel-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rel-inicio" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Período de
              </label>
              <input
                id="rel-inicio"
                type="month"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rel-fim" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                até
              </label>
              <input
                id="rel-fim"
                type="month"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
              />
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="rel-texto" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Texto do relatório
            </label>
            <textarea
              id="rel-texto"
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva o acompanhamento, os avanços e as orientações…"
              className="min-h-[200px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-3 text-base leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <fieldset className="mb-4 rounded-lg border-[1.5px] border-slate-200 p-3">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Anamnese neste relatório
            </legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="rel-anamnese"
                  checked={!comAnexo}
                  onChange={() => setComAnexo(false)}
                  className="h-4 w-4 accent-[#0A63C9]"
                />
                Sem anamnese
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="rel-anamnese"
                  checked={comAnexo}
                  disabled={anamneses.length === 0}
                  onChange={escolherCom}
                  className="h-4 w-4 accent-[#0A63C9]"
                />
                Com anamnese
              </label>
            </div>
            {anamneses.length === 0 && (
              <p className="text-xs text-slate-500">Este aluno ainda não tem anamnese que você possa anexar.</p>
            )}
            {comAnexo && anamneses.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {anamneses.map((a) => (
                  <li key={a.id}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={escolhidas.includes(a.id)}
                        onChange={() => alternar(a.id)}
                        className="h-4 w-4 accent-[#0A63C9]"
                      />
                      <span>
                        <strong>{a.modelo}</strong>
                        <span className="text-slate-500">
                          {' '}· {new Date(a.data).toLocaleDateString('pt-BR')} · {a.autor}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {comAnexo && (
              <p className="mt-2 text-xs text-slate-500">
                As anamneses vão como anexo, depois da primeira folha. Este relatório não vai para a pasta
                Documentos: fica só em Relatórios emitidos.
              </p>
            )}
          </fieldset>
          <button
            type="button"
            disabled={gerando}
            onClick={gerar}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {gerando ? 'Gerando…' : '📄 Gerar PDF'}
          </button>
          {novoId && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/api/relatorios/${novoId}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
              >
                🖨 Imprimir
              </a>
              <a
                href={`/api/relatorios/${novoId}/pdf`}
                download
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2 text-sm font-bold text-white"
              >
                ⬇ Baixar
              </a>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {comAnexo
              ? 'Com anamnese, o PDF fica só em Relatórios emitidos (não vai para a pasta Documentos).'
              : 'O PDF fica guardado na pasta do aluno automaticamente.'}
          </p>
        </div>

        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-[11px] leading-relaxed">
            <div className="mb-2 flex items-center gap-2 border-b-2 border-[#0A63C9] pb-2">
              <Image src="/logo-caeela.png" alt="Logo do CAEELA" width={46} height={46} className="h-[46px] w-[46px] object-contain" />
              <div className="flex-1 text-center text-[9px] font-extrabold leading-snug">
                CENTRO DE ATENDIMENTO EDUCACIONAL ESPECIALIZADO
                <br />
                DE LICÍNIO DE ALMEIDA
                <br />
                <span className="font-normal">Caeel2024@gmail.com</span>
              </div>
              <Image src="/brasao-secretaria.png" alt="Demonstração" width={86} height={34} className="h-auto w-[86px] object-contain" />
            </div>
            <p className="mt-2 text-center text-[12px] font-extrabold">RELATÓRIO</p>
            <p className="mb-2 text-center text-[10px] font-bold">{SUBTITULOS[tipo]}</p>
            <p>
              <strong>Aluno:</strong> {alunoNome} · <strong>Matrícula:</strong> {matricula}
            </p>
            <p>
              <strong>Período:</strong> {numeros?.periodo ?? '…'} · <strong>Área:</strong>{' '}
              {numeros?.area ?? '…'}
            </p>
            <p className="my-2 rounded bg-[#f4f7fc] px-2 py-1.5">
              <strong>{numeros?.resumo.total ?? 0}</strong> atendimentos ·{' '}
              <strong>{numeros?.resumo.realizados ?? 0}</strong> realizados ·{' '}
              <strong>{numeros?.resumo.faltas ?? 0}</strong> faltas ·{' '}
              <strong>{numeros?.resumo.justificadas ?? 0}</strong> justificadas
              {(numeros?.resumo.cancelados ?? 0) > 0 && (
                <> · <strong>{numeros?.resumo.cancelados}</strong> cancelados pelo centro</>
              )}{' '}
              <span className="text-slate-500">(contagem automática)</span>
            </p>
            <p className="whitespace-pre-wrap text-justify">
              {texto || <span className="text-slate-400">O texto aparece aqui enquanto você escreve…</span>}
            </p>
            <div className="mt-6 flex gap-4 text-center text-[9px]">
              <div className="flex-1 border-t border-slate-400 pt-1">Responsável</div>
              <div className="flex-1 border-t border-slate-400 pt-1">Profissional Responsável</div>
            </div>
            {comAnexo && nomesAnexos.length > 0 && (
              <p className="mt-2 text-[10px] text-slate-600">
                <strong>Anexo(s):</strong> {nomesAnexos.join('; ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 className="mt-2 text-[15px] font-extrabold">Relatórios emitidos</h2>
      {feitos.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Nenhum relatório emitido ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {feitos.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <div className="min-w-[200px] flex-1">
                <p className="font-extrabold">
                  {TIPOS.find((t) => t.id === r.tipo)?.rotulo ?? r.tipo}
                  {r.comAnamnese && (
                    <span className="ml-2 rounded-full bg-[#e6f0ff] px-2 py-0.5 text-[10.5px] font-bold text-[#0A63C9]">
                      com anamnese
                    </span>
                  )}
                </p>
                <p className="text-[12.5px] text-slate-500">
                  {new Date(r.criadoEm).toLocaleDateString('pt-BR')} · {r.autorNome}
                </p>
              </div>
              <a
                href={`/api/relatorios/${r.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-xs font-bold text-[#0A63C9]"
              >
                🖨 Imprimir
              </a>
              <a
                href={`/api/relatorios/${r.id}/pdf`}
                download
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-2 text-xs font-bold text-white"
              >
                ⬇ Baixar
              </a>
              {r.podeExcluir && <ExcluirRelatorioBotao id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
