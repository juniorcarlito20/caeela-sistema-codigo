'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EscolherSemanas from './EscolherSemanas'
import EtiquetaSemanas from './EtiquetaSemanas'
import EncerrarAtendimentoBotao from './EncerrarAtendimentoBotao'
import LiberarHorarioBotao from './LiberarHorarioBotao'
import { listaDeSemanas } from '@/domain/semanas'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']
const classeBotao =
  'inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-1.5 text-xs font-bold text-[#0A63C9]'

// O mesmo painel para mexer no horário de um aluno, na agenda do profissional e na ficha do
// aluno: em quais semanas ele vem, mover ou trocar, abrir a ficha e encerrar. Só a direção vê.
export default function PainelHorarioAluno({
  variante = 'painel',
  horarioId,
  vinculoId,
  alunoId,
  alunoNome,
  diaSemana,
  hora,
  semanas,
  semanasNoCiclo,
  ocupadasPorOutros,
  aoMoverOuTrocar,
  aoFechar,
  linkAgenda,
}: {
  variante?: 'painel' | 'linha'
  horarioId: string
  vinculoId: string
  alunoId: string
  alunoNome: string
  diaSemana: number
  hora: string
  semanas: number
  semanasNoCiclo: number
  ocupadasPorOutros: number
  aoMoverOuTrocar?: () => void
  aoFechar?: () => void
  linkAgenda?: string
}) {
  const router = useRouter()
  const [valor, setValor] = useState(semanas)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function mudarSemanas(nova: number) {
    setErro('')
    if (nova === 0) {
      setErro('Para tirar o aluno de todas as semanas, use Encerrar.')
      return
    }
    const anterior = valor
    setValor(nova)
    setSalvando(true)
    const resposta = await fetch(`/api/horarios/${horarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semanas: nova }),
    })
    setSalvando(false)
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setValor(anterior)
      setErro(corpo.erro ?? 'Não foi possível mudar as semanas.')
      return
    }
    router.refresh()
  }

  // Da ficha do aluno: abre a agenda na primeira semana dele, já com ele "na mão".
  const primeiraSemana = listaDeSemanas(valor, semanasNoCiclo)[0] ?? 1
  const linkMover = linkAgenda
    ? `${linkAgenda}${linkAgenda.includes('?') ? '&' : '?'}semana=${primeiraSemana}&mover=${horarioId}`
    : undefined

  const conteudo = (
    <>
      <EscolherSemanas
        semanasNoCiclo={semanasNoCiclo}
        valor={valor}
        ocupadas={ocupadasPorOutros}
        aoMudar={mudarSemanas}
        desabilitado={salvando}
      />
      {semanasNoCiclo <= 1 && (
        <p className="text-[12px] text-slate-500">
          Para quinzenal ou mensal, crie a Semana 2 em <strong>+ Nova semana</strong>, no alto da agenda.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {aoMoverOuTrocar && (
          <button type="button" onClick={aoMoverOuTrocar} className={classeBotao}>
            ⇄ Mover ou trocar
          </button>
        )}
        {linkAgenda && (
          <Link href={linkMover!} className={classeBotao}>
            Mover na agenda do profissional
          </Link>
        )}
        {variante === 'painel' && (
          <Link href={`/alunos/${alunoId}`} className={classeBotao}>
            Abrir ficha
          </Link>
        )}
        <LiberarHorarioBotao
          horarioId={horarioId}
          alunoNome={alunoNome}
          diaSemana={diaSemana}
          hora={hora}
          aoLiberar={aoFechar}
        />
        <EncerrarAtendimentoBotao vinculoId={vinculoId} alunoNome={alunoNome} />
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-xs font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
    </>
  )

  if (variante === 'linha') return <div className="mt-2">{conteudo}</div>

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-[#f4f7fc] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
          <strong>{alunoNome}</strong>
          <span className="text-slate-500">
            {DIAS[diaSemana]} {hora}
          </span>
          <EtiquetaSemanas semanas={valor} semanasNoCiclo={semanasNoCiclo} completa />
        </p>
        {aoFechar && (
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="min-h-[40px] min-w-[40px] text-sm font-bold text-slate-500"
          >
            ✕
          </button>
        )}
      </div>
      {conteudo}
    </div>
  )
}
