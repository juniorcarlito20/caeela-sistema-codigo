'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

// Atendimento que não está nos horários fixos (reposição): escolhe a criança e a hora e segue para o registro.
export default function LancarForaDaAgenda({
  dia,
  opcoes,
}: {
  dia: string
  opcoes: { vinculoId: string; rotulo: string }[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [vinculoId, setVinculoId] = useState('')
  const [hora, setHora] = useState('')
  const [erro, setErro] = useState('')

  function continuar() {
    if (vinculoId === '') {
      setErro('Escolha a criança.')
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      setErro('Informe a hora do atendimento.')
      return
    }
    setErro('')
    router.push(`/atendimento/${vinculoId}?data=${dia}&hora=${hora}`)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
      >
        + Lançar atendimento fora da agenda
      </button>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="font-bold">Atendimento fora da agenda</p>
      <label className="flex flex-col gap-1 text-[13px] font-bold text-slate-600">
        Criança
        <select value={vinculoId} onChange={(e) => setVinculoId(e.target.value)} className={classeCampo}>
          <option value="">Escolha…</option>
          {opcoes.map((o) => (
            <option key={o.vinculoId} value={o.vinculoId}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-bold text-slate-600">
        Hora
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={classeCampo} />
      </label>
      {erro && (
        <p role="alert" className="text-[13px] font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={continuar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-sm font-bold text-white"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
