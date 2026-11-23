'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AssinaturaPad, { type AssinaturaPadRef } from '@/components/AssinaturaPad'

type Situacao = 'REALIZADO' | 'FALTOU' | 'JUSTIFICOU'

export default function RegistroPresenca({
  atendimentoId,
  vinculoId,
  data,
  hora,
  situacaoAtual,
  responsavel,
  assinadoEm,
  dispositivo,
  confirmadoEm,
  registradoPorNome,
}: {
  atendimentoId: string
  vinculoId: string
  data: string
  hora: string
  situacaoAtual: string
  responsavel: string | null
  assinadoEm: string | null
  dispositivo: string | null
  confirmadoEm: string | null
  registradoPorNome: string | null
}) {
  const router = useRouter()
  const padRef = useRef<AssinaturaPadRef>(null)
  const [situacao, setSituacao] = useState<Situacao | null>(
    situacaoAtual === 'AGENDADO' ? null : (situacaoAtual as Situacao),
  )
  const [ausente, setAusente] = useState(false)
  const [querAssinar, setQuerAssinar] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const mostraAssinatura = querAssinar && !ausente

  async function salvar() {
    setErro('')
    if (!situacao) {
      setErro('Escolha se o atendimento foi realizado, faltou ou justificou.')
      return
    }
    let assinatura: string | null = null
    if (mostraAssinatura) {
      // Opcional: se abriu e desenhou, vai junto; se ficou em branco, salva sem ela.
      assinatura = padRef.current?.imagem() ?? null
    }
    setEnviando(true)
    const resposta = await fetch(`/api/atendimentos/${atendimentoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situacao, assinatura, responsavelAusente: ausente }),
    })
    const corpo = (await resposta.json()) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    if (situacao === 'REALIZADO') {
      router.push(`/atendimento/${vinculoId}/evolucao?data=${data}&hora=${hora}`)
    } else {
      router.push('/agenda?ok=presenca')
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {confirmadoEm ? (
        <p className="rounded-lg bg-[#f4f7fc] px-3 py-2 text-[12px] text-slate-500">
          Registrado por {registradoPorNome ?? 'equipe'} em{' '}
          {new Date(confirmadoEm).toLocaleString('pt-BR')}
          {dispositivo ? ` · ${dispositivo}` : ''}
        </p>
      ) : (
        assinadoEm && (
          <p className="rounded-lg bg-[#f4f7fc] px-3 py-2 text-[12px] text-slate-500">
            Registrado em {new Date(assinadoEm).toLocaleString('pt-BR')}
            {dispositivo ? ` · ${dispositivo}` : ''}
          </p>
        )
      )}
      {erro && (
        <p role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          O atendimento aconteceu?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSituacao('REALIZADO')}
            aria-pressed={situacao === 'REALIZADO'}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold ${
              situacao === 'REALIZADO'
                ? 'bg-[#2EA84A] text-white outline outline-2 outline-offset-2 outline-[#2EA84A]'
                : 'bg-[#2EA84A] text-white opacity-70'
            }`}
          >
            ✔ Realizado
          </button>
          <button
            type="button"
            onClick={() => setSituacao('FALTOU')}
            aria-pressed={situacao === 'FALTOU'}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] px-5 py-2.5 text-sm font-bold ${
              situacao === 'FALTOU'
                ? 'border-[#0A63C9] bg-white text-[#0A63C9] outline outline-2 outline-offset-2 outline-[#0A63C9]'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            Faltou
          </button>
          <button
            type="button"
            onClick={() => setSituacao('JUSTIFICOU')}
            aria-pressed={situacao === 'JUSTIFICOU'}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold ${
              situacao === 'JUSTIFICOU'
                ? 'bg-[#F0C000] text-[#4a3c00] outline outline-2 outline-offset-2 outline-[#F0C000]'
                : 'bg-[#F0C000]/60 text-[#4a3c00]'
            }`}
          >
            Justificou
          </button>
        </div>
      </div>

      {mostraAssinatura ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Assinatura do responsável{responsavel ? ` (${responsavel})` : ''}
          </p>
          <AssinaturaPad ref={padRef} />
          <div className="mt-1 flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Assine com o dedo na tela</span>
            <button
              type="button"
              onClick={() => padRef.current?.limpar()}
              className="inline-flex min-h-[44px] items-center px-2 font-bold text-[#0A63C9]"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        !ausente && (
          <button
            type="button"
            onClick={() => setQuerAssinar(true)}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
          >
            ✍️ Colher assinatura do responsável (opcional)
          </button>
        )
      )}

      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={ausente}
          onChange={(e) => setAusente(e.target.checked)}
          className="h-5 w-5 accent-[#0A63C9]"
        />
        Responsável não está presente
      </label>

      <button
        type="button"
        disabled={enviando}
        onClick={salvar}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Salvando…' : situacao === 'REALIZADO' ? 'Salvar e escrever a evolução →' : 'Salvar presença'}
      </button>
    </div>
  )
}
