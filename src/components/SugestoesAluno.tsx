'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CartaoSugestao from './CartaoSugestao'
import { LIMITE_TEXTO, TIPOS_SUGESTAO, validarNovaSugestao, type SugestaoTela, type TipoSugestao } from '@/domain/sugestoes'

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

// Aba "Sugestões" da ficha do aluno. O profissional vê as próprias sugestões e abre o formulário;
// a direção vê todas as do aluno, com os botões nas pendentes.
export default function SugestoesAluno({
  alunoId, alunoNome, areas, podeSugerir, ehDirecao, sugestoes,
}: {
  alunoId: string
  alunoNome: string
  areas: { id: string; nome: string }[]
  podeSugerir: boolean
  ehDirecao: boolean
  sugestoes: SugestaoTela[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoSugestao>('PROFISSIONAL_DO_CENTRO')
  const [areaId, setAreaId] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar() {
    setErro('')
    // As mesmas regras do servidor (src/domain/sugestoes.ts): a tela não deixa passar nada
    // que a rota recusaria.
    const recusa = validarNovaSugestao({ tipo, areaId, texto })
    if (recusa) {
      setErro(recusa)
      return
    }
    setEnviando(true)
    try {
      const resposta = await fetch('/api/sugestoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunoId, tipo, areaId: tipo === 'PROFISSIONAL_DO_CENTRO' ? areaId : null, texto }),
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'Não foi possível enviar. Tente de novo.')
        return
      }
      setAberto(false)
      setTexto('')
      setAreaId('')
      setTipo('PROFISSIONAL_DO_CENTRO')
    } catch {
      setErro('Não foi possível enviar. Verifique a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {podeSugerir && !aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex min-h-[44px] items-center justify-center self-start rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
        >
          + Nova sugestão
        </button>
      )}

      {podeSugerir && aberto && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-[15px] font-extrabold">Nova sugestão · {alunoNome}</h2>
          <p className="mb-1 text-sm font-bold text-slate-700">O que você sugere?</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo da sugestão">
            {TIPOS_SUGESTAO.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border-[1.5px] p-3 text-sm ${
                  tipo === t.id ? 'border-[#0A63C9] bg-[#e6f0ff]' : 'border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="tipo-sugestao"
                  checked={tipo === t.id}
                  onChange={() => setTipo(t.id)}
                  className="mt-1 h-4 w-4 accent-[#0A63C9]"
                />
                <span>
                  <strong>{t.rotulo}</strong>
                  <br />
                  <span className="text-[12px] text-slate-500">{t.ajuda}</span>
                </span>
              </label>
            ))}
          </div>
          {tipo === 'PROFISSIONAL_DO_CENTRO' && (
            <div className="mt-3">
              <label htmlFor="sug-area" className="mb-1 block text-sm font-bold text-slate-700">
                Qual área?
              </label>
              <select id="sug-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={classeCampo}>
                <option value="">Escolha…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-3">
            <label htmlFor="sug-texto" className="mb-1 block text-sm font-bold text-slate-700">
              Explique em poucas linhas
            </label>
            <textarea
              id="sug-texto"
              rows={4}
              maxLength={LIMITE_TEXTO}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-[96px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={enviar}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviar à direção'}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => { setAberto(false); setErro('') }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold text-slate-500"
            >
              Cancelar
            </button>
            <span className="text-xs text-slate-500">🔒 Só você e a direção veem esta sugestão.</span>
          </div>
          {erro && (
            <p role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
              {erro}
            </p>
          )}
        </div>
      )}

      {sugestoes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {ehDirecao ? 'Nenhuma sugestão sobre este aluno.' : `Você ainda não fez nenhuma sugestão sobre ${alunoNome}.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sugestoes.map((s) => (
            <CartaoSugestao key={s.id} s={s} mostrarAluno={false} comAcoes={ehDirecao} />
          ))}
        </ul>
      )}
      {!ehDirecao && (
        <p className="text-xs text-slate-500">🔒 Você vê apenas as sugestões feitas por você.</p>
      )}
    </div>
  )
}
