'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { horasDaGrade, slotsDe, temSlot, vagasDoSlot, type SlotsPorProfissional } from '@/domain/grade'
import { semanasCheias, todasAsSemanas } from '@/domain/semanas'
import EscolherSemanas from './EscolherSemanas'
import type { AreaOpcao, OcupacaoTela, ProfissionalOpcao } from './AgendasClient'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

export default function EncaminharProfissionalClient({
  alunoId,
  alunoNome,
  areas,
  profissionais,
  ocupacoes,
  slotsPorProfissional,
}: {
  alunoId: string
  alunoNome: string
  areas: AreaOpcao[]
  profissionais: ProfissionalOpcao[]
  ocupacoes: OcupacaoTela[]
  slotsPorProfissional: SlotsPorProfissional
}) {
  const router = useRouter()
  const hoje = new Date().toISOString().slice(0, 10)
  const [aberto, setAberto] = useState(false)
  const [areaId, setAreaId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [pendente, setPendente] = useState<{ dia: number; hora: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [semanas, setSemanas] = useState(1)

  const profissionaisFiltrados = areaId ? profissionais.filter((p) => p.areaId === areaId) : profissionais
  const profissionalEscolhido = profissionais.find((p) => p.id === profissionalId)
  const slotsSel = slotsDe(slotsPorProfissional, profissionalId)
  const doProfissional = ocupacoes.filter((o) => o.profissionalId === profissionalId)
  const celular = (d: number, h: string) => doProfissional.filter((o) => o.diaSemana === d && o.hora === h)
  const semanasDoProf = profissionalEscolhido?.semanasNoCiclo ?? 1
  const todasDoProf = todasAsSemanas(semanasDoProf)
  const ocupadasEm = (d: number, h: string) => semanasCheias(celular(d, h).map((o) => o.semanas), vagasDoSlot(slotsSel, d, h), semanasDoProf)
  function escolherHorario(d: number, h: string) {
    setPendente({ dia: d, hora: h })
    setSemanas((todasDoProf & ~ocupadasEm(d, h)) || todasDoProf)
  }

  function escolherArea(v: string) {
    setAreaId(v)
    if (v && profissionalId && profissionais.find((p) => p.id === profissionalId)?.areaId !== v) {
      setProfissionalId('')
    }
    setPendente(null)
  }

  function escolherProfissional(v: string) {
    setProfissionalId(v)
    setPendente(null)
    setErro('')
    setMsg('')
  }

  async function confirmar() {
    if (!pendente || !profissionalId) return
    const area = areaId || profissionalEscolhido?.areaId || ''
    if (!area) {
      setErro('Escolha a área.')
      return
    }
    if (semanas === 0) { setErro('Escolha pelo menos uma semana.'); return }
    setOcupado(true)
    setErro('')
    setMsg('')
    const resposta = await fetch('/api/vinculos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId,
        areaId: area,
        profissionalId,
        diaSemana: pendente.dia,
        hora: pendente.hora,
        inicio: hoje,
        fim: null,
        semanas: semanas & todasDoProf,
      }),
    })
    setOcupado(false)
    if (resposta.ok) {
      setMsg(`${alunoNome} encaminhado pra ${profissionalEscolhido?.nome} — ${DIAS[pendente.dia]} às ${pendente.hora}.`)
      setPendente(null)
      router.refresh()
    } else {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível encaminhar.')
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
      >
        + Encaminhar pra outro profissional
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-extrabold">Encaminhar {alunoNome}</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs font-bold text-slate-500"
        >
          Fechar
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="ep-area" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Área
          </label>
          <select id="ep-area" value={areaId} onChange={(e) => escolherArea(e.target.value)} className={classeCampo}>
            <option value="">Todas as áreas…</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ep-prof" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Profissional
          </label>
          <select
            id="ep-prof"
            value={profissionalId}
            onChange={(e) => escolherProfissional(e.target.value)}
            className={classeCampo}
          >
            <option value="">Escolha o profissional…</option>
            {profissionaisFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {profissionalId && (
        <>
          <h4 className="mb-1 mt-4 text-[13px] font-extrabold">Toque no horário livre</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
            <table className="w-full min-w-[560px] border-collapse text-center text-[13px]">
              <thead>
                <tr>
                  <th className="w-[74px] px-2 py-2 text-left text-[11px] uppercase text-slate-500">Horário</th>
                  {DIAS.slice(1).map((d) => (
                    <th key={d} className="px-2 py-2 text-[11px] uppercase text-slate-500">
                      {d}
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
                      const selecionado = pendente?.dia === d && pendente?.hora === h
                      const borda = selecionado ? 'outline outline-2 outline-[#2EA84A]' : ''
                      if (cel.length === 0) {
                        return (
                          <td key={d} className="px-1 py-1.5">
                            <button
                              type="button"
                              onClick={() => escolherHorario(d, h)}
                              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#e4f6e8] px-3 py-1 text-[11.5px] font-bold text-[#1c7a33] ${borda}`}
                            >
                              livre{selecionado ? ' ✔' : ''}
                            </button>
                          </td>
                        )
                      }
                      const cheia = (ocupadasEm(d, h) & todasDoProf) === todasDoProf
                      const nomes = cel.map((o) => o.alunoNome.split(' ')[0]).join(' + ')
                      return (
                        <td key={d} className="px-1 py-1.5">
                          {cheia ? (
                            <span
                              title={`Ocupado por ${cel.map((o) => o.alunoNome).join(', ')}`}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-200 px-3 py-1 text-[11.5px] font-bold text-slate-500"
                            >
                              {nomes}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => escolherHorario(d, h)}
                                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#e4f6e8] px-3 py-1 text-[11.5px] font-bold text-[#1c7a33] ${borda}`}
                              >
                                livre{selecionado ? ' ✔' : ''}
                              </button>
                              <span className="block text-[10px] text-slate-500">{nomes}</span>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pendente && profissionalEscolhido && (
        <div className="mt-3 rounded-xl border-[1.5px] border-[#0A63C9] bg-[#e6f0ff] p-3">
          <p className="text-[13.5px] font-bold text-[#0A63C9]">
            Encaminhar {alunoNome} pra {profissionalEscolhido.nome} — {DIAS[pendente.dia]} às {pendente.hora}?
          </p>
          <div className="mt-2">
            <EscolherSemanas
              semanasNoCiclo={semanasDoProf}
              valor={semanas}
              ocupadas={ocupadasEm(pendente.dia, pendente.hora)}
              aoMudar={setSemanas}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={confirmar}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {ocupado ? 'Confirmando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setPendente(null)}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p role="alert" className="mt-3 text-xs font-bold text-[#B3261E]">{erro}</p>}
      {msg && <p role="status" className="mt-3 text-xs font-bold text-[#1c7a33]">{msg}</p>}
    </div>
  )
}
