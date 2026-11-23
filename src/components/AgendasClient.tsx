'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { horariosLivres, diaTotalmenteIndisponivel } from '@/domain/conflitos'
import { horasDaGrade, horasDoDia, slotsDe, temSlot, vagasDoSlot, type SlotsPorProfissional } from '@/domain/grade'
import { rotuloSemanas, semanasCheias, todasAsSemanas } from '@/domain/semanas'
import EscolherSemanas from './EscolherSemanas'
import { corDaFrequencia } from './EtiquetaSemanas'
import EncerrarAtendimentoBotao from './EncerrarAtendimentoBotao'
import LiberarHorarioBotao from './LiberarHorarioBotao'
import MarcarIndisponivelBotao from './MarcarIndisponivelBotao'
import BloquearDiaBotao from './BloquearDiaBotao'

export type AlunoOpcao = { id: string; nome: string; matricula: string; situacao: string }
export type AreaOpcao = { id: string; nome: string }
export type ProfissionalOpcao = { id: string; nome: string; usuario: string; areaId: string | null; semanasNoCiclo: number }
export type OcupacaoTela = {
  vinculoId: string; horarioId: string; alunoId: string; alunoNome: string; profissionalId: string
  diaSemana: number; hora: string; local: string | null
  semanas: number
}
export type VinculoVigente = {
  vinculoId: string; horarioId: string; alunoId: string; alunoNome: string; profissionalId: string
  profissionalNome: string; areaId: string; areaNome: string
  diaSemana: number; hora: string
  semanas: number; semanasNoCiclo: number
  inicio: string
}
export type Livre = { diaSemana: number; hora: string }
export type IndisponibilidadeTela = { profissionalId: string; diaSemana: number; hora: string }

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

function Transferir({
  v,
  profissionais,
  slotsPorProfissional,
  aoTransferir,
}: {
  v: VinculoVigente
  profissionais: ProfissionalOpcao[]
  slotsPorProfissional: SlotsPorProfissional
  aoTransferir: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [profissionalId, setProfissionalId] = useState('')
  const [dia, setDia] = useState(v.diaSemana)
  const [hora, setHora] = useState(v.hora)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [semanas, setSemanas] = useState(0)
  const destino = profissionais.find((p) => p.id === profissionalId)
  // Igual à rota: toda semana continua toda semana; mesmo número de semanas, mesmas semanas.
  function semanasPadrao(p: ProfissionalOpcao | undefined): number {
    if (!p) return 0
    if (v.semanas === todasAsSemanas(v.semanasNoCiclo)) return todasAsSemanas(p.semanasNoCiclo)
    if (p.semanasNoCiclo === v.semanasNoCiclo) return v.semanas
    return 0
  }

  const candidatos = profissionais.filter(
    (p) => p.areaId === v.areaId && p.id !== v.profissionalId,
  )
  // Só os horários que o profissional que recebe realmente tem naquele dia.
  const horasDoDestino = horasDoDia(slotsDe(slotsPorProfissional, profissionalId), dia)

  function escolherDestino(novoProfissional: string, novoDia: number) {
    setProfissionalId(novoProfissional)
    setSemanas(semanasPadrao(profissionais.find((p) => p.id === novoProfissional)))
    setDia(novoDia)
    const horas = horasDoDia(slotsDe(slotsPorProfissional, novoProfissional), novoDia)
    if (horas.length > 0 && !horas.includes(hora)) setHora(horas[0])
  }

  async function confirmar() {
    setErro('')
    if (!profissionalId) {
      setErro('Escolha o profissional que recebe.')
      return
    }
    if (destino && destino.semanasNoCiclo > 1 && semanas === 0) {
      setErro(`${destino.nome} tem ${destino.semanasNoCiclo} semanas: escolha em quais o aluno fica.`)
      return
    }
    setEnviando(true)
    const resposta = await fetch('/api/transferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vinculoId: v.vinculoId,
        horarioId: v.horarioId,
        diaSemana: dia,
        hora,
        profissionalId,
        ...(destino && destino.semanasNoCiclo > 1 ? { semanas } : {}),
      }),
    })
    const corpo = (await resposta.json()) as { erro?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não consegui transferir. Tente de novo.')
      return
    }
    setOk(true)
    aoTransferir()
  }

  if (ok) return <span className="text-xs font-bold text-[#1c7a33]">Transferido.</span>
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-2 text-xs font-bold text-[#0A63C9]"
      >
        Transferir
      </button>
    )
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-1">
      <select
        aria-label={`Profissional que recebe ${v.alunoNome}`}
        value={profissionalId}
        onChange={(e) => escolherDestino(e.target.value, dia)}
        className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
      >
        <option value="">Recebe… ({v.areaNome})</option>
        {candidatos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <select
          aria-label="Dia"
          value={dia}
          onChange={(e) => escolherDestino(profissionalId, Number(e.target.value))}
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              {DIAS[d]}
            </option>
          ))}
        </select>
        <select
          aria-label="Hora"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        >
          {horasDoDestino.length === 0 && <option value="">sem horário neste dia</option>}
          {horasDoDestino.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
      {destino && (
        <EscolherSemanas semanasNoCiclo={destino.semanasNoCiclo} valor={semanas} aoMudar={setSemanas} />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {enviando ? '…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[44px] items-center px-2 text-xs text-slate-500"
        >
          Fechar
        </button>
      </div>
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
      <p className="text-[11px] text-slate-500">
        O histórico do aluno passa para quem recebe. Grupo e local vão junto.
      </p>
    </div>
  )
}

export default function AgendasClient({
  alunos,
  areas,
  profissionais,
  ocupacoes,
  vigentes,
  alunoInicial = '',
  indisponibilidades,
  slotsPorProfissional,
}: {
  alunos: AlunoOpcao[]
  areas: AreaOpcao[]
  profissionais: ProfissionalOpcao[]
  ocupacoes: OcupacaoTela[]
  vigentes: VinculoVigente[]
  alunoInicial?: string
  indisponibilidades: IndisponibilidadeTela[]
  slotsPorProfissional: SlotsPorProfissional
}) {
  const router = useRouter()
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [alunoId, setAlunoId] = useState(alunoInicial)
  const [areaId, setAreaId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState('')
  const [semanas, setSemanas] = useState(1)
  const [dia, setDia] = useState<number | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [conflito, setConflito] = useState('')
  const [livres, setLivres] = useState<Livre[]>([])
  const [sucesso, setSucesso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const profissionaisFiltrados = areaId
    ? profissionais.filter((p) => p.areaId === areaId)
    : profissionais
  const profissional = profissionais.find((p) => p.id === profissionalId)
  const aluno = alunos.find((a) => a.id === alunoId)

  const slotsSel = slotsDe(slotsPorProfissional, profissionalId)
  const doProfissional = ocupacoes.filter((o) => o.profissionalId === profissionalId)
  const celular = (d: number, h: string) =>
    doProfissional.filter((o) => o.diaSemana === d && o.hora === h)
  const semanasDoProf = profissional?.semanasNoCiclo ?? 1
  const todasDoProf = todasAsSemanas(semanasDoProf)
  const ocupadasEm = (d: number, h: string) => semanasCheias(celular(d, h).map((o) => o.semanas), vagasDoSlot(slotsSel, d, h), semanasDoProf)
  const indisponiveisDoProfissional = useMemo(
    () =>
      new Set(
        indisponibilidades
          .filter((i) => i.profissionalId === profissionalId)
          .map((i) => `${i.diaSemana}-${i.hora}`),
      ),
    [indisponibilidades, profissionalId],
  )

  function escolherProfissional(v: string) {
    setProfissionalId(v)
    setSemanas(1)
  }

  function escolherArea(v: string) {
    setAreaId(v)
    if (v && profissionalId && profissionais.find((p) => p.id === profissionalId)?.areaId !== v) {
      setProfissionalId('')
    }
  }

  function escolherSlot(d: number, h: string) {
    setDia(d)
    setHora(h)
    setSemanas((todasDoProf & ~ocupadasEm(d, h)) || todasDoProf)
    setConflito('')
    setSucesso('')
  }

  async function confirmar() {
    setConflito('')
    setSucesso('')
    setLivres([])
    if (!alunoId || !areaId || !profissionalId || !dia || !hora || !inicio) {
      setConflito('Escolha o aluno, a área, o profissional, o dia e o horário.')
      return
    }
    if (semanas === 0) { setConflito('Escolha pelo menos uma semana.'); return }
    setEnviando(true)
    const resposta = await fetch('/api/vinculos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId,
        areaId,
        profissionalId,
        diaSemana: dia,
        hora,
        inicio,
        fim: fim === '' ? null : fim,
        semanas: semanas & todasDoProf,
      }),
    })
    const corpo = (await resposta.json()) as { erro?: string; livres?: Livre[] }
    setEnviando(false)
    if (!resposta.ok) {
      setConflito(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      if (corpo.livres) {
        setLivres(corpo.livres)
      } else if (profissionalId) {
        setLivres(
          horariosLivres(
            profissionalId,
            doProfissional,
            slotsSel,
            indisponiveisDoProfissional,
          ),
        )
      }
      return
    }
    setSucesso(
      `${aluno?.nome} encaminhado para ${profissional?.nome} (${DIAS[dia]} às ${hora}).`,
    )
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ag-aluno" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Aluno
            </label>
            <select id="ag-aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={classeCampo}>
              <option value="">Escolha o aluno…</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} · {a.matricula}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ag-area" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Área
            </label>
            <select id="ag-area" value={areaId} onChange={(e) => escolherArea(e.target.value)} className={classeCampo}>
              <option value="">Escolha a área…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ag-prof" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Profissional
            </label>
            <select id="ag-prof" value={profissionalId} onChange={(e) => escolherProfissional(e.target.value)} className={classeCampo}>
              <option value="">Escolha o profissional…</option>
              {profissionaisFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ag-inicio" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Início
            </label>
            <input id="ag-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={classeCampo} />
          </div>
          <div>
            <label htmlFor="ag-fim" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Previsão de término <span className="font-normal normal-case">(opcional)</span>
            </label>
            <input id="ag-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={classeCampo} />
          </div>
        </div>
      </div>

      <h2 className="mb-1 text-[15px] font-extrabold">
        Agenda {profissional ? `de ${profissional.nome}` : 'do profissional'}
      </h2>
      <p className="mb-2 text-[13px] text-slate-500">Toque num horário verde para marcar</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <table className="w-full min-w-[560px] border-collapse text-center text-[13px]">
          <thead>
            <tr>
              <th className="w-[74px] px-2 py-2 text-left text-[11px] uppercase text-slate-500">Horário</th>
              {[1, 2, 3, 4, 5].map((d) => (
                <th key={d} className="px-2 py-2 text-[11px] uppercase text-slate-500">
                  {DIAS[d]}
                  {profissionalId && (
                    <BloquearDiaBotao
                      profissionalId={profissionalId}
                      diaSemana={d}
                      totalmenteIndisponivel={diaTotalmenteIndisponivel(d, indisponiveisDoProfissional, slotsSel)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horasDaGrade(slotsSel).map((h) => (
              <tr key={h} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-left font-bold">{h}</td>
                {[1, 2, 3, 4, 5].map((d) => {
                  const cel = celular(d, h)
                  if (cel.length === 0 && !temSlot(slotsSel, d, h)) {
                    return (
                      <td key={d} className="px-1 py-1.5 text-[15px] text-slate-300" title="Sem atendimento neste horário">
                        ·
                      </td>
                    )
                  }
                  const selecionado = dia === d && hora === h
                  const borda = selecionado ? 'outline outline-2 outline-[#2EA84A]' : ''
                  if (cel.length === 0) {
                    const chave = `${d}-${h}`
                    const marcado = indisponiveisDoProfissional.has(chave)
                    return (
                      <td key={d} className="px-1 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          {marcado ? (
                            <span className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-[11.5px] font-bold text-slate-400 line-through">
                              livre
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => escolherSlot(d, h)}
                              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#e4f6e8] px-3 py-1 text-[11.5px] font-bold text-[#1c7a33] ${borda}`}
                            >
                              livre{selecionado ? ' ✔' : ''}
                            </button>
                          )}
                          {profissionalId && (
                            <MarcarIndisponivelBotao
                              profissionalId={profissionalId}
                              diaSemana={d}
                              hora={h}
                              indisponivel={marcado}
                            />
                          )}
                        </div>
                      </td>
                    )
                  }
                  const ocupadas = ocupadasEm(d, h)
                  const cheia = (ocupadas & todasDoProf) === todasDoProf
                  const local = cel[0].local
                  const fora = local && local.trim().toUpperCase() !== 'CAEELA' ? local : null
                  const nomes = cel.map((o) => o.alunoNome.split(' ')[0]).join(' + ')
                  return (
                    <td key={d} className="px-1 py-1.5">
                      <button
                        type="button"
                        onClick={() => escolherSlot(d, h)}
                        title={cheia ? `Ocupado por ${cel.map((o) => o.alunoNome).join(', ')}` : 'Tem semana livre neste horário'}
                        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 py-1 text-[11.5px] font-bold ${borda} ${
                          cheia ? (cel.length === 1 ? corDaFrequencia(cel[0].semanas, semanasDoProf) : 'bg-[#e6f0ff] text-[#0A63C9]') : 'bg-[#e4f6e8] text-[#1c7a33]'
                        }`}
                      >
                        {cheia ? nomes : 'livre'}
                        {selecionado ? ' ✔' : ''}
                      </button>
                      {!cheia && <span className="block text-[10px] text-slate-500">{nomes}</span>}
                      {fora && <span className="block text-[10px] text-slate-500">📍 {fora}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {conflito && (
        <div className="mt-4 rounded-xl border-l-4 border-[#B3261E] bg-white p-4">
          <p className="text-[13.5px] font-bold text-[#B3261E]">⚠ {conflito}</p>
          {livres.length > 0 && (
            <>
              <p className="mb-2 mt-1 text-[13px] text-slate-600">
                Horários livres nesta semana:
              </p>
              <div className="flex flex-wrap gap-2">
                {livres.slice(0, 12).map((l) => (
                  <button
                    key={`${l.diaSemana}-${l.hora}`}
                    type="button"
                    onClick={() => escolherSlot(l.diaSemana, l.hora)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-3 py-2 text-xs font-bold text-white"
                  >
                    {DIAS[l.diaSemana]} · {l.hora}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {sucesso && (
        <p role="status" className="mt-4 rounded-xl border border-[#2EA84A]/30 bg-[#2EA84A]/10 px-4 py-3 text-sm font-bold text-[#1c7a33]">
          ✔ {sucesso}
        </p>
      )}
      {dia && hora && semanasDoProf > 1 && (
        <div className="mt-4">
          <EscolherSemanas semanasNoCiclo={semanasDoProf} valor={semanas} ocupadas={ocupadasEm(dia, hora)} aoMudar={setSemanas} />
        </div>
      )}
      <button
        type="button"
        disabled={enviando}
        onClick={confirmar}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Salvando…' : '✔ Confirmar encaminhamento'}
      </button>

      <h2 className="mb-1 mt-8 text-[15px] font-extrabold">Atendimentos vigentes</h2>
      <p className="mb-2 text-[13px] text-slate-500">
        Liberar horário tira o aluno do horário sem encerrar (ele fica aguardando horário) · Encerrar dá alta, desligamento ou pausa e guarda o histórico
      </p>
      {vigentes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Nenhum atendimento vigente.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Aluno</th>
                <th className="px-3 py-2">Profissional</th>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2">Liberar</th>
                <th className="px-3 py-2">Encerrar</th>
                <th className="px-3 py-2">Transferir</th>
              </tr>
            </thead>
            <tbody>
              {vigentes.map((v) => (
                <tr key={`${v.vinculoId}-${v.diaSemana}-${v.hora}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">{v.alunoNome}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {v.profissionalNome} · {v.areaNome}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {DIAS[v.diaSemana]} às {v.hora}
                    {rotuloSemanas(v.semanas, v.semanasNoCiclo) ? ` · ${rotuloSemanas(v.semanas, v.semanasNoCiclo)}` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.inicio.split('-').reverse().join('/')}</td>
                  <td className="px-3 py-2">
                    <LiberarHorarioBotao
                      horarioId={v.horarioId}
                      alunoNome={v.alunoNome}
                      diaSemana={v.diaSemana}
                      hora={v.hora}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EncerrarAtendimentoBotao
                      vinculoId={v.vinculoId}
                      alunoNome={v.alunoNome}
                      aoEncerrar={() => router.refresh()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Transferir
                      v={v}
                      profissionais={profissionais}
                      slotsPorProfissional={slotsPorProfissional}
                      aoTransferir={() => router.refresh()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
