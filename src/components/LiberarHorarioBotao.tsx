'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

// Tira o aluno deste horário sem encerrar o atendimento: ele continua com o profissional,
// "aguardando horário". O horário vai para a Lixeira (dá para restaurar).
export default function LiberarHorarioBotao({
  horarioId,
  alunoNome,
  diaSemana,
  hora,
  aoLiberar,
}: {
  horarioId: string
  alunoNome: string
  diaSemana: number
  hora: string
  aoLiberar?: () => void
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function liberar() {
    setEnviando(true)
    setErro('')
    const resposta = await fetch(`/api/horarios/${horarioId}`, { method: 'DELETE' })
    setEnviando(false)
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível liberar o horário.')
      return
    }
    setConfirmando(false)
    aoLiberar?.()
    router.refresh()
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
      >
        Liberar horário
      </button>
    )
  }
  return (
    <div className="w-full rounded-lg border-[1.5px] border-[#8a6100] bg-[#fff6d6] p-2 text-[12.5px] text-[#8a6100]">
      <p>
        Liberar {DIAS[diaSemana]} {hora} de <strong>{alunoNome.split(' ')[0]}</strong>? O atendimento continua,
        aguardando horário. Dá para desfazer pela Lixeira.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={liberar}
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#8a6100] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Liberando…' : 'Liberar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => {
            setConfirmando(false)
            setErro('')
          }}
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
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
