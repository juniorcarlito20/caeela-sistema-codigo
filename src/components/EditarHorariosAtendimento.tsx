'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DURACAO_PADRAO, fimDoSlot, gerarHorarios, HORA_VALIDA, validarSlots, type Slot,
} from '@/domain/grade'

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const DIAS_CURTOS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

type Linha = {
  chave: string
  hora: string
  duracaoMin: number
  vagas: number // 1 = individual; 2 ou mais = horário de grupo
  horaAntiga?: string // hora que esse horário tinha ao abrir (o aluno acompanha a mudança)
}

let contador = 0
const novaChave = () => `l${(contador += 1)}`

function linhasIniciais(slots: Slot[]): Record<number, Linha[]> {
  const porDia: Record<number, Linha[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  for (const s of [...slots].sort((a, b) => a.hora.localeCompare(b.hora))) {
    porDia[s.diaSemana]?.push({ chave: novaChave(), hora: s.hora, duracaoMin: s.duracaoMin, vagas: s.vagas ?? 1, horaAntiga: s.hora })
  }
  return porDia
}

const classeCampo =
  'min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-800 focus:border-[#0A63C9] focus:outline-none'

// Tela de editar os horários de atendimento de um profissional: cada dia da semana tem os
// seus horários, e cada horário tem a sua hora de início e a sua duração.
export default function EditarHorariosAtendimento({
  profissionalId,
  profissionalNome,
  slots,
  comAluno,
  aoFechar,
}: {
  profissionalId: string
  profissionalNome: string
  slots: Slot[]
  comAluno: string[] // chaves "dia-hora" onde existe aluno (nesses a lixeira fica desligada)
  aoFechar: () => void
}) {
  const router = useRouter()
  const [dias, setDias] = useState<Record<number, Linha[]>>(() => linhasIniciais(slots))
  const [geradorDe, setGeradorDe] = useState('07:00')
  const [geradorAte, setGeradorAte] = useState('11:00')
  const [geradorPasso, setGeradorPasso] = useState(60)
  const [geradorDias, setGeradorDias] = useState<number[]>([1, 2])
  const [copiando, setCopiando] = useState<number | null>(null)
  const [copiarPara, setCopiarPara] = useState<number[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const temAluno = (dia: number, l: Linha) => l.horaAntiga !== undefined && comAluno.includes(`${dia}-${l.horaAntiga}`)

  const todos: Slot[] = useMemo(
    () => [1, 2, 3, 4, 5].flatMap((d) => dias[d].map((l) => ({ diaSemana: d, hora: l.hora, duracaoMin: l.duracaoMin, vagas: l.vagas }))),
    [dias],
  )
  const problemas = useMemo(() => validarSlots(todos), [todos])
  const problemaDa = (dia: number, l: Linha) => problemas.find((p) => p.diaSemana === dia && p.hora === l.hora)?.mensagem
  const problemaGeral = problemas.find((p) => !dias[p.diaSemana].some((l) => l.hora === p.hora))?.mensagem

  function mudarLinha(dia: number, chave: string, campos: Partial<Linha>) {
    setDias((atual) => ({ ...atual, [dia]: atual[dia].map((l) => (l.chave === chave ? { ...l, ...campos } : l)) }))
    setErro('')
  }

  function tirarLinha(dia: number, chave: string) {
    setDias((atual) => ({ ...atual, [dia]: atual[dia].filter((l) => l.chave !== chave) }))
    setErro('')
  }

  function maisUma(dia: number) {
    setDias((atual) => {
      const lista = atual[dia]
      const ultima = [...lista].sort((a, b) => a.hora.localeCompare(b.hora)).slice(-1)[0]
      const hora = ultima && HORA_VALIDA.test(ultima.hora) ? fimDoSlot(ultima.hora, ultima.duracaoMin) : '08:00'
      return { ...atual, [dia]: [...lista, { chave: novaChave(), hora: HORA_VALIDA.test(hora) ? hora : '08:00', duracaoMin: ultima?.duracaoMin ?? DURACAO_PADRAO, vagas: 1 }] }
    })
    setErro('')
  }

  // Troca os horários de um dia, mas nunca perde um horário onde há aluno: esse fica, e o
  // aviso vermelho mostra se algo bate.
  function substituirDia(atual: Record<number, Linha[]>, dia: number, novas: { hora: string; duracaoMin: number; vagas?: number }[]): Linha[] {
    const antigas = atual[dia]
    const comoJaExistia = new Map(antigas.filter((l) => l.horaAntiga !== undefined).map((l) => [l.horaAntiga as string, l]))
    const criadas: Linha[] = novas.map((n) => ({
      chave: novaChave(),
      hora: n.hora,
      duracaoMin: n.duracaoMin,
      vagas: n.vagas ?? comoJaExistia.get(n.hora)?.vagas ?? 1,
      horaAntiga: comoJaExistia.has(n.hora) ? n.hora : undefined,
    }))
    const mantidas = antigas.filter(
      (l) => temAluno(dia, l) && !criadas.some((c) => c.horaAntiga !== undefined && c.horaAntiga === l.horaAntiga) && !criadas.some((c) => c.hora === l.hora),
    )
    return [...criadas, ...mantidas].sort((a, b) => a.hora.localeCompare(b.hora))
  }

  function gerar() {
    const novas = gerarHorarios(geradorDe, geradorAte, geradorPasso)
    if (novas.length === 0) {
      setErro('Confira a hora inicial, a final e a duração: nenhum horário coube nesse intervalo.')
      return
    }
    if (geradorDias.length === 0) {
      setErro('Marque pelo menos um dia para gerar os horários.')
      return
    }
    setDias((atual) => {
      const proximo = { ...atual }
      for (const d of geradorDias) proximo[d] = substituirDia(atual, d, novas)
      return proximo
    })
    setErro('')
  }

  function copiar() {
    if (copiando === null || copiarPara.length === 0) return
    const origem = dias[copiando].map((l) => ({ hora: l.hora, duracaoMin: l.duracaoMin, vagas: l.vagas }))
    setDias((atual) => {
      const proximo = { ...atual }
      for (const d of copiarPara) proximo[d] = substituirDia(atual, d, origem)
      return proximo
    })
    setCopiando(null)
    setCopiarPara([])
    setErro('')
  }

  function cancelar() {
    setDias(linhasIniciais(slots))
    setErro('')
    aoFechar()
  }

  async function salvar() {
    if (problemas.length > 0) {
      setErro('Corrija os avisos em vermelho antes de salvar.')
      return
    }
    setSalvando(true)
    setErro('')
    const resposta = await fetch(`/api/profissionais/${profissionalId}/horarios-atendimento`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [1, 2, 3, 4, 5].flatMap((d) =>
          dias[d].map((l) => ({ diaSemana: d, hora: l.hora, duracaoMin: l.duracaoMin, vagas: l.vagas, ...(l.horaAntiga ? { horaAntiga: l.horaAntiga } : {}) })),
        ),
      }),
    })
    setSalvando(false)
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    aoFechar()
    router.refresh()
  }

  const alternar = (lista: number[], d: number) => (lista.includes(d) ? lista.filter((x) => x !== d) : [...lista, d])
  const total = todos.length

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Editar horários de atendimento">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">
          Editar horários de atendimento <span className="text-[12px] font-normal text-slate-500">· {profissionalNome}</span>
        </h2>
        <button
          type="button"
          onClick={cancelar}
          aria-label="Fechar a edição de horários"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-500 hover:bg-slate-100"
        >
          Fechar <span aria-hidden className="text-lg leading-none">✕</span>
        </button>
      </div>
      <p className="mb-3 text-[13px] text-slate-500">
        Cada coluna é um dia. Mude a hora ou a duração de qualquer linha, acrescente ou tire horários. Só vale depois de tocar em{' '}
        <b>Salvar horários</b>.
      </p>

      <datalist id="duracoes-editor">
        {[30, 40, 45, 50, 60, 90].map((m) => <option key={m} value={m} />)}
      </datalist>

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-300 bg-[#f4f7fc] p-3">
        <div>
          <label htmlFor="he-de" className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Gerar horários de</label>
          <input id="he-de" type="time" step={300} value={geradorDe} onChange={(e) => setGeradorDe(e.target.value)} className={`${classeCampo} w-[110px]`} />
        </div>
        <div>
          <label htmlFor="he-ate" className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-slate-500">até</label>
          <input id="he-ate" type="time" step={300} value={geradorAte} onChange={(e) => setGeradorAte(e.target.value)} className={`${classeCampo} w-[110px]`} />
        </div>
        <div>
          <label htmlFor="he-passo" className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-slate-500">de quantos em quantos min</label>
          <input id="he-passo" type="number" min={5} max={240} step={5} list="duracoes-editor" value={geradorPasso} onChange={(e) => setGeradorPasso(Number(e.target.value))} className={`${classeCampo} w-[90px]`} />
        </div>
        <fieldset>
          <legend className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">nos dias</legend>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((d) => (
              <label key={d} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-slate-300 bg-white px-2.5 text-[12.5px]">
                <input type="checkbox" checked={geradorDias.includes(d)} onChange={() => setGeradorDias((l) => alternar(l, d))} className="h-4 w-4 accent-[#0A63C9]" />
                {DIAS_CURTOS[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={gerar} className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-slate-400 bg-white px-3 text-xs font-bold text-slate-600">
          ⚡ Gerar
        </button>
        <p className="basis-full text-[11.5px] text-slate-500">
          Atalho para não digitar um por um: ele só preenche as colunas marcadas (os horários que já têm aluno ficam). Depois você ainda pode mexer em cada linha.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((d) => (
          <div key={d} className="min-w-0 rounded-xl border border-slate-200 bg-[#f4f7fc] p-2">
            <h3 className="mb-2 flex items-baseline justify-between px-1 text-[13px] font-extrabold">
              {DIAS[d]}
              <span className="text-[11px] font-normal text-slate-500">
                {dias[d].length === 0 ? 'não atende' : `${dias[d].length} ${dias[d].length === 1 ? 'horário' : 'horários'}`}
              </span>
            </h3>
            {dias[d].length === 0 && <p className="px-1 pb-2 text-[12px] text-slate-500">Sem horários: não aparece na agenda neste dia.</p>}
            <ul className="flex flex-col gap-1.5">
              {dias[d].map((l) => {
                const aviso = problemaDa(d, l)
                const comAlunoAqui = temAluno(d, l)
                return (
                  <li key={l.chave}>
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        type="time"
                        step={300}
                        aria-label={`${DIAS[d]}: hora de início`}
                        value={l.hora}
                        onChange={(e) => mudarLinha(d, l.chave, { hora: e.target.value })}
                        className={`${classeCampo} w-[104px]`}
                      />
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                        <input
                          type="number"
                          min={5}
                          max={240}
                          step={5}
                          list="duracoes-editor"
                          aria-label={`${DIAS[d]} ${l.hora}: duração em minutos`}
                          value={l.duracaoMin}
                          onChange={(e) => mudarLinha(d, l.chave, { duracaoMin: Number(e.target.value) })}
                          className={`${classeCampo} w-[66px]`}
                        />
                        min
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          step={1}
                          aria-label={`${DIAS[d]} ${l.hora}: vagas (1 = individual, 2 ou mais = grupo)`}
                          value={l.vagas}
                          onChange={(e) => mudarLinha(d, l.chave, { vagas: Number(e.target.value) })}
                          className={`${classeCampo} w-[58px]`}
                        />
                        {l.vagas > 1 ? 'vagas · grupo' : 'vaga'}
                      </span>
                      <button
                        type="button"
                        disabled={comAlunoAqui}
                        onClick={() => tirarLinha(d, l.chave)}
                        aria-label={`Remover o horário ${l.hora} de ${DIAS[d]}`}
                        title={comAlunoAqui ? 'Tem aluno neste horário. Mova o aluno antes de remover.' : 'Remover este horário'}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white text-[#B3261E] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        🗑
                      </button>
                      {comAlunoAqui && <span className="rounded-full bg-[#e6f0ff] px-2 py-0.5 text-[10.5px] font-bold text-[#0A63C9]">tem aluno</span>}
                    </div>
                    {aviso && <p role="alert" className="mt-1 rounded-md bg-[#fde7e7] px-2 py-1 text-[11.5px] font-bold text-[#B3261E]">⚠ {aviso}</p>}
                  </li>
                )
              })}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => maisUma(d)} className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-slate-400 bg-white px-2.5 text-[11.5px] font-bold text-slate-600">
                + horário
              </button>
              <button
                type="button"
                onClick={() => { setCopiando(copiando === d ? null : d); setCopiarPara([]) }}
                aria-expanded={copiando === d}
                className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-slate-400 bg-white px-2.5 text-[11.5px] font-bold text-slate-600"
              >
                ⧉ copiar para…
              </button>
            </div>
            {copiando === d && (
              <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2">
                <p className="mb-1 text-[11.5px] text-slate-600">Copiar os horários de {DIAS[d]} para:</p>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].filter((x) => x !== d).map((x) => (
                    <label key={x} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-slate-300 px-2 text-[12px]">
                      <input type="checkbox" checked={copiarPara.includes(x)} onChange={() => setCopiarPara((l) => alternar(l, x))} className="h-4 w-4 accent-[#0A63C9]" />
                      {DIAS_CURTOS[x]}
                    </label>
                  ))}
                </div>
                <button type="button" disabled={copiarPara.length === 0} onClick={copiar} className="mt-2 inline-flex min-h-[44px] items-center rounded-lg bg-[#0A63C9] px-3 text-xs font-bold text-white disabled:opacity-50">
                  Copiar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(erro || problemaGeral) && <p role="alert" className="mt-3 text-xs font-bold text-[#B3261E]">{erro || problemaGeral}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={salvando || total === 0 || problemas.length > 0}
          onClick={salvar}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-[#2EA84A] px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar horários'}
        </button>
        <button type="button" disabled={salvando} onClick={cancelar} className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 text-sm font-bold text-slate-600">
          Cancelar
        </button>
        <span className="text-[12px] text-slate-500">{total} {total === 1 ? 'horário' : 'horários'} na semana</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-[#f4f7fc] p-3">
          <p className="mb-1 text-[13px] font-extrabold">Como usar</p>
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-slate-700">
            <li>Mude a <b>hora</b> ou a <b>duração</b> direto na linha. A duração pode ser qualquer valor (45, 50, 90 minutos…).</li>
            <li>Use <b>⚡ Gerar</b> para criar vários horários de uma vez, ou <b>+ horário</b> para um só.</li>
            <li>Use <b>⧉ copiar para…</b> para repetir um dia nos outros (ex.: segunda igual à terça).</li>
            <li>Um logo depois do outro está certo: 07:00 de 60 min, 08:00 de 60 min e 09:00 de 45 min. O próximo só pode começar às 09:45 ou depois.</li>
            <li>Dia sem nenhum horário = o profissional não atende nesse dia.</li>
            <li><b>Vagas</b>: 1 é atendimento individual. Com 2 ou mais, o horário vira de <b>grupo</b>: cabem várias crianças ao mesmo tempo, cada uma com o próprio registro. Só dá para baixar as vagas depois de mover as crianças que passarem do novo limite.</li>
            <li>Nada muda até você tocar em <b>Salvar horários</b>.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[#f4f7fc] p-3">
          <p className="mb-1 text-[13px] font-extrabold">O que o sistema cuida por você</p>
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-slate-700">
            <li>A <b>lixeira fica desligada</b> onde tem aluno: mova o aluno para outro horário antes de remover.</li>
            <li>Aparece um <b>aviso vermelho</b> quando dois horários do mesmo dia se sobrepõem (um das 10:00 de 30 min já ocupa até 10:30).</li>
            <li>Se você mudar a hora ou a duração de um horário com aluno, <b>o aluno acompanha</b>. O sistema recusa se isso colocar uma criança em dois atendimentos ao mesmo tempo.</li>
            <li>O <b>✕ de indisponível</b> (em ✏️ Mover atendimentos) continua valendo: ele só esconde um horário por um tempo. Aqui você decide quais horários existem.</li>
            <li>Tudo fica no <b>Histórico</b>.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
