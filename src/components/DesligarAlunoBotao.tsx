'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

const MOTIVOS = [
  { id: 'ALTA', rotulo: 'Alta', ajuda: 'terminou o acompanhamento' },
  { id: 'PAUSA', rotulo: 'Pausa', ajuda: 'volta depois (dá para marcar a previsão)' },
  { id: 'DESLIGADO', rotulo: 'Desligado', ajuda: 'saiu do centro' },
] as const

// Desliga o aluno por inteiro (só a direção): encerra todos os atendimentos abertos e muda a
// situação, depois de mostrar o que vai acontecer e de pedir a confirmação.
export default function DesligarAlunoBotao({
  alunoId,
  alunoNome,
  situacao,
  atendimentos,
  horarios,
}: {
  alunoId: string
  alunoNome: string
  situacao: string
  atendimentos: { profissional: string; area: string }[]
  horarios: number
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [retorno, setRetorno] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    if (motivo === '') {
      setErro('Escolha o motivo: alta, pausa ou desligado.')
      return
    }
    setEnviando(true)
    try {
      const r = await fetch(`/api/alunos/${alunoId}/desligar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao: motivo, pausaRetomarEm: motivo === 'PAUSA' && retorno !== '' ? retorno : null }),
      })
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não foi possível desligar. Tente de novo.')
        setEnviando(false)
        return
      }
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Não foi possível desligar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#B3261E] bg-white px-4 py-2 text-sm font-bold text-[#B3261E]"
      >
        Desligar aluno
      </button>
    )
  }

  return (
    <div className="rounded-xl border-[1.5px] border-[#B3261E]/50 bg-[#B3261E]/5 p-4 text-sm text-[#16243b]">
      <p className="font-extrabold">Desligar {alunoNome.split(' ')[0]}</p>
      <fieldset className="mt-2">
        <legend className="text-[12px] font-bold text-slate-600">Motivo</legend>
        <div className="mt-1 flex flex-col gap-1">
          {MOTIVOS.filter((m) => m.id.toString() !== situacao).map((m) => (
            <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="motivo-desligar"
                checked={motivo === m.id}
                onChange={() => setMotivo(m.id)}
                className="h-4 w-4 accent-[#0A63C9]"
              />
              <span>
                <strong>{m.rotulo}</strong> <span className="text-slate-500">· {m.ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {motivo === 'PAUSA' && (
        <div className="mt-2">
          <label htmlFor="desligar-retorno" className="mb-1 block text-[12px] font-bold text-slate-600">
            Previsão de volta (opcional)
          </label>
          <input id="desligar-retorno" type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} className={classeCampo} />
        </div>
      )}
      <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-700">
        <p className="font-bold">O que vai acontecer</p>
        {atendimentos.length === 0 ? (
          <p>O aluno não tem atendimento aberto: só a situação dele muda.</p>
        ) : (
          <>
            <p>
              Encerra {atendimentos.length} {atendimentos.length === 1 ? 'atendimento' : 'atendimentos'}
              {horarios > 0 ? ` e libera ${horarios} ${horarios === 1 ? 'horário' : 'horários'} nas agendas` : ''}:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {atendimentos.map((a, i) => (
                <li key={i}>
                  {a.profissional} · {a.area}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-1 text-slate-500">
          O histórico fica guardado (evoluções, anamneses, relatórios e documentos). Cada atendimento encerrado pode ser
          desfeito depois, em “Profissionais anteriores”.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#B3261E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Desligando…' : 'Confirmar'}
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
      {erro && (
        <p role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
    </div>
  )
}
