import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { diasDeFaltaSeguidos, situacaoDasFaltas } from '@/domain/faltas'
import { gerarSemana, segundaDaSemana } from '@/domain/agenda'
import Cabecalho from '@/components/Cabecalho'
import { slotsPorProfissional } from '@/lib/slots'
import { totalDeVagasNaSemana } from '@/components/GradeSemanal'
import BotaoMoverEspera from '@/components/BotaoMoverEspera'
import { listarConflitos } from '@/domain/conflitos'
import { formatarHora, hojeNoFuso, hojeDoCentro } from '@/lib/fuso'
import { horariosVigentes } from '@/lib/agendaVigente'
import { diasSemAtendimentoEntre } from '@/lib/diasSemAtendimento'
import { semanasDoCartao } from '@/domain/diaSemAtendimento'
import CartaoSemana from '@/components/CartaoSemana'
import RegistrarProvidenciaFaltas from '@/components/RegistrarProvidenciaFaltas'
import { incluirSugestao, filtroAlunoAtivo } from '@/lib/sugestoes'
import { resumoDaSugestao } from '@/domain/sugestoes'

function diaSemanaHoje(hoje: Date): number {
  const d = (hoje.getDay() + 6) % 7 + 1
  return d <= 5 ? d : 0 // 0 = fim de semana
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Último dia útil antes de hoje (pula fim de semana e dia sem atendimento).
function diaUtilAnterior(hoje: Date, semAtendimento: Map<string, string>): Date {
  const d = new Date(hoje)
  d.setHours(0, 0, 0, 0)
  do {
    d.setDate(d.getDate() - 1)
  } while (d.getDay() === 0 || d.getDay() === 6 || semAtendimento.has(isoLocal(d)))
  return d
}

export default async function PaginaPainel() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  // "Hoje" no fuso do centro: depois das 21h o servidor já está no dia seguinte.
  const hojeData = hojeDoCentro()
  const hoje = diaSemanaHoje(hojeData)
  const inicioHoje = new Date(hojeData)
  inicioHoje.setHours(0, 0, 0, 0)
  // Dias sem atendimento perto de hoje: 3 semanas para trás (o "sem registro" de ontem) e 2 para a frente (o cartão).
  const deMarcados = new Date(hojeData)
  deMarcados.setDate(deMarcados.getDate() - 21)
  const ateMarcados = new Date(hojeData)
  ateMarcados.setDate(ateMarcados.getDate() + 21)
  const semAtendimento = await diasSemAtendimentoEntre(deMarcados, ateMarcados)
  const motivoHoje = semAtendimento.get(isoLocal(hojeData)) ?? null
  const [sugestoesPendentes, ultimasSugestoes] = await Promise.all([
    prisma.sugestao.count({ where: { situacao: 'PENDENTE', ...filtroAlunoAtivo } }),
    prisma.sugestao.findMany({
      where: { situacao: 'PENDENTE', ...filtroAlunoAtivo },
      include: incluirSugestao,
      orderBy: { criadoEm: 'desc' },
      take: 3,
    }),
  ])
  const fimHoje = new Date(inicioHoje.getTime() + 86400000)

  const [emAtendimento, espera, profissionaisAtivos, vinculos, configuracao, indisponibilidadesAtivas] = await Promise.all([
    prisma.aluno.count({ where: { excluidoEm: null, deFora: false, situacao: 'ATENDIMENTO' } }),
    prisma.aluno.count({ where: { excluidoEm: null, deFora: false, situacao: 'ESPERA' } }),
    prisma.usuario.count({ where: { ativo: true, perfil: 'PROFISSIONAL' } }),
    prisma.vinculo.findMany({
      where: { fim: null, aluno: { deFora: false } },
      include: {
        horarios: { where: { excluidoEm: null } },
        profissional: { include: { area: true } },
        atendimentos: { where: { data: { gte: inicioHoje, lt: fimHoje } } },
      },
    }),
    prisma.configuracao.findUnique({ where: { id: 'unica' } }),
    prisma.horarioIndisponivel.count({
      where: { profissional: { ativo: true } },
    }),
  ])

  const totalConflitos = listarConflitos(await horariosVigentes()).length

  const backupHoje =
    configuracao?.ultimoBackupOk &&
    configuracao.ultimoBackupEm &&
    hojeNoFuso(configuracao.ultimoBackupEm) === hojeNoFuso()
      ? `backup de hoje às ${formatarHora(configuracao.ultimoBackupEm)} ✔`
      : null

  const atendimentosSemana = vinculos.reduce((n, v) => n + v.horarios.length, 0)

  // Sugestão: cruza horários livres entre profissionais ativos com a fila de espera.
  // Um horário ocupado conta uma vez só, mesmo com um grupo de crianças nele.
  const ocupadosAtivos = new Set(
    vinculos
      .filter((v) => v.profissional.ativo)
      .flatMap((v) => v.horarios.map((h) => `${v.profissionalId}|${h.diaSemana}|${h.hora}`)),
  ).size
  const idsAtivos = (
    await prisma.usuario.findMany({ where: { perfil: 'PROFISSIONAL', ativo: true }, select: { id: true } })
  ).map((u) => u.id)
  const slotsAtivos = await slotsPorProfissional(idsAtivos)
  const vagasTotais = idsAtivos.reduce((n, id) => n + totalDeVagasNaSemana(slotsAtivos[id] ?? []), 0)
  const vagasLivres = Math.max(0, vagasTotais - ocupadosAtivos - indisponibilidadesAtivas)

  const porProfissional = new Map<
    string,
    {
      nome: string
      area: string
      doDia: number
      realizados: number
      faltas: number
      justificados: number
    }
  >()
  for (const v of vinculos) {
    if (!v.profissional.ativo) continue
    const atual = porProfissional.get(v.profissionalId) ?? {
      nome: v.profissional.nome,
      area: v.profissional.area?.nome ?? '—',
      doDia: 0,
      realizados: 0,
      faltas: 0,
      justificados: 0,
    }
    if (hoje !== 0) {
      atual.doDia += v.horarios.filter((h) => h.diaSemana === hoje).length
    }
    for (const a of v.atendimentos) {
      if (a.situacao === 'REALIZADO') atual.realizados++
      else if (a.situacao === 'FALTOU') atual.faltas++
      else if (a.situacao === 'JUSTIFICOU') atual.justificados++
    }
    porProfissional.set(v.profissionalId, atual)
  }
  const linhas = [...porProfissional.values()].sort((a, b) => a.nome.localeCompare(b.nome))

  // Alerta de faltas: últimos 120 dias, agrupa por aluno e aplica a regra.
  // As três consultas abaixo são independentes entre si — rodam juntas.
  const corte = new Date()
  corte.setDate(corte.getDate() - 120)
  const [recentes, ausentesHoje, canceladosHoje] = await Promise.all([
    prisma.atendimento.findMany({
      // Consulta avulsa (psiquiatra, assistente social) e pessoa de fora não entram no aviso de faltas.
      where: { data: { gte: corte }, situacao: { not: 'AGENDADO' }, avulso: false, vinculo: { aluno: { deFora: false } } },
      include: { vinculo: { include: { aluno: true, profissional: true, area: true } } },
      orderBy: { data: 'asc' },
    }),
    prisma.ausencia.findMany({
      where: { excluidoEm: null, inicio: { lte: fimHoje }, fim: { gte: inicioHoje } },
      include: { profissional: { select: { nome: true } } },
      orderBy: { inicio: 'asc' },
    }),
    prisma.atendimento.count({
      where: { data: { gte: inicioHoje, lt: fimHoje }, situacao: 'CANCELADO' },
    }),
  ])
  const porAluno = new Map<
    string,
    { nome: string; itens: { situacao: string; data: Date; area: string }[] }
  >()
  for (const a of recentes) {
    // Só quem ainda está em atendimento: desligado, alta ou pausa não entram no aviso.
    if (a.vinculo.aluno.excluidoEm || a.vinculo.aluno.situacao !== 'ATENDIMENTO') continue
    const atual = porAluno.get(a.vinculo.alunoId) ?? {
      nome: a.vinculo.aluno.nome,
      itens: [],
    }
    atual.itens.push({ situacao: a.situacao, data: a.data, area: a.vinculo.area.nome })
    porAluno.set(a.vinculo.alunoId, atual)
  }
  // Providência da direção já registrada: vale a mais recente de cada aluno (cobreAte maior).
  const providenciasRecentes = await prisma.providenciaFalta.findMany({
    where: { alunoId: { in: [...porAluno.keys()] } },
    select: { alunoId: true, cobreAte: true },
  })
  const cobreAtePorAluno = new Map<string, Date>()
  for (const p of providenciasRecentes) {
    const atual = cobreAtePorAluno.get(p.alunoId)
    if (!atual || p.cobreAte > atual) cobreAtePorAluno.set(p.alunoId, p.cobreAte)
  }
  const comFaltas = [...porAluno.entries()]
    .filter(([alunoId, v]) => situacaoDasFaltas(v.itens, cobreAtePorAluno.get(alunoId) ?? null) === 'AVISO')
    .map(([alunoId, v]) => {
      const { dias, diasDaSequencia } = diasDeFaltaSeguidos(v.itens, cobreAtePorAluno.get(alunoId) ?? null)
      // Cada dia da sequência com as áreas em que faltou (do mais antigo para o mais recente).
      const faltouEm = [...diasDaSequencia].reverse().map((chave) => ({
        dia: chave.split('-').reverse().slice(0, 2).join('/'),
        areas: [...new Set(v.itens.filter((i) => i.situacao === 'FALTOU' && i.data.toISOString().slice(0, 10) === chave).map((i) => i.area))],
      }))
      return { alunoId, nome: v.nome, dias, faltouEm }
    })
  const listaFaltas = comFaltas

  // Pausas com previsão de retorno já vencida (ou hoje): só informa, a
  // direção decide se estende ou move de volta pra fila.
  const pausasVencidas = await prisma.aluno.findMany({
    where: { excluidoEm: null, deFora: false, situacao: 'PAUSA', pausaRetomarEm: { lte: fimHoje } },
    orderBy: { pausaRetomarEm: 'asc' },
    select: { id: true, nome: true, pausaRetomarEm: true },
  })

  // Atendimentos sem registro nenhum no último dia útil: nem presença do
  // aluno, nem ausência do profissional — só avisa a direção, sem exigir
  // nada do profissional no dia a dia.
  const ontemUtil = diaUtilAnterior(hojeData, semAtendimento)
  const isoOntem = isoLocal(ontemUtil)
  const inicioOntem = new Date(ontemUtil)
  const fimOntem = new Date(inicioOntem.getTime() + 86400000)
  const slotsOntem = gerarSemana(
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
    segundaDaSemana(ontemUtil),
  ).filter((s) => isoLocal(s.data) === isoOntem)

  let naoRegistrados: { profissionalId: string; nome: string; qtd: number }[] = []
  if (slotsOntem.length > 0) {
    const [atendimentosOntem, ausenciasOntem] = await Promise.all([
      prisma.atendimento.findMany({
        where: { data: { gte: inicioOntem, lt: fimOntem } },
        select: { vinculoId: true, hora: true, situacao: true },
      }),
      prisma.ausencia.findMany({
        where: { excluidoEm: null, inicio: { lte: fimOntem }, fim: { gte: inicioOntem } },
        select: { profissionalId: true },
      }),
    ])
    const registrados = new Set(
      atendimentosOntem
        .filter((a) => a.situacao !== 'AGENDADO')
        .map((a) => `${a.vinculoId}-${a.hora}`),
    )
    const profissionaisComAusencia = new Set(ausenciasOntem.map((a) => a.profissionalId))
    const porVinculo = new Map(vinculos.map((v) => [v.id, v]))
    const contagem = new Map<string, { nome: string; qtd: number }>()
    for (const s of slotsOntem) {
      if (registrados.has(`${s.vinculoId}-${s.hora}`)) continue
      const v = porVinculo.get(s.vinculoId)
      if (!v || !v.profissional.ativo) continue
      if (profissionaisComAusencia.has(v.profissionalId)) continue
      const atual = contagem.get(v.profissionalId) ?? { nome: v.profissional.nome, qtd: 0 }
      atual.qtd++
      contagem.set(v.profissionalId, atual)
    }
    naoRegistrados = [...contagem.entries()]
      .map(([profissionalId, v]) => ({ profissionalId, ...v }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Painel" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Painel</h1>
        {totalConflitos > 0 && (
          <Link
            href="/conflitos"
            className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-l-4 border-[#B3261E] bg-white px-4 py-3 shadow-sm"
          >
            <span className="text-[14px] font-extrabold text-[#B3261E]">
              ⚠ {totalConflitos} {totalConflitos === 1 ? 'horário em conflito' : 'horários em conflito'}
            </span>
            <span className="text-[13px] font-bold text-[#0A63C9]">Ver quais são →</span>
          </Link>
        )}
        <CartaoSemana semanas={semanasDoCartao(hojeData, semAtendimento)} />
        {sugestoesPendentes > 0 && (
          <section className="mb-5 rounded-xl border border-slate-200 border-l-4 border-l-[#0A63C9] bg-white p-4">
            <h2 className="text-[14px] font-extrabold">Sugestões dos profissionais ({sugestoesPendentes})</h2>
            <ul className="mt-2 flex flex-col">
              {ultimasSugestoes.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline gap-x-2 border-t border-slate-100 py-1.5 text-[13.5px] first:border-t-0"
                >
                  <Link href={`/alunos/${s.alunoId}?aba=sugestoes`} className="font-bold text-[#0A63C9]">
                    {s.aluno.nome}
                  </Link>
                  <span className="text-slate-600">
                    {resumoDaSugestao({ tipo: s.tipo, areaNome: s.area?.nome ?? null, autorNome: s.autor.nome })}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/sugestoes" className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-bold text-[#0A63C9]">
              Ver todas →
            </Link>
          </section>
        )}
        <p className="mb-4 text-[13px] text-slate-500">
          A visão do centro inteiro, com os números do dia
        </p>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Link
            href="/alunos?situacao=ATENDIMENTO"
            className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#0A63C9] bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
          >
            <strong className="block text-2xl leading-none text-[#0A63C9]">{emAtendimento}</strong>
            <span className="text-[11.5px] text-slate-500">alunos em atendimento</span>
          </Link>
          <Link
            href="/profissionais"
            className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#0A63C9] bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
          >
            <strong className="block text-2xl leading-none text-[#0A63C9]">{profissionaisAtivos}</strong>
            <span className="text-[11.5px] text-slate-500">profissionais</span>
          </Link>
          <Link
            href="/painel/grade"
            className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#0A63C9] bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
          >
            <strong className="block text-2xl leading-none text-[#0A63C9]">{atendimentosSemana}</strong>
            <span className="text-[11.5px] text-slate-500">atendimentos por semana</span>
          </Link>
          <Link
            href="/alunos?situacao=ESPERA"
            className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#F0C000] bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
          >
            <strong className="block text-2xl leading-none text-[#8a6100]">{espera}</strong>
            <span className="text-[11.5px] text-slate-500">na lista de espera</span>
          </Link>
          <div className="rounded-xl border border-slate-200 border-t-[3px] border-t-[#2EA84A] bg-white p-3">
            <strong className="block text-2xl leading-none text-[#2EA84A]">
              {backupHoje ? '✔' : '—'}
            </strong>
            <span className="text-[11.5px] text-slate-500">
              {backupHoje ?? 'último backup'}
            </span>
          </div>
        </div>

        {espera > 0 && vagasLivres > 0 && (
          <p className="mb-2 rounded-xl border border-[#2EA84A]/40 bg-[#e4f6e8] px-4 py-3 text-[13px] text-slate-700">
            <strong>💡 Sugestão:</strong> {vagasLivres} {vagasLivres === 1 ? 'horário livre' : 'horários livres'} esta semana e {espera} na lista de espera —{' '}
            <Link href="/agendas" className="font-bold text-[#0A63C9] underline">
              encaminhar alguém
            </Link>
            .
          </p>
        )}

        <h2 className="mb-1 text-[16px] font-extrabold">Hoje no centro</h2>
        {ausentesHoje.length > 0 && (
          <p className="mb-2 rounded-xl border border-[#F0C000]/40 bg-[#fff6d6] px-4 py-3 text-[13px] text-slate-700">
            <strong>Ausências hoje:</strong>{' '}
            {ausentesHoje.map((a) => a.profissional.nome).join(', ')} ·{' '}
            {canceladosHoje} {canceladosHoje === 1 ? 'atendimento cancelado' : 'atendimentos cancelados'}
          </p>
        )}
        {motivoHoje ? (
          <p className="mb-4 rounded-xl border border-[#B3261E]/30 bg-[#fde7e7] p-5 text-sm text-slate-700">
            <strong>Hoje não há atendimento:</strong> {motivoHoje}.
          </p>
        ) : hoje === 0 ? (
          <p className="mb-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Hoje é fim de semana — não há atendimentos marcados.
          </p>
        ) : linhas.length === 0 ? (
          <p className="mb-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum atendimento vigente no centro.
          </p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Profissional</th>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Agenda de hoje</th>
                  <th className="px-3 py-2">Presenças</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const semRegistro = l.realizados + l.faltas + l.justificados === 0
                  return (
                    <tr key={l.nome} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-bold">{l.nome}</td>
                      <td className="px-3 py-2 text-slate-600">{l.area}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {l.doDia} {l.doDia === 1 ? 'aluno' : 'alunos'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {semRegistro ? (
                          'aguardando'
                        ) : (
                          <>
                            {l.realizados} ✔{l.faltas > 0 ? ` · ${l.faltas} faltou` : ''}
                            {l.justificados > 0 ? ` · ${l.justificados} justificou` : ''}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mb-1 mt-6 text-[16px] font-extrabold">Alunos com faltas seguidas</h2>
        <p className="mb-2 text-[13px] text-slate-500">
          Duas faltas seguidas: a direção já pode agir antes da terceira
        </p>
        {listaFaltas.length === 0 ? (
          <p className="mb-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum aluno com faltas seguidas.
          </p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Aluno</th>
                  <th className="px-3 py-2">Faltou em</th>
                  <th className="px-3 py-2">Providência</th>
                </tr>
              </thead>
              <tbody>
                {listaFaltas.map((l) => (
                  <tr key={l.alunoId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-bold">
                      <Link href={`/alunos/${l.alunoId}`} className="text-[#0A63C9] underline">
                        {l.nome}
                      </Link>{' '}
                      <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[10.5px] font-bold text-[#B3261E]">
                        {l.dias} faltas seguidas
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <ul className="flex flex-col gap-0.5">
                        {l.faltouEm.map((f) => (
                          <li key={f.dia}>
                            <strong className="text-[#16243b]">{f.dia}</strong> · {f.areas.join(' e ')}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2">
                      <RegistrarProvidenciaFaltas alunoId={l.alunoId} alunoNome={l.nome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pausasVencidas.length > 0 && (
          <>
            <h2 className="mb-1 mt-6 text-[16px] font-extrabold">Pausas com previsão de retorno</h2>
            <p className="mb-2 text-[13px] text-slate-500">
              Só um aviso — você decide se estende a pausa ou move de volta pra fila
            </p>
            <ul className="mb-4 flex flex-col gap-2">
              {pausasVencidas.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <Link href={`/alunos/${a.id}`} className="font-bold text-[#0A63C9]">
                      {a.nome}
                    </Link>
                    <p className="text-[12.5px] text-slate-500">
                      previsão era {a.pausaRetomarEm!.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                  </div>
                  <BotaoMoverEspera alunoId={a.id} />
                </li>
              ))}
            </ul>
          </>
        )}

        {naoRegistrados.length > 0 && (
          <>
            <h2 className="mb-1 mt-6 text-[16px] font-extrabold">
              Atendimentos sem registro em{' '}
              {ontemUtil.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </h2>
            <p className="mb-2 text-[13px] text-slate-500">
              Ninguém marcou presença do aluno nem ausência do profissional nesses horários —
              só um aviso, não muda nada sozinho
            </p>
            <ul className="mb-4 flex flex-col gap-2">
              {naoRegistrados.map((n) => (
                <li
                  key={n.profissionalId}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <Link href={`/profissionais/${n.profissionalId}`} className="font-bold text-[#0A63C9]">
                    {n.nome}
                  </Link>{' '}
                  <span className="text-slate-500">
                    · {n.qtd} {n.qtd === 1 ? 'horário sem registro' : 'horários sem registro'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            href="/painel/grade"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Ver grade da semana
          </Link>
          <Link
            href="/painel/presencas"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            📄 Folha de presença (PDF timbrado)
          </Link>
          <Link
            href="/agendas"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-5 py-2.5 text-sm font-bold text-[#0A63C9]"
          >
            🔄 Transferir aluno de profissional
          </Link>
          <Link
            href="/lembretes"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-5 py-2.5 text-sm font-bold text-[#0A63C9]"
          >
            📱 Lembretes de amanhã
          </Link>
          <a
            href="/api/backup/baixar"
            download
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-5 py-2.5 text-sm font-bold text-[#0A63C9]"
          >
            ⬇ Baixar backup
          </a>
        </div>
      </main>
    </div>
  )
}
