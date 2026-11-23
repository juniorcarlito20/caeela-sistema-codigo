'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { proximoTamanho, tamanhoAnterior } from '@/domain/semanas'

export type SemanaResumo = { n: number; nomes: string[] }

// Topo da agenda do profissional: abas Semana 1..N, "Não é esta a semana atual?" (a direção
// reconhece a turma e as semanas giram) e + Nova semana / Remover semana.
export default function SemanasDoProfissional({
  profissionalId,
  semanasNoCiclo,
  semanaVista,
  semanaAtual,
  semanas,
  editavel,
  caminhoBase,
}: {
  profissionalId: string
  semanasNoCiclo: number
  semanaVista: number
  semanaAtual: number
  semanas: SemanaResumo[]
  editavel: boolean
  caminhoBase?: string
}) {
  const router = useRouter()
  const [escolhendo, setEscolhendo] = useState(false)
  const [confirmando, setConfirmando] = useState<'adicionar' | 'remover' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [bloqueados, setBloqueados] = useState<string[]>([])
  const [aviso, setAviso] = useState('')

  const proxima = proximoTamanho(semanasNoCiclo)
  const anterior = tamanhoAnterior(semanasNoCiclo)
  const base = caminhoBase ?? `/profissionais/${profissionalId}?aba=agenda`
  const voltarParaAgenda = () => {
    router.replace(`/profissionais/${profissionalId}?aba=agenda`)
    router.refresh()
  }

  async function marcarAtual(n: number) {
    setEnviando(true)
    setErro('')
    setAviso('')
    const resposta = await fetch(`/api/profissionais/${profissionalId}/semana-atual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semana: n }),
    })
    setEnviando(false)
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; conflitosCriados?: number }
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível acertar a semana.')
      return
    }
    if (corpo.conflitosCriados) {
      setAviso(
        corpo.conflitosCriados === 1
          ? 'Atenção: com essa semana, 1 horário passou a bater com outro.'
          : `Atenção: com essa semana, ${corpo.conflitosCriados} horários passaram a bater com outros.`,
      )
    }
    setEscolhendo(false)
    voltarParaAgenda()
  }

  async function mudarTamanho(acao: 'adicionar' | 'remover') {
    setEnviando(true)
    setErro('')
    setBloqueados([])
    const resposta = await fetch(`/api/profissionais/${profissionalId}/semanas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    })
    setEnviando(false)
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; bloqueados?: string[] }
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível mudar as semanas.')
      setBloqueados(corpo.bloqueados ?? [])
      return
    }
    setConfirmando(null)
    voltarParaAgenda()
  }

  const explicacao =
    confirmando === 'adicionar'
      ? semanasNoCiclo === 1
        ? 'A Semana 2 nasce igual à Semana 1 (todos nas duas). Depois é só tirar da Semana 2 quem não vem nela: quem ficar numa semana só vira quinzenal.'
        : 'As Semanas 3 e 4 nascem iguais às Semanas 1 e 2. Depois é só tirar quem não vem: quem ficar numa semana só vira mensal.'
      : semanasNoCiclo === 4
        ? 'A agenda volta para 2 semanas. Só dá se ninguém depender das Semanas 3 e 4 (nenhum mensal).'
        : 'A agenda volta para 1 semana (todos toda semana). Só dá se todos estiverem nas duas semanas.'

  return (
    <div className="mb-3">
      {semanasNoCiclo > 1 && (
        <div className="flex flex-wrap gap-2">
          {semanas.map((s) => {
            const ativa = s.n === semanaVista
            return (
              <Link
                key={s.n}
                href={`${base}${base.includes('?') ? '&' : '?'}semana=${s.n}`}
                scroll={false}
                className={`rounded-lg border-[1.5px] px-3 py-1.5 ${
                  ativa ? 'border-[#0A63C9] bg-[#e6f0ff]' : 'border-slate-200 bg-white hover:border-[#0A63C9]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <strong className={`text-[13px] ${ativa ? 'text-[#0A63C9]' : 'text-slate-800'}`}>Semana {s.n}</strong>
                  {s.n === semanaAtual && (
                    <span className="rounded-full bg-[#e4f6e8] px-1.5 py-0.5 text-[10px] font-bold text-[#1c7a33]">● agora</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {editavel && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {semanasNoCiclo > 1 && (
            <button type="button" onClick={() => setEscolhendo((v) => !v)} className="min-h-[36px] font-bold text-[#0A63C9]">
              {escolhendo ? 'Fechar' : 'Não é esta a semana atual? Escolher'}
            </button>
          )}
          {proxima && (
            <button type="button" onClick={() => setConfirmando('adicionar')} className="min-h-[36px] font-bold text-[#0A63C9]">
              + Nova semana
            </button>
          )}
          {anterior && (
            <button type="button" onClick={() => setConfirmando('remover')} className="min-h-[36px] font-bold text-slate-500">
              Remover semana
            </button>
          )}
        </div>
      )}

      {escolhendo && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-[#f4f7fc] p-3">
          <p className="mb-2 text-[12.5px] text-slate-600">
            Qual destas turmas vem <strong>esta semana</strong>? Toque nela. (Aparece só quem não vem toda semana.)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {semanas.map((s) => (
              <button
                key={s.n}
                type="button"
                disabled={enviando}
                onClick={() => marcarAtual(s.n)}
                className="rounded-lg border-[1.5px] border-slate-200 bg-white p-2 text-left hover:border-[#0A63C9] disabled:opacity-60"
              >
                <strong className="text-[13px]">Semana {s.n}</strong>
                <span className="mt-0.5 block text-[12px] text-slate-600">
                  {s.nomes.length > 0 ? s.nomes.join(', ') : 'só quem vem toda semana'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmando && (
        <div className="mt-2 rounded-xl border-[1.5px] border-[#0A63C9] bg-[#e6f0ff] p-3">
          <p className="text-[13px] text-[#0A63C9]">{explicacao}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={() => mudarTamanho(confirmando)}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {enviando ? 'Salvando…' : confirmando === 'adicionar' ? 'Criar semana' : 'Remover semana'}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => {
                setConfirmando(null)
                setErro('')
                setBloqueados([])
              }}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
          <p>{erro}</p>
          {bloqueados.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-normal text-slate-700">
              {bloqueados.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {aviso && (
        <p role="status" className="mt-2 text-xs font-bold text-[#8a6100]">
          {aviso}{' '}
          <Link href="/conflitos" className="text-[#0A63C9] underline">
            Ver quais são
          </Link>
        </p>
      )}
    </div>
  )
}
