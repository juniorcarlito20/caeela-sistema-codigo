'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { diaTotalmenteIndisponivel } from '@/domain/conflitos'
import { DURACAO_PADRAO, duracaoDoSlot, horasDaGrade, temSlot, vagasDoSlot, type Slot } from '@/domain/grade'
import { deslocarSemanas, estaNaSemana, rotuloSemanas, semanasCheias } from '@/domain/semanas'
import type { AlunoOpcao } from './AgendasClient'
import MarcarIndisponivelBotao from './MarcarIndisponivelBotao'
import BloquearDiaBotao from './BloquearDiaBotao'
import EditarHorariosAtendimento from './EditarHorariosAtendimento'
import EscolherSemanas from './EscolherSemanas'
import PainelHorarioAluno from './PainelHorarioAluno'
import { corDaFrequencia } from './EtiquetaSemanas'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'
const classeBotaoTopo =
  'inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] px-3 py-1.5 text-xs font-bold'

// Um horário de aluno nesta agenda, com as semanas em que ele vem.
export type ItemAgenda = {
  horarioId: string
  vinculoId: string
  alunoId: string
  alunoNome: string
  semanas: number
}

// Tudo o que existe num lugar da grade (dia + hora), somando todas as semanas.
export type CelulaAgenda = { itens: ItemAgenda[] }

type Selecionado = { chave: string; item: ItemAgenda }
// A criança "na mão": guarda a semana de onde saiu, para saber quanto o padrão dela anda
// quando a direção troca de aba (mover para outra semana).
type Movendo = Selecionado & { de: number }
type Pendente =
  | { tipo: 'mover'; origem: Movendo; destinoChave: string; semanas: number }
  | { tipo: 'trocar'; origem: Movendo; destino: Selecionado; deslocamento: number }

const primeiroNome = (nome: string) => nome.split(' ')[0]

function descreverSlot(chave: string): string {
  const [diaStr, hora] = chave.split('-')
  return `${DIAS[Number(diaStr)]} às ${hora}`
}

export default function GradeSemanalEditavel({
  celulas,
  semanaVista,
  semanasNoCiclo,
  editavel,
  alunos,
  profissionalId,
  areaId,
  indisponiveis,
  slots,
  profissionalNome = '',
  linkAluno = true,
  moverInicial,
  aguardando = [],
}: {
  celulas: Map<string, CelulaAgenda>
  semanaVista: number
  semanasNoCiclo: number
  editavel: boolean
  alunos: AlunoOpcao[]
  profissionalId: string
  areaId: string
  indisponiveis: Set<string>
  // Horários de atendimento deste profissional (cada dia pode ter os seus).
  slots: Slot[]
  profissionalNome?: string
  // A Secretaria vê a agenda sem abrir a ficha do aluno.
  linkAluno?: boolean
  // Horário que já abre "na mão" (vindo de "Mover na agenda do profissional" da ficha do aluno).
  moverInicial?: string
  // Crianças com atendimento aberto e sem horário (depois de "Liberar horário").
  aguardando?: { alunoId: string; nome: string }[]
}) {
  const router = useRouter()
  const bitDaSemana = 1 << (semanaVista - 1)
  const [aberto, setAberto] = useState<Selecionado | null>(null)
  const [movendo, setMovendo] = useState<Movendo | null>(() => {
    if (!moverInicial) return null
    for (const [chave, celula] of celulas) {
      const item = celula.itens.find((i) => i.horarioId === moverInicial)
      if (item) return { chave, item, de: semanaVista }
    }
    return null
  })
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [marcandoIndisponivel, setMarcandoIndisponivel] = useState(false)
  const [editandoHorarios, setEditandoHorarios] = useState(false)
  const [preenchendo, setPreenchendo] = useState<string | null>(null)
  // Preenchendo pelo "+": mais uma criança junto de quem já está (as vagas sobem sozinhas).
  const [preenchendoMais, setPreenchendoMais] = useState(false)
  const [semanasNovo, setSemanasNovo] = useState(bitDaSemana)
  const [modoNovoAluno, setModoNovoAluno] = useState(false)
  const [buscaAluno, setBuscaAluno] = useState('')
  const [alunoEscolhido, setAlunoEscolhido] = useState('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  // A grade não é recriada ao trocar de aba (Semana 1, 2…): fecha o que estava aberto, mas a
  // criança "na mão" continua — é assim que se leva alguém para outra semana.
  const [semanaDaTela, setSemanaDaTela] = useState(semanaVista)
  if (semanaDaTela !== semanaVista) {
    setSemanaDaTela(semanaVista)
    setAberto(null)
    setPreenchendo(null)
    setPendente(null)
    setSemanasNovo(1 << (semanaVista - 1))
  }

  // Quanto a criança na mão andou (aba de agora − aba de onde saiu) e as semanas que ela teria aqui.
  const deslocamento = movendo ? semanaVista - movendo.de : 0
  const semanasNaMao = movendo ? deslocarSemanas(movendo.item.semanas, deslocamento, semanasNoCiclo) : 0
  const rotulo = (semanas: number) => rotuloSemanas(semanas, semanasNoCiclo)
  const ondeFica = (chave: string, semanas: number) =>
    `${descreverSlot(chave)}${rotulo(semanas) ? ` (${rotulo(semanas)})` : ''}`

  const candidatos = useMemo(() => {
    const termo = buscaAluno.trim().toLowerCase()
    const aguardam = new Set(aguardando.map((a) => a.alunoId))
    const peso = (a: AlunoOpcao) => (aguardam.has(a.id) ? 0 : a.situacao === 'ESPERA' ? 1 : 2)
    return alunos
      .filter((a) => a.nome.toLowerCase().includes(termo))
      .sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome))
      .slice(0, 30)
  }, [alunos, aguardando, buscaAluno])

  // Vagas do horário (1 = individual) e as semanas em que ele já está cheio, sem contar um
  // horário (o que está sendo mexido).
  const vagasDeChave = (chave: string) => {
    const [dia, hora] = chave.split('-')
    return vagasDoSlot(slots, Number(dia), hora)
  }
  const cheias = (chave: string, ignorar?: string) =>
    semanasCheias(
      (celulas.get(chave)?.itens ?? []).filter((i) => i.horarioId !== ignorar).map((i) => i.semanas),
      vagasDeChave(chave),
      semanasNoCiclo,
    )

  // Quem atende num lugar da grade na semana que está na tela (normalmente um só; dois só
  // em choque antigo que a secretaria ainda não resolveu).
  const naSemana = (chave: string) =>
    (celulas.get(chave)?.itens ?? []).filter((i) => estaNaSemana(i.semanas, semanaVista))

  // Dá pra levar a criança na mão pra cá, com as semanas que ela teria nesta aba?
  const cabeAqui = (chave: string) =>
    !!movendo && (cheias(chave, movendo.item.horarioId) & semanasNaMao) === 0

  function limparMensagens() {
    setErro('')
    setMsg('')
  }

  // Solta a criança da mão. Se ela veio da ficha do aluno (?mover=…), tira o parâmetro da URL
  // para um recarregar não pegá-la de novo.
  function soltar() {
    setMovendo(null)
    if (moverInicial) router.replace(`/profissionais/${profissionalId}?aba=agenda&semana=${semanaVista}`, { scroll: false })
  }

  function abrirPreencher(chave: string, mais = false) {
    setPreenchendo(chave)
    setPreenchendoMais(mais)
    setAberto(null)
    setModoNovoAluno(false)
    setBuscaAluno('')
    setAlunoEscolhido('')
    setNomeNovo('')
    setSemanasNovo(bitDaSemana)
    limparMensagens()
  }

  async function confirmarPreencher() {
    if (!preenchendo) return
    limparMensagens()
    if (modoNovoAluno && nomeNovo.trim().length < 3) {
      setErro('O nome do aluno precisa ter 3 letras ou mais.')
      return
    }
    if (!modoNovoAluno && !alunoEscolhido) {
      setErro('Escolha um aluno da lista, ou cadastre um novo.')
      return
    }
    if (semanasNovo === 0) {
      setErro('Escolha pelo menos uma semana.')
      return
    }
    setOcupado(true)
    let alunoId = alunoEscolhido
    if (modoNovoAluno) {
      const respAluno = await fetch('/api/alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovo.trim() }),
      })
      if (!respAluno.ok) {
        const corpo = (await respAluno.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'Não foi possível cadastrar o aluno.')
        setOcupado(false)
        return
      }
      alunoId = ((await respAluno.json()) as { id: string }).id
    }
    const [diaStr, hora] = preenchendo.split('-')
    const resposta = await fetch('/api/vinculos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId,
        areaId,
        profissionalId,
        diaSemana: Number(diaStr),
        hora,
        inicio: new Date().toISOString().slice(0, 10),
        fim: null,
        semanas: semanasNovo,
        ...(preenchendoMais ? { grupo: true } : {}),
      }),
    })
    setOcupado(false)
    if (resposta.ok) {
      setMsg('Aluno encaminhado pra esse horário.')
      setPreenchendo(null)
      router.refresh()
    } else {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível encaminhar.')
    }
  }

  function clicarOcupado(chave: string, item: ItemAgenda) {
    if (pendente) return
    limparMensagens()
    if (movendo) {
      if (movendo.item.horarioId === item.horarioId) setMovendo(null)
      else setPendente({ tipo: 'trocar', origem: movendo, destino: { chave, item }, deslocamento })
      return
    }
    setPreenchendo(null)
    setAberto((atual) => (atual?.item.horarioId === item.horarioId ? null : { chave, item }))
  }

  function clicarLivre(chave: string) {
    if (pendente) return
    limparMensagens()
    if (movendo) {
      setPendente({ tipo: 'mover', origem: movendo, destinoChave: chave, semanas: semanasNaMao })
      return
    }
    abrirPreencher(chave)
  }

  function clicarMais(chave: string) {
    if (pendente) return
    limparMensagens()
    abrirPreencher(chave, true)
  }

  async function confirmarPendente() {
    if (!pendente) return
    setOcupado(true)
    limparMensagens()
    const resposta =
      pendente.tipo === 'trocar'
        ? await fetch('/api/horarios/trocar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idsOrigem: [pendente.origem.item.horarioId],
              idsDestino: [pendente.destino.item.horarioId],
              deslocamento: pendente.deslocamento,
            }),
          })
        : await fetch(`/api/horarios/${pendente.origem.item.horarioId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              diaSemana: Number(pendente.destinoChave.split('-')[0]),
              hora: pendente.destinoChave.split('-')[1],
              semanas: pendente.semanas,
            }),
          })
    setOcupado(false)
    if (resposta.ok) {
      setMsg(
        pendente.tipo === 'trocar'
          ? `${primeiroNome(pendente.origem.item.alunoNome)} e ${primeiroNome(pendente.destino.item.alunoNome)} trocaram de lugar.`
          : `${primeiroNome(pendente.origem.item.alunoNome)} foi para ${ondeFica(pendente.destinoChave, pendente.semanas)}.`,
      )
      soltar()
      setAberto(null)
      router.refresh()
    } else {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? 'Não foi possível salvar.')
    }
    setPendente(null)
  }

  const comAluno = [...celulas].filter(([, c]) => c.itens.length > 0).map(([chave]) => chave)

  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-slate-500">
          {movendo
            ? `Movendo ${primeiroNome(movendo.item.alunoNome)}${
                semanasNoCiclo > 1 ? ` · soltando nesta semana: ${rotulo(semanasNaMao)}` : ''
              }. Toque num horário verde para levar, ou em outra criança para as duas trocarem de lugar.${
                semanasNoCiclo > 1 ? ' Para levar a outra semana, troque de semana nas abas acima.' : ''
              }`
            : marcandoIndisponivel
              ? 'Toque no ✕ de um horário livre para marcar ou liberar. No alto de cada dia dá para bloquear o dia inteiro.'
              : editavel && areaId
                ? 'Toque num horário verde para encaminhar um aluno · toque num aluno para ver as semanas, mover ou encerrar'
                : linkAluno ? 'Verde é horário livre · toque num aluno para abrir a ficha dele' : 'Verde é horário livre nesta semana'}
        </p>
        {editavel && (
          <div className="flex flex-wrap items-center gap-2">
            {movendo && (
              <button
                type="button"
                onClick={soltar}
                className={`${classeBotaoTopo} border-[#B3261E] bg-white text-[#B3261E]`}
              >
                Cancelar mover
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditandoHorarios((v) => !v)}
              aria-expanded={editandoHorarios}
              className={`${classeBotaoTopo} border-[#0A63C9] ${editandoHorarios ? 'bg-[#e6f0ff]' : 'bg-white'} text-[#0A63C9]`}
            >
              🕒 Editar horários
            </button>
            <button
              type="button"
              onClick={() => {
                setMarcandoIndisponivel((v) => !v)
                setMovendo(null)
                setAberto(null)
                setPreenchendo(null)
              }}
              aria-pressed={marcandoIndisponivel}
              className={`${classeBotaoTopo} ${
                marcandoIndisponivel ? 'border-[#B3261E] bg-white text-[#B3261E]' : 'border-[#0A63C9] bg-white text-[#0A63C9]'
              }`}
            >
              {marcandoIndisponivel ? 'Fechar indisponível' : '🚫 Indisponível'}
            </button>
          </div>
        )}
      </div>

      {editavel && editandoHorarios && (
        <EditarHorariosAtendimento
          profissionalId={profissionalId}
          profissionalNome={profissionalNome}
          slots={slots}
          comAluno={comAluno}
          aoFechar={() => setEditandoHorarios(false)}
        />
      )}

      {editavel && aberto && !movendo && !pendente && (
        <PainelHorarioAluno
          key={aberto.item.horarioId}
          horarioId={aberto.item.horarioId}
          vinculoId={aberto.item.vinculoId}
          alunoId={aberto.item.alunoId}
          alunoNome={aberto.item.alunoNome}
          diaSemana={Number(aberto.chave.split('-')[0])}
          hora={aberto.chave.split('-')[1]}
          semanas={aberto.item.semanas}
          semanasNoCiclo={semanasNoCiclo}
          ocupadasPorOutros={cheias(aberto.chave, aberto.item.horarioId)}
          aoMoverOuTrocar={() => {
            setMovendo({ ...aberto, de: semanaVista })
            setAberto(null)
          }}
          aoFechar={() => setAberto(null)}
        />
      )}

      {pendente && (
        <div className="mb-3 rounded-xl border-[1.5px] border-[#0A63C9] bg-[#e6f0ff] p-3">
          <p className="text-[13.5px] font-bold text-[#0A63C9]">
            {pendente.tipo === 'trocar' ? (
              <>
                {primeiroNome(pendente.origem.item.alunoNome)} vai para{' '}
                {ondeFica(pendente.destino.chave, deslocarSemanas(pendente.origem.item.semanas, pendente.deslocamento, semanasNoCiclo))}{' '}
                e {primeiroNome(pendente.destino.item.alunoNome)} vem para{' '}
                {ondeFica(pendente.origem.chave, deslocarSemanas(pendente.destino.item.semanas, -pendente.deslocamento, semanasNoCiclo))}.
                Confirmar?
              </>
            ) : (
              <>
                {primeiroNome(pendente.origem.item.alunoNome)} vai para {ondeFica(pendente.destinoChave, pendente.semanas)}.
                Confirmar?
              </>
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={confirmarPendente}
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

      {preenchendo && (
        <div className="mb-3 rounded-xl border-[1.5px] border-[#2EA84A] bg-[#e4f6e8] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13.5px] font-bold text-[#1c7a33]">
              {preenchendoMais ? `Mais uma criança em ${descreverSlot(preenchendo)}` : `Preencher ${descreverSlot(preenchendo)}`}
            </p>
            <button type="button" onClick={() => setPreenchendo(null)} className="text-xs font-bold text-slate-500">
              Fechar
            </button>
          </div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setModoNovoAluno(false)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                !modoNovoAluno ? 'bg-[#2EA84A] text-white' : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
              }`}
            >
              Aluno já cadastrado
            </button>
            <button
              type="button"
              onClick={() => setModoNovoAluno(true)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                modoNovoAluno ? 'bg-[#2EA84A] text-white' : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
              }`}
            >
              Novo aluno
            </button>
          </div>
          {modoNovoAluno ? (
            <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do aluno" className={classeCampo} />
          ) : (
            <>
              <input
                type="search"
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Buscar por nome…"
                className={classeCampo}
              />
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {candidatos.length === 0 ? (
                  <p className="p-3 text-[13px] text-slate-500">Nenhum aluno encontrado.</p>
                ) : (
                  <ul>
                    {candidatos.map((a) => (
                      <li key={a.id} className="border-b border-slate-50 last:border-0">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[#f4f7fc]">
                          <input
                            type="radio"
                            name="preencher-aluno"
                            checked={alunoEscolhido === a.id}
                            onChange={() => setAlunoEscolhido(a.id)}
                            className="h-4 w-4 accent-[#0A63C9]"
                          />
                          <span className="flex-1">{a.nome}</span>
                          {a.situacao === 'ESPERA' && (
                            <span className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8a6100]">
                              espera
                            </span>
                          )}
                          {aguardando.some((g) => g.alunoId === a.id) && (
                            <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[10.5px] font-bold text-[#0A63C9]">
                              aguardando horário
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          <div className="mt-3">
            <EscolherSemanas
              semanasNoCiclo={semanasNoCiclo}
              valor={semanasNovo}
              ocupadas={preenchendoMais ? 0 : cheias(preenchendo)}
              aoMudar={setSemanasNovo}
            />
          </div>
          <button
            type="button"
            disabled={ocupado}
            onClick={confirmarPreencher}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {ocupado ? 'Encaminhando…' : 'Encaminhar pra esse horário'}
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="mb-2 text-xs font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      {msg && (
        <p role="status" className="mb-2 text-xs font-bold text-[#1c7a33]">
          {msg}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-center text-[12.5px]">
          <thead>
            <tr>
              <th className="w-[64px] px-1 py-1 text-left text-[11px] uppercase text-slate-500">Hora</th>
              {[1, 2, 3, 4, 5].map((d) => (
                <th key={d} className="px-1 py-1 text-[11px] uppercase text-slate-500">
                  {DIAS[d]}
                  {marcandoIndisponivel && (
                    <BloquearDiaBotao
                      profissionalId={profissionalId}
                      diaSemana={d}
                      totalmenteIndisponivel={diaTotalmenteIndisponivel(d, indisponiveis, slots)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horasDaGrade(slots).map((h) => (
              <tr key={h} className="border-t border-slate-100">
                <td className="px-1 py-1 text-left font-bold">{h}</td>
                {[1, 2, 3, 4, 5].map((d) => {
                  const chave = `${d}-${h}`
                  const presentes = naSemana(chave)
                  if (presentes.length === 0 && !temSlot(slots, d, h)) {
                    return (
                      <td key={d} className="px-1 py-1 text-[15px] text-slate-300" title="Sem atendimento neste horário">
                        ·
                      </td>
                    )
                  }
                  const duracao = duracaoDoSlot(slots, d, h)
                  const rotuloDuracao =
                    duracao && duracao !== DURACAO_PADRAO ? (
                      <span className="block text-[10px] text-slate-400">{duracao} min</span>
                    ) : null
                  const pilula = 'inline-flex min-h-[32px] min-w-[44px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold'

                  if (presentes.length === 0) {
                    const marcado = indisponiveis.has(chave)
                    let conteudo
                    if (movendo) {
                      conteudo = cabeAqui(chave) && !marcado ? (
                        <button
                          type="button"
                          disabled={ocupado || pendente !== null}
                          onClick={() => clicarLivre(chave)}
                          className={`${pilula} bg-[#2EA84A] text-white disabled:opacity-60`}
                        >
                          mover pra cá
                        </button>
                      ) : (
                        <span className={`${pilula} bg-slate-100 text-slate-300`} title="Bate com outro aluno em alguma das semanas">
                          {h}
                        </span>
                      )
                    } else if (marcandoIndisponivel) {
                      conteudo = (
                        <div className="flex items-center justify-center gap-1">
                          <span className={`${pilula} ${marcado ? 'bg-slate-100 text-slate-400 line-through' : 'bg-[#e4f6e8] text-[#1c7a33]'}`}>
                            {h}
                          </span>
                          <MarcarIndisponivelBotao profissionalId={profissionalId} diaSemana={d} hora={h} indisponivel={marcado} />
                        </div>
                      )
                    } else if (editavel && areaId !== '' && !marcado) {
                      conteudo = (
                        <button
                          type="button"
                          onClick={() => clicarLivre(chave)}
                          className={`${pilula} ${
                            preenchendo === chave ? 'bg-[#2EA84A] text-white outline outline-2 outline-[#1c7a33]' : 'bg-[#e4f6e8] text-[#1c7a33]'
                          }`}
                        >
                          {h}
                        </button>
                      )
                    } else {
                      conteudo = (
                        <span className={`${pilula} ${marcado ? 'bg-slate-100 text-slate-400 line-through' : 'bg-[#e4f6e8] text-[#1c7a33]'}`}>
                          {h}
                        </span>
                      )
                    }
                    return (
                      <td key={d} className="px-1 py-1">
                        {conteudo}
                        {rotuloDuracao}
                      </td>
                    )
                  }

                  const vagas = vagasDeChave(chave)
                  const temVaga = vagas > presentes.length
                  const pilulaDe = (item: ItemAgenda) => {
                    const selecionadoAqui = movendo?.item.horarioId === item.horarioId || aberto?.item.horarioId === item.horarioId
                    const alvoDeTroca = !!movendo && !selecionadoAqui
                    const etiqueta = (
                      <span
                        className={`${pilula} ${corDaFrequencia(item.semanas, semanasNoCiclo)} ${
                          selecionadoAqui ? 'outline outline-2 outline-[#0A63C9]' : alvoDeTroca ? 'outline-2 outline-dashed outline-[#0070F0]' : ''
                        }`}
                      >
                        {alvoDeTroca ? `⇄ ${primeiroNome(item.alunoNome)}` : primeiroNome(item.alunoNome)}
                      </span>
                    )
                    return editavel ? (
                      <button
                        key={item.horarioId}
                        type="button"
                        disabled={ocupado || pendente !== null}
                        aria-expanded={aberto?.item.horarioId === item.horarioId}
                        onClick={() => clicarOcupado(chave, item)}
                      >
                        {etiqueta}
                      </button>
                    ) : linkAluno ? (
                      <Link key={item.horarioId} href={`/alunos/${item.alunoId}`}>{etiqueta}</Link>
                    ) : (
                      <span key={item.horarioId}>{etiqueta}</span>
                    )
                  }
                  // Horário com criança: o "+" leva mais uma para junto (vira horário de grupo sozinho).
                  // Com uma criança na mão, só aparece "mover pra cá" onde ainda sobra vaga.
                  const vagaSobrando =
                    editavel && areaId !== '' && !indisponiveis.has(chave) && !marcandoIndisponivel
                      ? movendo
                        ? temVaga && cabeAqui(chave) && (
                            <button
                              type="button"
                              disabled={ocupado || pendente !== null}
                              onClick={() => clicarLivre(chave)}
                              className={`${pilula} bg-[#2EA84A] text-white disabled:opacity-60`}
                            >
                              mover pra cá
                            </button>
                          )
                        : (
                            <button
                              type="button"
                              aria-label={`Colocar mais uma criança em ${descreverSlot(chave)}`}
                              onClick={() => clicarMais(chave)}
                              className={`${pilula} ${
                                preenchendo === chave ? 'bg-[#2EA84A] text-white outline outline-2 outline-[#1c7a33]' : 'bg-[#e4f6e8] text-[#1c7a33]'
                              }`}
                            >
                              +
                            </button>
                          )
                      : null
                  return (
                    <td key={d} className="px-1 py-1">
                      <div className="flex flex-col items-center gap-1">
                        {presentes.map((item) => pilulaDe(item))}
                        {vagaSobrando}
                      </div>
                      {rotuloDuracao}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aguardando.length > 0 && (
        <div className="mt-3 rounded-xl border border-[#0A63C9]/30 bg-[#e6f0ff] p-3 text-[13px]">
          <strong className="text-[#0A63C9]">Aguardando horário ({aguardando.length}):</strong>{' '}
          {aguardando.map((a, i) => (
            <span key={a.alunoId}>
              {i > 0 && ', '}
              {linkAluno ? (
                <Link href={`/alunos/${a.alunoId}`} className="font-bold text-[#0A63C9]">
                  {a.nome}
                </Link>
              ) : (
                a.nome
              )}
            </span>
          ))}
          {editavel && (
            <p className="mt-1 text-[12px] text-slate-600">
              Para recolocar, toque num horário verde e escolha a criança: quem aguarda horário aparece primeiro.
            </p>
          )}
        </div>
      )}

      {semanasNoCiclo > 1 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
          <span className="rounded-full bg-[#e6f0ff] px-2 py-0.5 font-bold text-[#0A63C9]">toda semana</span>
          <span className="rounded-full bg-[#efe7fb] px-2 py-0.5 font-bold text-[#6b3fb8]">quinzenal</span>
          <span className="rounded-full bg-[#fff6d6] px-2 py-0.5 font-bold text-[#8a6100]">mensal</span>
          <span className="rounded-full bg-[#e4f6e8] px-2 py-0.5 font-bold text-[#1c7a33]">livre nesta semana</span>
        </p>
      )}
    </div>
  )
}
