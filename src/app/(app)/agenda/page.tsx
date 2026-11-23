import { slotsDoProfissional } from '@/lib/slots'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { gerarSemana, segundaDaSemana } from '@/domain/agenda'
import { rotuloSemanas, semanaDoCiclo } from '@/domain/semanas'
import { situacaoDasFaltas } from '@/domain/faltas'
import { diaSemAtendimento } from '@/domain/conflitos'
import Cabecalho from '@/components/Cabecalho'
import { formatarDataHora, hojeDoCentro } from '@/lib/fuso'
import { diasSemAtendimentoEntre } from '@/lib/diasSemAtendimento'
import EncerrarAtendimentoBotao from '@/components/EncerrarAtendimentoBotao'
import LancarForaDaAgenda from '@/components/LancarForaDaAgenda'
import { podeLancarNoDia, textoLancadoDepois } from '@/domain/presenca'
import { soConsultas } from '@/lib/consultas'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDia(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [a, m, d] = v.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  return Number.isNaN(data.getTime()) ? null : data
}

function textoData(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

function PilaSituacao({ situacao }: { situacao: string }) {
  if (situacao === 'REALIZADO') {
    return (
      <span className="inline-block rounded-full bg-[#e4f6e8] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1c7a33]">
        Realizado
      </span>
    )
  }
  if (situacao === 'FALTOU') {
    return (
      <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[11.5px] font-bold text-[#B3261E]">
        Faltou
      </span>
    )
  }
  if (situacao === 'JUSTIFICOU') {
    return (
      <span className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[11.5px] font-bold text-[#8a6100]">
        Justificou
      </span>
    )
  }
  if (situacao === 'CANCELADO') {
    return (
      <span className="inline-block rounded-full bg-slate-200 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">
        Cancelado
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-500">
      Aguardando
    </span>
  )
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; dia?: string; ok?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil === 'ADMIN') redirect('/painel')

  // Psiquiatra / assistente social sem nenhum horário fixo: a agenda ficaria vazia,
  // o dia dele está em Consultas. (Quem tem horário fixo também continua vendo a agenda.)
  if (await soConsultas(sessao.user.id)) redirect('/consultas')

  const { semana, dia, ok } = await searchParams
  const ref = parseDia(semana) ?? hojeDoCentro()
  const segunda = segundaDaSemana(ref)
  const sexta = new Date(segunda)
  sexta.setDate(segunda.getDate() + 4)
  const segISO = isoLocal(segunda)

  const hoje = hojeDoCentro()
  const hojeISO = isoLocal(hoje)
  const diaEscolhido = parseDia(dia)

  const diasSemana = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(segunda)
    d.setDate(segunda.getDate() + i)
    return d
  })
  const indisponiveisBrutos = await prisma.horarioIndisponivel.findMany({
    where: { profissionalId: sessao.user.id },
    select: { diaSemana: true, hora: true },
  })
  const indisponiveis = new Set(indisponiveisBrutos.map((i) => `${i.diaSemana}-${i.hora}`))
  const slotsDoUsuario = await slotsDoProfissional(sessao.user.id)
  const diasVisiveis = diasSemana.filter((d) => {
    const diaNum = ((d.getDay() + 6) % 7) + 1
    return !diaSemAtendimento(diaNum, indisponiveis, slotsDoUsuario)
  })

  const diaISOCandidato =
    diaEscolhido && diaEscolhido >= segunda && diaEscolhido <= sexta
      ? isoLocal(diaEscolhido)
      : hojeISO >= segISO && hojeISO <= isoLocal(sexta)
        ? hojeISO
        : segISO
  // Se o dia padrão calculado acima caiu num dia totalmente indisponível
  // (ex.: segunda bloqueada e ninguém escolheu outro dia), usa o primeiro
  // dia visível no lugar — nunca deixa a tela sem nenhum dia ativo.
  const diaISO =
    diasVisiveis.length === 0 || diasVisiveis.some((d) => isoLocal(d) === diaISOCandidato)
      ? diaISOCandidato
      : isoLocal(diasVisiveis[0])
  const semAtendimento = await diasSemAtendimentoEntre(segunda, sexta)
  const motivoDoDia = semAtendimento.get(diaISO) ?? null

  // Uma única consulta traz tudo o que a tela precisa.
  const vinculos = await prisma.vinculo.findMany({
    where: { profissionalId: sessao.user.id },
    include: {
      aluno: true,
      area: { select: { nome: true } },
      profissional: { select: { semanasNoCiclo: true, cicloInicio: true } },
      horarios: { where: { excluidoEm: null } },
      atendimentos: {
        where: {
          data: {
            gte: new Date(`${segISO}T00:00:00`),
            lt: new Date(`${isoLocal(new Date(sexta.getTime() + 86400000))}T00:00:00`),
          },
        },
        include: { lembrete: true, registradoPor: { select: { nome: true } } },
      },
    },
  })

  const porVinculo = new Map(vinculos.map((v) => [v.id, v]))
  const localPorSlot = new Map<string, string | null>()
  const rotuloPorSlot = new Map<string, string>()
  for (const v of vinculos) {
    for (const h of v.horarios) {
      localPorSlot.set(`${v.id}|${h.diaSemana}|${h.hora}`, h.local)
      rotuloPorSlot.set(
        `${v.id}|${h.diaSemana}|${h.hora}`,
        rotuloSemanas(h.semanas, v.profissional.semanasNoCiclo),
      )
    }
  }

  // Últimos atendimentos de cada vínculo para o alerta de faltas seguidas (1 consulta),
  // mais a última providência da direção de cada aluno (só a data que ela cobre).
  const historico = await prisma.atendimento.findMany({
    where: {
      vinculoId: { in: vinculos.map((v) => v.id) },
      situacao: { not: 'AGENDADO' },
      avulso: false, // consulta avulsa não conta nas faltas seguidas
    },
    orderBy: { data: 'asc' },
  })
  const providencias = await prisma.providenciaFalta.findMany({
    where: { alunoId: { in: vinculos.map((v) => v.alunoId) } },
    select: { alunoId: true, cobreAte: true },
  })
  const cobreAtePorAluno = new Map<string, Date>()
  for (const p of providencias) {
    const atual = cobreAtePorAluno.get(p.alunoId)
    if (!atual || p.cobreAte > atual) cobreAtePorAluno.set(p.alunoId, p.cobreAte)
  }
  const faltasPorAluno = new Map<string, 'AVISO' | 'PROVIDENCIA' | null>()
  for (const v of vinculos) {
    faltasPorAluno.set(
      v.alunoId,
      situacaoDasFaltas(
        historico
          .filter((h) => h.vinculoId === v.id)
          .map((h) => ({ situacao: h.situacao, data: h.data })),
        cobreAtePorAluno.get(v.alunoId) ?? null,
      ),
    )
  }
  const slots = gerarSemana(
    vinculos.flatMap((v) =>
      v.horarios.map((h) => ({
        vinculoId: v.id,
        diaSemana: h.diaSemana,
        hora: h.hora,
        vigenteAte: h.vigenteAte,
        vinculoFim: v.fim,
        semanas: h.semanas,
        semanasNoCiclo: v.profissional.semanasNoCiclo,
        cicloInicio: v.profissional.cicloInicio,
      })),
    ),
    segunda,
  )

  // Pode lançar neste dia? Além de 30 dias para trás, só a direção.
  const podeLancar = podeLancarNoDia(sessao.user.perfil, diaISO, hojeISO)

  const sessoesFixas = slots.filter((s) => isoLocal(s.data) === diaISO)
  const chavesFixas = new Set(sessoesFixas.map((s) => `${s.vinculoId}|${s.hora}`))
  // Atendimentos que já existem no dia mas não estão nos horários fixos (reposição).
  const foraDaAgenda = vinculos.flatMap((v) =>
    v.atendimentos
      .filter((a) => a.data.toISOString().slice(0, 10) === diaISO && !chavesFixas.has(`${v.id}|${a.hora}`))
      .map((a) => ({ vinculoId: v.id, hora: a.hora })),
  )

  const doDia = [
    ...sessoesFixas.map((s) => ({ vinculoId: s.vinculoId, hora: s.hora, fixa: true, dia: s.data })),
    ...foraDaAgenda.map((f) => ({ vinculoId: f.vinculoId, hora: f.hora, fixa: false, dia: null as Date | null })),
  ]
    .map((s) => {
      const v = porVinculo.get(s.vinculoId)!
      const atendimento = v.atendimentos.find(
        (a) => a.data.toISOString().slice(0, 10) === diaISO && a.hora === s.hora,
      )
      const diaNum = s.dia ? ((s.dia.getDay() + 6) % 7) + 1 : 0
      const local = localPorSlot.get(`${s.vinculoId}|${diaNum}|${s.hora}`) ?? null
      const rotulo = rotuloPorSlot.get(`${s.vinculoId}|${diaNum}|${s.hora}`) ?? ''
      return {
        vinculoId: s.vinculoId,
        hora: s.hora,
        foraDaAgenda: !s.fixa,
        aluno: v.aluno,
        situacao: atendimento?.situacao ?? 'AGENDADO',
        local: local && local.trim().toUpperCase() !== 'CAEELA' ? local : null,
        rotulo,
        confirmadoEm: atendimento?.confirmadoEm ?? null,
        lancadoDepois: textoLancadoDepois(diaISO, atendimento?.confirmadoEm ?? null),
        registradoPorNome: atendimento?.registradoPor?.nome ?? null,
        statusFamilia:
          (atendimento?.situacao ?? 'AGENDADO') !== 'AGENDADO'
            ? null
            : atendimento?.lembrete?.resposta === 'VAI'
              ? ('confirmou' as const)
              : atendimento?.lembrete?.resposta === 'NAO_VAI'
                ? ('nao_vai' as const)
                : atendimento?.lembrete?.enviadoEm
                  ? ('aguardando' as const)
                  : null,
      }
    })
    .sort((a, b) => a.hora.localeCompare(b.hora))

  // Crianças que o profissional atende hoje (só vínculos abertos), para lançar fora da agenda.
  const abertos = vinculos.filter((v) => v.fim === null)
  const opcoesForaDaAgenda = abertos
    .map((v) => ({
      vinculoId: v.id,
      rotulo:
        abertos.filter((x) => x.alunoId === v.alunoId).length > 1
          ? `${v.aluno.nome} · ${v.area.nome}`
          : v.aluno.nome,
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  const mostrarForaDaAgenda = podeLancar && diaISO <= hojeISO && !motivoDoDia && opcoesForaDaAgenda.length > 0

  const contagem: Record<string, number> = {}
  for (const s of slots) {
    const iso = isoLocal(s.data)
    contagem[iso] = (contagem[iso] ?? 0) + 1
  }

  const agoraHHMM = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`
  const indiceAgora =
    diaISO === hojeISO ? doDia.findIndex((s) => s.hora >= agoraHHMM) : -1

  const anterior = new Date(segunda)
  anterior.setDate(segunda.getDate() - 7)
  const proxima = new Date(segunda)
  proxima.setDate(segunda.getDate() + 7)

  const dataEscolhida = parseDia(diaISO) ?? segunda
  const detalhe = 'Profissional'
  const eu = await prisma.usuario.findUnique({ where: { id: sessao.user.id }, select: { semanasNoCiclo: true, cicloInicio: true, tipoAgenda: true } })
  const meuCiclo = { semanasNoCiclo: eu?.semanasNoCiclo ?? 1, cicloInicio: eu?.cicloInicio ?? null }

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe={detalhe} itemAtivo="Agenda" menu="profissional" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
          Minha agenda
          {meuCiclo.semanasNoCiclo > 1 && (
            <span className="rounded-full bg-[#e6f0ff] px-2 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
              Semana {semanaDoCiclo(meuCiclo, new Date(`${diaISO}T12:00:00`))}
            </span>
          )}
        </h1>
        {eu?.tipoAgenda && eu.tipoAgenda !== 'FIXA' && (
          <p className="mb-3 rounded-xl border border-[#0A63C9]/30 bg-[#e6f0ff] px-4 py-3 text-sm font-bold text-[#0A63C9]">
            Seus atendimentos ficam em{' '}
            <Link href="/consultas" className="underline">
              Consultas
            </Link>
            .
          </p>
        )}
        {ok === 'presenca' && (
          <p role="status" className="mb-2 rounded-lg border border-[#2EA84A]/30 bg-[#2EA84A]/10 px-4 py-3 text-sm font-bold text-[#1c7a33]">
            Presença registrada.
          </p>
        )}
        <p className="mb-1 text-[13px] text-slate-500">
          Semana de {textoData(segunda)} a {textoData(sexta)} · horários fixos
        </p>
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/agenda?semana=${isoLocal(anterior)}`}
            className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 font-bold text-[#0A63C9]"
          >
            ← Anterior
          </Link>
          <Link
            href="/agenda"
            className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 font-bold text-[#0A63C9]"
          >
            Hoje
          </Link>
          <Link
            href={`/agenda?semana=${isoLocal(proxima)}`}
            className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 font-bold text-[#0A63C9]"
          >
            Próxima →
          </Link>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Esqueceu de lançar? Volte a semana em ← Anterior e toque no dia.
        </p>

        {slots.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Você ainda não tem alunos encaminhados. Fale com a direção.
          </p>
        ) : (
          <>
            <div
              className="mb-4 grid gap-2 text-center text-[12.5px]"
              style={{ gridTemplateColumns: `repeat(${diasVisiveis.length}, minmax(0, 1fr))` }}
            >
              {diasVisiveis.map((d) => {
                const iso = isoLocal(d)
                const agora = iso === hojeISO
                return (
                  <Link
                    key={iso}
                    href={`/agenda?semana=${segISO}&dia=${iso}`}
                    className={`rounded-lg border px-1 py-2 ${
                      agora
                        ? 'border-[#0A63C9] bg-[#0A63C9] font-bold text-white'
                        : iso === diaISO
                          ? 'border-[#0A63C9] bg-[#e6f0ff] font-bold text-[#0A63C9]'
                          : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {DIAS[(d.getDay() + 6) % 7 + 1]}
                    <br />
                    {semAtendimento.has(iso) ? (
                      <span className="text-[11px] font-bold">sem atendimento</span>
                    ) : (
                      <>
                        <strong>{contagem[iso] ?? 0}</strong>{' '}
                        {(contagem[iso] ?? 0) === 1 ? 'aluno' : 'alunos'}
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
            {motivoDoDia ? (
              <p role="status" className="rounded-xl border border-[#B3261E]/30 bg-[#fde7e7] p-5 text-center text-sm text-slate-700">
                <strong>Sem atendimento neste dia:</strong> {motivoDoDia}. Nenhuma presença ou falta é registrada.
              </p>
            ) : doDia.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-600">
                Nenhum atendimento neste dia.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {doDia.map((s, i) => (
                  <div
                    key={`${s.hora}-${s.vinculoId}`}
                    className={`rounded-xl border border-slate-200 px-4 py-3 text-[13.5px] ${
                      i === indiceAgora ? 'bg-[#eef6ff]' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">
                          {s.hora}
                          {s.local && (
                            <span className="ml-1 font-normal text-[11px] text-slate-500">
                              📍 {s.local}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5">
                          <strong>{s.aluno.nome}</strong>{' '}
                          <span className="text-[11.5px] text-slate-500">{s.aluno.matricula}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.foraDaAgenda && (
                            <span className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8a6100]">
                              fora da agenda
                            </span>
                          )}
                          {s.rotulo !== '' && (
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-500">
                              {s.rotulo}
                            </span>
                          )}
                          {doDia.filter((x) => x.hora === s.hora).length > 1 && (
                            <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[10.5px] font-bold text-[#0A63C9]">
                              em grupo ({doDia.filter((x) => x.hora === s.hora).length})
                            </span>
                          )}
                          {faltasPorAluno.get(s.aluno.id) === 'AVISO' && (
                            <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[10.5px] font-bold text-[#B3261E]">
                              2 faltas seguidas
                            </span>
                          )}
                          {faltasPorAluno.get(s.aluno.id) === 'PROVIDENCIA' && (
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-500">
                              providência registrada
                            </span>
                          )}
                          {s.statusFamilia === 'confirmou' && (
                            <span className="inline-block rounded-full bg-[#e4f6e8] px-2.5 py-0.5 text-[10.5px] font-bold text-[#1c7a33]">
                              família confirmou
                            </span>
                          )}
                          {s.statusFamilia === 'nao_vai' && (
                            <span className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8a6100]">
                              família avisou que não vai
                            </span>
                          )}
                          {s.statusFamilia === 'aguardando' && (
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-500">
                              lembrete enviado, sem resposta
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <PilaSituacao situacao={s.situacao} />
                        {s.confirmadoEm && (
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {s.registradoPorNome ?? 'equipe'} ·{' '}
                            {formatarDataHora(s.confirmadoEm)}
                          </span>
                        )}
                        {s.lancadoDepois && (
                          <span className="block text-[11px] text-slate-500">{s.lancadoDepois}</span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[12.5px] text-slate-500">
                      Responsável: {s.aluno.responsavel ?? '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {podeLancar ? (
                        <Link
                          href={`/atendimento/${s.vinculoId}?data=${diaISO}&hora=${s.hora}`}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white"
                        >
                          Atender
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-[44px] items-center text-xs text-slate-500">
                          Mais de 30 dias: só a direção pode lançar.
                        </span>
                      )}
                      <Link
                        href={`/alunos/${s.aluno.id}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-xs font-bold text-[#0A63C9]"
                      >
                        Ver ficha
                      </Link>
                      <EncerrarAtendimentoBotao
                        vinculoId={s.vinculoId}
                        alunoNome={s.aluno.nome}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {mostrarForaDaAgenda && <LancarForaDaAgenda dia={diaISO} opcoes={opcoesForaDaAgenda} />}
            <p className="mt-2 text-xs text-slate-500">
              {textoData(dataEscolhida)} · {doDia.length}{' '}
              {doDia.length === 1 ? 'atendimento' : 'atendimentos'}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
