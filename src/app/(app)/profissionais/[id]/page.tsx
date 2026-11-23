import { slotsDoProfissional } from '@/lib/slots'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { estaNaSemana, semanaDoCiclo, semanasCheias, todasAsSemanas } from '@/domain/semanas'
import { vagasDoSlot } from '@/domain/grade'
import { semVazioRepetido } from '@/domain/aguardando'
import Cabecalho from '@/components/Cabecalho'
import GradeSemanalEditavel, { type CelulaAgenda } from '@/components/GradeSemanalEditavel'
import SemanasDoProfissional, { type SemanaResumo } from '@/components/SemanasDoProfissional'
import EtiquetaSemanas from '@/components/EtiquetaSemanas'
import PainelHorarioAluno from '@/components/PainelHorarioAluno'
import MarcarConsulta from '@/components/MarcarConsulta'
import { agendaAvulsa, diaIso, ROTULO_BLOCO } from '@/domain/consultas'
import { hojeNoFuso } from '@/lib/fuso'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const ABAS = [
  { id: 'agenda', rotulo: 'Agenda' },
  { id: 'alunos', rotulo: 'Alunos' },
  { id: 'historico', rotulo: 'Histórico' },
] as const

type Aba = (typeof ABAS)[number]['id']

function abaValida(v?: string): Aba {
  return ABAS.some((a) => a.id === v) ? (v as Aba) : 'agenda'
}

function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const ROTULO_SITUACAO: Record<string, string> = {
  REALIZADO: 'Realizado',
  FALTOU: 'Faltou',
  JUSTIFICOU: 'Justificou',
  CANCELADO: 'Cancelado',
}

export default async function PaginaFichaProfissional({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string; semana?: string; mover?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const eAdmin = sessao.user.perfil === 'ADMIN'

  const { id } = await params
  const profissional = await prisma.usuario.findUnique({
    where: { id },
    include: { area: true },
  })
  if (!profissional || profissional.perfil !== 'PROFISSIONAL') notFound()
  if (!eAdmin && id !== sessao.user.id) redirect('/agenda')

  const { aba, semana, mover } = await searchParams
  const abaAtual = abaValida(aba)

  const corte30 = new Date()
  corte30.setDate(corte30.getDate() - 30)

  // As cinco consultas abaixo são independentes entre si — rodam juntas.
  const [vinculos, ultimos30, historico, alunosParaEncaminhar, indisponiveisBrutos] = await Promise.all([
    prisma.vinculo.findMany({
      where: { profissionalId: id, fim: null },
      include: { horarios: { where: { excluidoEm: null } }, aluno: true, area: true },
      orderBy: { inicio: 'asc' },
    }),
    prisma.atendimento.findMany({
      where: { vinculo: { profissionalId: id }, situacao: { not: 'AGENDADO' }, data: { gte: corte30 } },
      select: { situacao: true },
    }),
    abaAtual === 'historico'
      ? prisma.atendimento.findMany({
          where: { vinculo: { profissionalId: id }, situacao: { not: 'AGENDADO' } },
          include: { vinculo: { select: { aluno: { select: { id: true, nome: true } } } } },
          orderBy: [{ data: 'desc' }, { hora: 'desc' }],
          take: 20,
        })
      : Promise.resolve([]),
    eAdmin
      ? prisma.aluno.findMany({
          where: { excluidoEm: null, deFora: false, situacao: { not: 'DESLIGADO' } },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, matricula: true, situacao: true },
        })
      : Promise.resolve([]),
    prisma.horarioIndisponivel.findMany({
      where: { profissionalId: id },
      select: { diaSemana: true, hora: true },
    }),
  ])
  const indisponiveis = new Set(indisponiveisBrutos.map((i) => `${i.diaSemana}-${i.hora}`))
  const slots = await slotsDoProfissional(id)

  // Agenda em semanas: cada profissional tem a sua contagem (Semana 1..N).
  const ciclo = { semanasNoCiclo: profissional.semanasNoCiclo, cicloInicio: profissional.cicloInicio }
  const hoje = new Date()
  const semanaAtual = semanaDoCiclo(ciclo, hoje)
  const pedida = Number(semana)
  const semanaVista =
    Number.isInteger(pedida) && pedida >= 1 && pedida <= ciclo.semanasNoCiclo ? pedida : semanaAtual

  // Cada lugar da grade (dia + hora) com todos os horários de aluno nele, em qualquer semana.
  const horariosVivos = vinculos.flatMap((v) => v.horarios.filter((h) => !h.excluidoEm).map((h) => ({ v, h })))
  const celulas = new Map<string, CelulaAgenda>()
  for (const { v, h } of horariosVivos) {
    const chave = `${h.diaSemana}-${h.hora}`
    const celula = celulas.get(chave) ?? { itens: [] }
    celula.itens.push({ horarioId: h.id, vinculoId: v.id, alunoId: v.aluno.id, alunoNome: v.aluno.nome, semanas: h.semanas })
    celulas.set(chave, celula)
  }
  const vagasDe = (chave: string) => {
    const [dia, hora] = chave.split('-')
    return vagasDoSlot(slots, Number(dia), hora)
  }
  // Ocupado na semana = as vagas do horário acabaram (horário individual: uma criança).
  const ocupadaNaSemana = (chave: string, n: number) =>
    (celulas.get(chave)?.itens ?? []).filter((i) => estaNaSemana(i.semanas, n)).length >= vagasDe(chave)
  const ocupadasPorOutros = (horarioId: string, chave: string) =>
    semanasCheias(
      (celulas.get(chave)?.itens ?? []).filter((i) => i.horarioId !== horarioId).map((i) => i.semanas),
      vagasDe(chave),
      ciclo.semanasNoCiclo,
    )

  const atendimentosSemana = horariosVivos.filter(({ h }) => estaNaSemana(h.semanas, semanaAtual)).length
  const livres = slots.filter((s) => {
    const chave = `${s.diaSemana}-${s.hora}`
    return !ocupadaNaSemana(chave, semanaAtual) && !indisponiveis.has(chave)
  }).length
  const realizados30 = ultimos30.filter((a) => a.situacao === 'REALIZADO').length
  const faltas30 = ultimos30.filter((a) => a.situacao === 'FALTOU').length

  // Para a direção reconhecer cada semana: quem vem nela sem vir toda semana. Sem datas nas
  // abas, de propósito: a semana se reconhece pela turma.
  const todas = todasAsSemanas(ciclo.semanasNoCiclo)
  const semanasResumo: SemanaResumo[] = Array.from({ length: ciclo.semanasNoCiclo }, (_, i) => i + 1).map((n) => {
    const nomes = [
      ...new Set(
        horariosVivos
          .filter(({ h }) => estaNaSemana(h.semanas, n) && h.semanas !== todas)
          .map(({ v }) => v.aluno.nome.split(' ')[0]),
      ),
    ].sort()
    return { n, nomes }
  })

  // Psiquiatra / assistente social: atendem por consultas marcadas por dia e hora. A aba Agenda
  // mostra as próximas consultas e o "+ Marcar consulta" (aluno do centro ou pessoa de fora);
  // a grade semanal só aparece se ele tiver também algum horário fixo.
  const porConsultas = agendaAvulsa(profissional.tipoAgenda)
  const hojeISO = hojeNoFuso()
  const proximasConsultas =
    porConsultas && abaAtual === 'agenda'
      ? await prisma.atendimento.findMany({
          where: {
            avulso: true,
            situacao: 'AGENDADO',
            data: { gte: new Date(`${hojeISO}T00:00:00`) },
            vinculo: { profissionalId: id, aluno: { excluidoEm: null } },
          },
          select: { id: true, data: true, hora: true, vinculo: { select: { aluno: { select: { id: true, nome: true, deFora: true } } } } },
          orderBy: [{ data: 'asc' }, { hora: 'asc' }],
          take: 15,
        })
      : []

  const linhasAlunos = [...horariosVivos].sort(
    (a, b) => a.v.aluno.nome.localeCompare(b.v.aluno.nome) || a.h.diaSemana - b.h.diaSemana || a.h.hora.localeCompare(b.h.hora),
  )
  // Só quem não tem horário nenhum com este profissional (sobras da importação deixaram alguns
  // alunos com um segundo atendimento vazio).
  const vinculosSemHorario = semVazioRepetido(vinculos, (v) => v.aluno.id).filter((v) => v.horarios.length === 0)
  const aguardando = vinculosSemHorario.map((v) => ({ alunoId: v.aluno.id, nome: v.aluno.nome }))

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eAdmin ? 'Direção' : 'Profissional'}
        itemAtivo={eAdmin ? 'Profissionais' : 'Agenda'}
        menu={eAdmin ? 'admin' : 'profissional'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <Link
          href={eAdmin ? '/profissionais' : '/agenda'}
          className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]"
        >
          ← Voltar
        </Link>
        <h1 className="text-xl font-extrabold">
          {profissional.nome}{' '}
          <span className="text-[13px] font-normal text-slate-500">
            · {profissional.area?.nome ?? '—'}
          </span>
        </h1>
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
          {profissional.ativo ? (
            <span className="inline-block rounded-full bg-[#e4f6e8] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1c7a33]">
              Ativo
            </span>
          ) : (
            <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[11.5px] font-bold text-[#B3261E]">
              Inativo
            </span>
          )}
          <Link href={`/profissionais/${id}/ausencias`} className="font-bold text-[#0A63C9]">
            📋 Frequência / Ausências
          </Link>
        </p>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#0A63C9] bg-white p-3">
            <strong className="block text-2xl leading-none text-[#0A63C9]">{vinculos.length}</strong>
            <span className="text-[11.5px] text-slate-500">alunos atendidos</span>
          </div>
          <div className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#0A63C9] bg-white p-3">
            <strong className="block text-2xl leading-none text-[#0A63C9]">{atendimentosSemana}</strong>
            <span className="text-[11.5px] text-slate-500">atendimentos nesta semana</span>
          </div>
          <div className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#2EA84A] bg-white p-3">
            <strong className="block text-2xl leading-none text-[#1c7a33]">{livres}</strong>
            <span className="text-[11.5px] text-slate-500">horários livres nesta semana</span>
          </div>
          <div className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#F0C000] bg-white p-3">
            <strong className="block text-2xl leading-none text-[#8a6100]">
              {realizados30} ✔ / {faltas30} faltas
            </strong>
            <span className="text-[11.5px] text-slate-500">nos últimos 30 dias</span>
          </div>
        </div>

        <nav className="mb-4 flex flex-wrap gap-4 rounded-t-lg border-b-2 border-slate-200 bg-white px-2 text-[13.5px]">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={`/profissionais/${id}?aba=${a.id}`}
              className={
                abaAtual === a.id
                  ? '-mb-[2px] border-b-[3px] border-[#0A63C9] px-0.5 py-2.5 font-bold text-[#0A63C9]'
                  : 'px-0.5 py-2.5 text-slate-500'
              }
            >
              {a.rotulo}
            </Link>
          ))}
        </nav>

        {abaAtual === 'agenda' && porConsultas && (
          <section className="mb-4 rounded-xl border border-[#0A63C9]/30 bg-[#eef5ff] p-4">
            <p className="font-extrabold text-[#0A63C9]">
              {ROTULO_BLOCO[profissional.tipoAgenda] ?? 'Agenda própria'}: atende por dia e hora, sem horário fixo na semana.
            </p>
            <p className="mt-1 text-[13.5px] text-slate-700">
              Para colocar alguém num dia e horário, use <strong>+ Marcar consulta</strong>: escolha um aluno do centro, uma
              pessoa de fora já atendida ou cadastre uma pessoa de fora nova.
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {eAdmin && (
                <MarcarConsulta profissionalId={id} profissionalNome={profissional.nome} rotulo="+ Marcar consulta" destaque />
              )}
              <Link
                href="/consultas"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]"
              >
                Ver tudo em Consultas
              </Link>
            </div>
            <h2 className="mb-2 mt-4 text-[14px] font-extrabold">Próximas consultas</h2>
            {proximasConsultas.length === 0 ? (
              <p className="text-[13px] text-slate-500">Nenhuma consulta marcada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {proximasConsultas.map((c) => {
                  const dia = diaIso(c.data)
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="min-w-[120px] font-bold">
                        {dia === hojeISO ? 'Hoje' : formatarData(c.data)} · {c.hora}
                      </span>
                      <Link href={`/alunos/${c.vinculo.aluno.id}`} className="font-bold text-[#0A63C9] underline">
                        {c.vinculo.aluno.nome}
                      </Link>
                      {c.vinculo.aluno.deFora && (
                        <span className="inline-block rounded-full bg-[#efe7fb] px-2.5 py-0.5 text-[11.5px] font-bold text-[#5b2fa0]">
                          de fora
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
        {abaAtual === 'agenda' && porConsultas && horariosVivos.length === 0 ? null : abaAtual === 'agenda' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SemanasDoProfissional
              profissionalId={id}
              semanasNoCiclo={ciclo.semanasNoCiclo}
              semanaVista={semanaVista}
              semanaAtual={semanaAtual}
              semanas={semanasResumo}
              editavel={eAdmin}
            />
            <GradeSemanalEditavel
              celulas={celulas}
              semanaVista={semanaVista}
              semanasNoCiclo={ciclo.semanasNoCiclo}
              editavel={eAdmin}
              alunos={alunosParaEncaminhar}
              profissionalId={id}
              areaId={profissional.areaId ?? ''}
              indisponiveis={indisponiveis}
              slots={slots}
              profissionalNome={profissional.nome}
              moverInicial={eAdmin ? mover : undefined}
              aguardando={aguardando}
            />
          </div>
        ) : abaAtual === 'alunos' ? (
          vinculos.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Nenhum aluno vigente com este profissional.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linhasAlunos.map(({ v, h }) => (
                <li key={h.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <Link href={`/alunos/${v.aluno.id}`} className="font-bold text-[#0A63C9]">
                    {v.aluno.nome}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
                    desde {formatarData(v.inicio)} · {DIAS[h.diaSemana]} {h.hora}
                    <EtiquetaSemanas semanas={h.semanas} semanasNoCiclo={ciclo.semanasNoCiclo} completa />
                  </p>
                  {eAdmin && (
                    <PainelHorarioAluno
                      variante="linha"
                      horarioId={h.id}
                      vinculoId={v.id}
                      alunoId={v.aluno.id}
                      alunoNome={v.aluno.nome}
                      diaSemana={h.diaSemana}
                      hora={h.hora}
                      semanas={h.semanas}
                      semanasNoCiclo={ciclo.semanasNoCiclo}
                      ocupadasPorOutros={ocupadasPorOutros(h.id, `${h.diaSemana}-${h.hora}`)}
                      linkAgenda={`/profissionais/${id}?aba=agenda`}
                    />
                  )}
                </li>
              ))}
              {vinculosSemHorario.map((v) => (
                <li key={v.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <Link href={`/alunos/${v.aluno.id}`} className="font-bold text-[#0A63C9]">
                    {v.aluno.nome}
                  </Link>
                  <p className="mt-1 text-[12.5px] text-slate-500">desde {formatarData(v.inicio)} · aguardando horário</p>
                </li>
              ))}
            </ul>
          )
        ) : historico.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum atendimento registrado ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historico.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <strong>{formatarData(a.data)}</strong>
                <span className="text-slate-500">{a.hora}</span>
                <Link href={`/alunos/${a.vinculo.aluno.id}`} className="font-bold text-[#0A63C9]">
                  {a.vinculo.aluno.nome}
                </Link>
                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">
                  {ROTULO_SITUACAO[a.situacao] ?? a.situacao}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
