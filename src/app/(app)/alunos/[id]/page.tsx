import { slotsPorProfissional } from '@/lib/slots'
import { vagasDoSlot } from '@/domain/grade'
import { semanasCheias } from '@/domain/semanas'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { pendenciasDoAluno, rotuloSituacao } from '@/domain/matricula'
import { podeVerAluno } from '@/domain/permissoes'
import { abasDaFicha } from '@/domain/acesso'
import { podeVerRegistroClinico } from '@/domain/transferencia'
import {
  diaIso,
  podeVerRegistroDeConsulta,
  ROTULO_SITUACAO_CONSULTA,
  ROTULO_TIPO_CONSULTA,
  type TipoConsultaRegistro,
} from '@/domain/consultas'
import { situacaoDasFaltas } from '@/domain/faltas'
import { ROTULOS_TIPO, type TipoDocumento } from '@/domain/documentos'
import { urlDoArquivo } from '@/lib/storage'
import { registrarAcesso } from '@/lib/registro'
import { semVazioRepetido } from '@/domain/aguardando'
import Cabecalho from '@/components/Cabecalho'
import { formatarDataHora } from '@/lib/fuso'
import RelatoriosAluno from '@/components/RelatoriosAluno'
import SugestoesAluno from '@/components/SugestoesAluno'
import { sugestoesDoAluno } from '@/lib/sugestoes'
import EnviarDocumento from '@/components/EnviarDocumento'
import GradeDocumentos, { type DocumentoTela } from '@/components/GradeDocumentos'
import EditarPausaRetorno from '@/components/EditarPausaRetorno'
import EncaminharProfissionalClient from '@/components/EncaminharProfissionalClient'
import EncerrarAtendimentoBotao from '@/components/EncerrarAtendimentoBotao'
import DesligarAlunoBotao from '@/components/DesligarAlunoBotao'
import EtiquetaSemanas from '@/components/EtiquetaSemanas'
import PainelHorarioAluno from '@/components/PainelHorarioAluno'
import DesfazerEncerramentoBotao from '@/components/DesfazerEncerramentoBotao'
import EditarDadosAluno from '@/components/EditarDadosAluno'
import DetalheRegistroConsulta from '@/components/DetalheRegistroConsulta'
import type { AreaOpcao, OcupacaoTela, ProfissionalOpcao } from '@/components/AgendasClient'

const ROTULO_MOTIVO: Record<string, string> = {
  PAUSA: 'Pausado',
  ALTA: 'Alta',
  DESLIGADO: 'Desligado',
}

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const ROTULO_PROVIDENCIA: Record<string, string> = {
  CONTATO_FAMILIA: 'Contato com a família',
  ASSISTENCIA_SOCIAL: 'Acionou a assistência social',
  OUTRA: 'Outra',
}

const ABAS = [
  { id: 'evolucao', rotulo: 'Evolução' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'anamnese', rotulo: 'Anamnese' },
  { id: 'relatorios', rotulo: 'Relatórios' },
  { id: 'sugestoes', rotulo: 'Sugestões' },
  { id: 'consultas', rotulo: 'Consultas' },
  { id: 'dados', rotulo: 'Dados' },
] as const

type Aba = (typeof ABAS)[number]['id']

// Só vale aba que o perfil pode ver (a Secretaria cai sempre em "dados").
function abaValida(v: string | undefined, liberadas: readonly Aba[]): Aba {
  return ABAS.some((a) => a.id === v) && liberadas.includes(v as Aba) ? (v as Aba) : 'dados'
}

function formatarData(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function formatarDataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm md:grid-cols-[180px_1fr]">
      <dt className="font-bold text-slate-500">{rotulo}</dt>
      <dd className="text-slate-800">{valor}</dd>
    </div>
  )
}

export default async function PaginaFichaAluno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')

  const { id } = await params

  // Secretaria: ficha só para consulta (cadastro, responsável, telefone, profissionais e
  // horários). Sem prontuário e sem nenhum botão de ação: nada clínico é lido do banco para ela.
  const somenteLeitura = sessao.user.perfil === 'SECRETARIA'

  if (sessao.user.perfil !== 'ADMIN' && !somenteLeitura) {
    const vinculosDoAluno = await prisma.vinculo.findMany({
      where: { alunoId: id },
      select: { profissionalId: true, fim: true },
    })
    if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculosDoAluno)) {
      redirect('/agenda')
    }
  }

  const aluno = await prisma.aluno.findFirst({
    where: { id, excluidoEm: null },
  })
  if (!aluno) notFound()
  // Pessoa de fora do centro: a Secretaria não abre a ficha.
  if (somenteLeitura && aluno.deFora) notFound()

  const { aba } = await searchParams
  const pendencias = aluno.deFora ? [] : pendenciasDoAluno(aluno)

  const vinculosAbertos = await prisma.vinculo.findMany({
    where: { alunoId: id, fim: null },
    include: { profissional: { select: { id: true, nome: true, semanasNoCiclo: true, tipoAgenda: true } }, area: true, horarios: { where: { excluidoEm: null } } },
    orderBy: { inicio: 'asc' },
  })
  // Sobra da importação: atendimento vazio repetido com o mesmo profissional não aparece.
  const vinculosAtuais = semVazioRepetido(vinculosAbertos, (v) => v.profissionalId)

  const presencas = somenteLeitura
    ? []
    : await prisma.atendimento.findMany({
        where: {
          vinculo: { alunoId: id },
          situacao: { not: 'AGENDADO' },
        },
        orderBy: [{ data: 'desc' }, { hora: 'desc' }],
        take: 10,
        select: {
          id: true, data: true, hora: true, situacao: true, assinaturaId: true,
          confirmadoEm: true, registradoPor: { select: { nome: true } },
        },
      })
  const linksAssinatura = new Map<string, string>()
  for (const p of presencas) {
    if (p.assinaturaId) linksAssinatura.set(p.id, await urlDoArquivo(p.assinaturaId))
  }

  const atendimentos = somenteLeitura
    ? []
    : await prisma.atendimento.findMany({
        where: { vinculo: { alunoId: id } },
        include: {
          vinculo: { select: { id: true, profissionalId: true } },
          evolucao: { include: { autor: { select: { id: true, nome: true } } } },
        },
        orderBy: [{ data: 'desc' }, { hora: 'desc' }],
      })
  const eAdmin = sessao.user.perfil === 'ADMIN'

  // A aba Consultas só existe se há consulta avulsa que quem abriu pode ver: a direção vê todas; o
  // profissional, só as dele (saber que a criança passa no psiquiatra já é dado de saúde). Nunca a Secretaria.
  const temConsultas = atendimentos.some(
    (a) => a.avulso && (sessao.user.perfil === 'ADMIN' || a.vinculo.profissionalId === sessao.user.id),
  )
  const abasLiberadas = abasDaFicha(sessao.user.perfil, temConsultas)
  const abaAtual = abaValida(aba, abasLiberadas)

  const [areas, profissionaisAtivos, vinculosParaGrade]: [
    AreaOpcao[],
    ProfissionalOpcao[],
    { id: string; profissionalId: string; alunoId: string; aluno: { nome: string }; horarios: {
      id: string; diaSemana: number; hora: string; local: string | null; semanas: number
    }[] }[],
  ] = eAdmin
    ? await Promise.all([
        prisma.area.findMany({ orderBy: { nome: 'asc' } }),
        prisma.usuario.findMany({
          where: { ativo: true, perfil: 'PROFISSIONAL' },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, usuario: true, areaId: true, semanasNoCiclo: true },
        }),
        prisma.vinculo.findMany({
          where: { fim: null },
          include: { aluno: { select: { nome: true } }, horarios: { where: { excluidoEm: null } } },
        }),
      ])
    : [[], [], []]
  const ocupacoesTodas: OcupacaoTela[] = vinculosParaGrade.flatMap((v) =>
    v.horarios.map((h) => ({
      vinculoId: v.id,
      horarioId: h.id,
      alunoId: v.alunoId,
      alunoNome: v.aluno.nome,
      profissionalId: v.profissionalId,
      diaSemana: h.diaSemana,
      hora: h.hora,
      local: h.local,
      semanas: h.semanas,
    })),
  )
  const slotsMap = eAdmin ? await slotsPorProfissional(profissionaisAtivos.map((p) => p.id)) : {}
  const vinculosEncerrados = await prisma.vinculo.findMany({
    where: { alunoId: id, fim: { not: null } },
    include: { profissional: { select: { nome: true } }, area: { select: { nome: true } } },
    orderBy: { fim: 'desc' },
    take: 10,
  })

  const transferencias = somenteLeitura
    ? []
    : await prisma.transferencia.findMany({
        where: { alunoId: id },
        select: { paraProfissionalId: true, criadoEm: true },
      })
  const sessaoClinica = { id: sessao.user.id, perfil: sessao.user.perfil }
  const temTransferencia = transferencias.some((t) => t.paraProfissionalId === sessao.user.id)
  const avisoIsolamento = temTransferencia
    ? '🔒 Você vê os seus registros e o histórico transferido para você.'
    : '🔒 Você vê apenas os registros escritos por você.'
  // Consultas avulsas têm aba própria: ficam fora da linha do tempo da evolução.
  const linhaDoTempo = atendimentos.filter(
    (a) =>
      !a.avulso &&
      (eAdmin ||
      a.vinculo.profissionalId === sessao.user.id ||
      transferencias.some(
        (t) => t.paraProfissionalId === sessao.user.id && t.criadoEm >= a.data,
      )),
  )
  const evolucoesVisiveis = new Set(
    linhaDoTempo
      .flatMap((a) =>
        a.evolucao &&
        podeVerRegistroClinico(
          sessaoClinica,
          { autorId: a.evolucao.autorId, criadoEm: a.evolucao.criadoEm },
          transferencias,
        )
          ? [a.evolucao]
          : [],
      )
      .map((e) => e.id),
  )
  const realizadosSemEvolucao = linhaDoTempo.filter(
    (a) => a.situacao === 'REALIZADO' && !a.evolucao,
  )

  // Registro de acesso (LGPD): só quando alguém lê o que outro escreveu.
  if (abaAtual === 'evolucao' && eAdmin) {
    const alheia = linhaDoTempo.some(
      (a) => a.evolucao && a.evolucao.autorId !== sessao.user.id,
    )
    if (alheia) await registrarAcesso(sessao.user.id, 'ABRIU_EVOLUCAO', `aluno:${id}`)
  }
  // Providências da direção por faltas seguidas: o selo usa só a data que cobrem; a lista (com
  // a observação) só vai para a direção.
  // Para a Secretaria só entram a situação e a data dos atendimentos e a data que a providência
  // cobre (para o selo): nada de observação, autor nem evolução.
  const providenciasFaltas = somenteLeitura
    ? []
    : await prisma.providenciaFalta.findMany({
        where: { alunoId: id },
        include: { autor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      })
  const cobreAteFaltas = somenteLeitura
    ? (await prisma.providenciaFalta.aggregate({ where: { alunoId: id }, _max: { cobreAte: true } }))._max.cobreAte
    : providenciasFaltas.reduce<Date | null>(
        (maior, p) => (!maior || p.cobreAte > maior ? p.cobreAte : maior),
        null,
      )
  const itensDeFalta = somenteLeitura
    ? await prisma.atendimento.findMany({
        where: { vinculo: { alunoId: id }, avulso: false },
        select: { situacao: true, data: true },
      })
    : linhaDoTempo.map((a) => ({ situacao: a.situacao, data: a.data }))
  const situacaoFaltas = situacaoDasFaltas(itensDeFalta, cobreAteFaltas)

  // Aba Consultas (sem desmarcadas): cada um vê só as linhas que pode ler — a direção todas, o
  // profissional as dele e as recebidas por transferência; o texto segue a mesma regra.
  const consultasBrutas =
    abaAtual === 'consultas' && !somenteLeitura
      ? await prisma.atendimento.findMany({
          where: { vinculo: { alunoId: id }, avulso: true, situacao: { not: 'CANCELADO' } },
          orderBy: [{ data: 'desc' }, { hora: 'desc' }],
          select: {
            id: true,
            data: true,
            hora: true,
            situacao: true,
            vinculo: { select: { profissionalId: true, profissional: { select: { nome: true } } } },
            registroConsulta: {
              select: {
                autorId: true,
                criadoEm: true,
                excluidoEm: true,
                tipo: true,
                presentes: true,
                registro: true,
                encaminhamentos: true,
                proximoPasso: true,
                retornoEm: true,
                autor: { select: { nome: true } },
              },
            },
          },
        })
      : []
  const consultasTela = consultasBrutas.flatMap((c) => {
    const r = c.registroConsulta && !c.registroConsulta.excluidoEm ? c.registroConsulta : null
    const verTexto = !!r && podeVerRegistroDeConsulta(sessaoClinica, { autorId: r.autorId, criadoEm: r.criadoEm }, transferencias)
    if (!eAdmin && c.vinculo.profissionalId !== sessao.user.id && !verTexto) return []
    return [{
      id: c.id,
      dia: diaIso(c.data),
      hora: c.hora,
      situacao: c.situacao,
      profissionalId: c.vinculo.profissionalId,
      profissionalNome: c.vinculo.profissional.nome,
      tipo: r?.tipo ?? null,
      registro: r,
      verTexto,
      podeAbrir: eAdmin || c.vinculo.profissionalId === sessao.user.id,
    }]
  })
  if (abaAtual === 'consultas' && eAdmin && consultasTela.some((c) => c.verTexto)) {
    await registrarAcesso(sessao.user.id, 'ABRIU_CONSULTA', `aluno:${id}`)
  }

  const anamnesesTodas = somenteLeitura
    ? []
    : await prisma.anamnese.findMany({
        where: { alunoId: id },
        include: {
          modelo: { select: { nome: true } },
          autor: { select: { id: true, nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
      })
  const anamneses = anamnesesTodas.filter((a) =>
    podeVerRegistroClinico(
      sessaoClinica,
      { autorId: a.autorId, criadoEm: a.criadoEm },
      transferencias,
    ),
  )
  if (abaAtual === 'anamnese' && eAdmin) {
    const alheia = anamneses.some((a) => a.autorId !== sessao.user.id)
    if (alheia) await registrarAcesso(sessao.user.id, 'ABRIU_ANAMNESE', `aluno:${id}`)
  }

  const relatoriosTodos = somenteLeitura
    ? []
    : await prisma.relatorio.findMany({
        where: { alunoId: id, excluidoEm: null },
        include: { autor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      })
  const relatorios = relatoriosTodos
    .filter((r) =>
      podeVerRegistroClinico(
        sessaoClinica,
        { autorId: r.autorId, criadoEm: r.criadoEm },
        transferencias,
      ),
    )
    .map((r) => ({
      id: r.id,
      tipo: r.tipo,
      criadoEm: r.criadoEm.toISOString(),
      autorNome: r.autor.nome,
      comAnamnese: r.comAnamnese,
      podeExcluir: eAdmin || r.autorId === sessao.user.id,
    }))

  const sugestoesTela =
    abaAtual === 'sugestoes' && !somenteLeitura ? await sugestoesDoAluno(id, sessao.user.perfil, sessao.user.id) : []
  const areasParaSugestao =
    abaAtual === 'sugestoes' && sessao.user.perfil === 'PROFISSIONAL'
      ? await prisma.area.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } })
      : []

  const docs = somenteLeitura
    ? []
    : await prisma.documento.findMany({
        where: { alunoId: id, excluidoEm: null },
        orderBy: { criadoEm: 'desc' },
      })
  const documentos: DocumentoTela[] = []
  for (const d of docs) {
    documentos.push({
      id: d.id,
      tipo: d.tipo,
      rotulo: ROTULOS_TIPO[d.tipo as TipoDocumento] ?? d.tipo,
      descricao: d.descricao,
      nomeArquivo: d.nomeArquivo,
      data: d.criadoEm.toLocaleDateString('pt-BR'),
      enviadoPor: d.enviadoPor,
      url: await urlDoArquivo(d.chave),
      pdf: d.nomeArquivo.toLowerCase().endsWith('.pdf'),
    })
  }

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={sessao.user.perfil === 'ADMIN' ? 'Direção' : somenteLeitura ? 'Secretaria' : 'Profissional'}
        itemAtivo="Alunos"
        menu={sessao.user.perfil === 'ADMIN' ? 'admin' : somenteLeitura ? 'secretaria' : 'profissional'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <Link
          href="/alunos"
          className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]"
        >
          ← Voltar para a lista
        </Link>
        <h1 className="text-xl font-extrabold">
          {aluno.nome}{' '}
          <span className="text-[13px] font-normal text-slate-500">
            · matrícula {aluno.matricula}
          </span>
        </h1>
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
          {!aluno.deFora && (
            <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
              {rotuloSituacao(aluno.situacao)}
              {aluno.situacao === 'ATENDIMENTO' && vinculosAbertos.every((v) => v.horarios.length === 0) ? ' · sem horário' : ''}
            </span>
          )}
          {aluno.deFora && (
            <span className="inline-block rounded-full bg-[#efe7fb] px-2.5 py-0.5 text-[11.5px] font-bold text-[#5b2fa0]">
              De fora do centro
            </span>
          )}
          {pendencias.map((p) => (
            <span
              key={p}
              className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[11.5px] font-bold text-[#8a6100]"
            >
              {p}
            </span>
          ))}
          {situacaoFaltas === 'AVISO' && (
            <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[11.5px] font-bold text-[#B3261E]">
              2 faltas seguidas
            </span>
          )}
        </p>
        {abasLiberadas.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-4 rounded-t-lg border-b-2 border-slate-200 bg-white px-2 text-[13.5px]">
          {ABAS.filter((a) => abasLiberadas.includes(a.id)).map((a) => (
            <Link
              key={a.id}
              href={`/alunos/${aluno.id}?aba=${a.id}`}
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
        )}
        {abaAtual === 'dados' ? (
          <>
            {eAdmin && (
              <EditarDadosAluno
                alunoId={aluno.id}
                inicial={{
                  nome: aluno.nome,
                  nascimento: aluno.nascimento ? aluno.nascimento.toISOString().slice(0, 10) : '',
                  cpf: aluno.cpf ?? '',
                  escola: aluno.escola ?? '',
                  serie: aluno.serie ?? '',
                  responsavel: aluno.responsavel ?? '',
                  whatsapp: aluno.whatsapp ?? '',
                  observacoes: aluno.observacoes ?? '',
                }}
              />
            )}
            <dl className="rounded-xl border border-slate-200 bg-white px-5 py-2">
              <Linha rotulo="Matrícula" valor={aluno.matricula} />
              <Linha rotulo="Nome" valor={aluno.nome} />
              <Linha
                rotulo="Data de nascimento"
                valor={formatarData(aluno.nascimento)}
              />
              <Linha rotulo="CPF" valor={aluno.cpf ?? '—'} />
              <Linha rotulo="Escola" valor={aluno.escola ?? '—'} />
              <Linha rotulo="Série/ano" valor={aluno.serie ?? '—'} />
              <Linha rotulo="Responsável" valor={aluno.responsavel ?? '—'} />
              {aluno.ligadoAoAluno && <Linha rotulo="Ligado ao aluno" valor={aluno.ligadoAoAluno} />}
              <Linha rotulo="WhatsApp" valor={aluno.whatsapp ?? '—'} />
              {!somenteLeitura && <Linha rotulo="Observações" valor={aluno.observacoes ?? '—'} />}
            </dl>
            {!somenteLeitura && (aluno.situacao === 'PAUSA' || (aluno.situacao === 'ESPERA' && aluno.pausaRetomarEm)) && (
              <div className="mt-4">
                <EditarPausaRetorno
                  alunoId={aluno.id}
                  valorAtual={aluno.pausaRetomarEm ? formatarDataISO(aluno.pausaRetomarEm) : null}
                />
              </div>
            )}
            <h2 className="mb-2 mt-6 text-[15px] font-extrabold">Profissionais</h2>
            {vinculosAtuais.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                Nenhum profissional vinculado no momento.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vinculosAtuais.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    {eAdmin ? (
                      <Link
                        href={`/profissionais/${v.profissional.id}`}
                        className="font-bold text-[#0A63C9]"
                      >
                        {v.profissional.nome}
                      </Link>
                    ) : (
                      <strong>{v.profissional.nome}</strong>
                    )}
                    <span className="text-slate-500"> · {v.area.nome}</span>
                    {v.horarios.length === 0 ? (
                      <>
                        <p className="mt-1 text-[12.5px] text-slate-500">
                          {v.profissional.tipoAgenda !== 'FIXA' ? 'consultas por dia e hora (veja em Consultas)' : 'aguardando horário'}
                        </p>
                        {eAdmin && (
                          <div className="mt-2">
                            <EncerrarAtendimentoBotao vinculoId={v.id} alunoNome={aluno.nome} />
                          </div>
                        )}
                      </>
                    ) : (
                      v.horarios.map((h) => (
                        <div key={h.id} className="mt-1">
                          <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
                            {DIAS[h.diaSemana]} {h.hora}
                            <EtiquetaSemanas semanas={h.semanas} semanasNoCiclo={v.profissional.semanasNoCiclo} completa />
                          </p>
                          {eAdmin && (
                            <PainelHorarioAluno
                              variante="linha"
                              horarioId={h.id}
                              vinculoId={v.id}
                              alunoId={aluno.id}
                              alunoNome={aluno.nome}
                              diaSemana={h.diaSemana}
                              hora={h.hora}
                              semanas={h.semanas}
                              semanasNoCiclo={v.profissional.semanasNoCiclo}
                              ocupadasPorOutros={semanasCheias(
                                ocupacoesTodas
                                  .filter((o) => o.profissionalId === v.profissional.id && o.diaSemana === h.diaSemana && o.hora === h.hora && o.horarioId !== h.id)
                                  .map((o) => o.semanas),
                                vagasDoSlot(slotsMap[v.profissional.id] ?? [], h.diaSemana, h.hora),
                                v.profissional.semanasNoCiclo,
                              )}
                              linkAgenda={`/profissionais/${v.profissional.id}?aba=agenda`}
                            />
                          )}
                        </div>
                      ))
                    )}
                    {(!eAdmin && !somenteLeitura && v.profissionalId === sessao.user.id) && (
                      <div className="mt-2">
                        <EncerrarAtendimentoBotao vinculoId={v.id} alunoNome={aluno.nome} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {eAdmin && providenciasFaltas.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-[15px] font-extrabold">Providências por faltas</h2>
                <ul className="flex flex-col gap-2">
                  {providenciasFaltas.map((p) => (
                    <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <strong>{ROTULO_PROVIDENCIA[p.tipo] ?? p.tipo}</strong>
                      <span className="text-slate-500">
                        {' '}· {formatarDataHora(p.criadoEm)} · {p.autor.nome}
                      </span>
                      {p.observacao && <p className="mt-1 text-[13px] text-slate-700">{p.observacao}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {eAdmin && aluno.situacao !== 'DESLIGADO' && (
              <div className="mt-4">
                <DesligarAlunoBotao
                  alunoId={aluno.id}
                  alunoNome={aluno.nome}
                  situacao={aluno.situacao}
                  atendimentos={vinculosAbertos.map((v) => ({ profissional: v.profissional.nome, area: v.area.nome }))}
                  horarios={vinculosAbertos.reduce((n, v) => n + v.horarios.length, 0)}
                />
              </div>
            )}
            {eAdmin && !aluno.deFora && (
              <EncaminharProfissionalClient
                alunoId={aluno.id}
                alunoNome={aluno.nome}
                areas={areas}
                profissionais={profissionaisAtivos}
                ocupacoes={ocupacoesTodas}
                slotsPorProfissional={slotsMap}
              />
            )}
            {vinculosEncerrados.some((v) => eAdmin || somenteLeitura || v.profissionalId === sessao.user.id) && (
              <>
                <h2 className="mb-2 mt-6 text-[15px] font-extrabold">Profissionais anteriores</h2>
                <ul className="flex flex-col gap-2">
                  {vinculosEncerrados
                    .filter((v) => eAdmin || somenteLeitura || v.profissionalId === sessao.user.id)
                    .map((v) => (
                      <li
                        key={v.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                      >
                        <strong className="text-slate-800">{v.profissional.nome}</strong>
                        <span> · {v.area.nome}</span>
                        <p className="mt-1 text-[12.5px]">
                          {v.motivoFim ? ROTULO_MOTIVO[v.motivoFim] : 'Encerrado'} em{' '}
                          {formatarData(v.fim)}
                        </p>
                        {!somenteLeitura && (
                          <div className="mt-2">
                            <DesfazerEncerramentoBotao vinculoId={v.id} />
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {!somenteLeitura && (
              <>
              <h2 className="mb-2 mt-6 text-[15px] font-extrabold">Últimas presenças</h2>
              {presencas.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  Nenhuma presença registrada ainda.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {presencas.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <strong>{formatarData(p.data)}</strong>
                      <span className="text-slate-500">{p.hora}</span>
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">
                        {p.situacao === 'REALIZADO'
                          ? 'Realizado'
                          : p.situacao === 'FALTOU'
                            ? 'Faltou'
                            : 'Justificou'}
                      </span>
                      {linksAssinatura.get(p.id) && (
                        <a
                          href={linksAssinatura.get(p.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]"
                        >
                          ver assinatura
                        </a>
                      )}
                      {p.confirmadoEm && (
                        <span className="text-[11.5px] text-slate-500">
                          Registrado por {p.registradoPor?.nome ?? 'equipe'} em{' '}
                          {formatarDataHora(p.confirmadoEm)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              </>
            )}
          </>
        ) : abaAtual === 'evolucao' ? (
          <>
            {realizadosSemEvolucao.length > 0 ? (
              <Link
                href={`/atendimento/${realizadosSemEvolucao[0].vinculo.id}/evolucao?data=${realizadosSemEvolucao[0].data.toISOString().slice(0, 10)}&hora=${realizadosSemEvolucao[0].hora}`}
                className="mb-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
              >
                + Novo registro de evolução
              </Link>
            ) : (
              <p className="mb-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                A evolução é escrita a partir de um atendimento.
              </p>
            )}
            {linhaDoTempo
              .filter(
                (a) =>
                  a.evolucao || a.situacao === 'FALTOU' || a.situacao === 'JUSTIFICOU' ||
                  a.situacao === 'CANCELADO',
              )
              .map((a) => (
                <div
                  key={a.id}
                  className={`mb-3 rounded-r-lg border-l-[3px] bg-white py-1 pl-3 pr-2 text-[13.5px] ${
                    a.situacao === 'JUSTIFICOU' ? 'border-[#F0C000]' : 'border-[#2EA84A]'
                  }`}
                >
                  {a.situacao === 'CANCELADO' ? (
                    <p className="text-slate-600">
                      <strong>
                        {formatarData(a.data)} · Cancelado — profissional ausente
                      </strong>
                    </p>
                  ) : a.evolucao && evolucoesVisiveis.has(a.evolucao.id) ? (
                    <>
                      <p className="text-[11.5px] font-bold text-[#2EA84A]">
                        {formatarData(a.data)}
                        {eAdmin ? ` · ${a.evolucao.autor.nome}` : ''}
                      </p>
                      <p>
                        <strong>Atividade:</strong> {a.evolucao.atividade}
                      </p>
                      <p>
                        <strong>Objetivo:</strong> {a.evolucao.objetivo}
                      </p>
                      {a.evolucao.observacoes && <p>{a.evolucao.observacoes}</p>}
                      {a.evolucao.autor.id === sessao.user.id && (
                        <Link
                          href={`/atendimento/${a.vinculo.id}/evolucao?data=${a.data.toISOString().slice(0, 10)}&hora=${a.hora}`}
                          className="mt-1 inline-flex min-h-[44px] items-center text-[12.5px] font-bold text-[#0A63C9]"
                        >
                          ✎ Editar
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-600">
                      <strong>
                        {formatarData(a.data)} ·{' '}
                        {a.situacao === 'FALTOU' ? 'faltou' : 'justificou'}
                      </strong>
                    </p>
                  )}
                </div>
              ))}
            {!eAdmin && (
              <p className="pt-2 text-xs text-slate-500">
                🔒 {avisoIsolamento}
              </p>
            )}
          </>
        ) : abaAtual === 'documentos' ? (
          <>
            <EnviarDocumento alunoId={aluno.id} />
            <GradeDocumentos documentos={documentos} podeExcluir={eAdmin} />
          </>
        ) : abaAtual === 'anamnese' ? (
          <>
            <Link
              href={`/anamneses?aluno=${aluno.id}`}
              className="mb-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
            >
              + Nova anamnese
            </Link>
            {anamneses.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                Nenhuma anamnese preenchida ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {anamneses.map((a) => {
                  const minha = a.autorId === sessao.user.id
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <div className="min-w-[200px] flex-1">
                        <p className="font-extrabold">{a.modelo.nome}</p>
                        <p className="text-[12.5px] text-slate-500">
                          {a.criadoEm.toLocaleDateString('pt-BR')}
                          {eAdmin ? ` · ${a.autor.nome}` : ''}
                        </p>
                      </div>
                      <Link
                        href={`/alunos/${aluno.id}/anamnese/${a.modeloId}?a=${a.id}&ver=1`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-xs font-bold text-[#0A63C9]"
                      >
                        Ver
                      </Link>
                      {minha && (
                        <Link
                          href={`/alunos/${aluno.id}/anamnese/${a.modeloId}?a=${a.id}`}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white"
                        >
                          Continuar
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {!eAdmin && (
              <p className="pt-2 text-xs text-slate-500">
                🔒 Você vê apenas as anamneses preenchidas por você.
              </p>
            )}
          </>
        ) : abaAtual === 'sugestoes' ? (
          <SugestoesAluno
            alunoId={aluno.id}
            alunoNome={aluno.nome}
            areas={areasParaSugestao}
            podeSugerir={sessao.user.perfil === 'PROFISSIONAL'}
            ehDirecao={eAdmin}
            sugestoes={sugestoesTela}
          />
        ) : abaAtual === 'consultas' ? (
          consultasTela.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Nenhuma consulta registrada ainda.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {consultasTela.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <strong>{c.dia.split('-').reverse().join('/')}</strong>
                      <span className="text-slate-500">{c.hora}</span>
                      <span className="text-slate-700">{c.profissionalNome}</span>
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">
                        {ROTULO_SITUACAO_CONSULTA[c.situacao] ?? c.situacao}
                      </span>
                      {c.tipo && (
                        <span className="text-[12.5px] text-slate-500">
                          {ROTULO_TIPO_CONSULTA[c.tipo as TipoConsultaRegistro] ?? c.tipo}
                        </span>
                      )}
                      {c.podeAbrir && (
                        <Link
                          href={`/consultas/${c.id}`}
                          className="ml-auto inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]"
                        >
                          Abrir
                        </Link>
                      )}
                    </div>
                    {c.verTexto && c.registro && (
                      <details className="mt-1 rounded-lg border border-slate-100 bg-[#f4f7fc] px-3 py-2">
                        <summary className="cursor-pointer text-[13px] font-bold text-[#0A63C9]">Ver registro</summary>
                        <div className="mt-1.5">
                          <DetalheRegistroConsulta r={c.registro} />
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
              {!eAdmin && (
                <p className="pt-2 text-xs text-slate-500">
                  🔒 Você vê o texto apenas dos registros escritos por você ou recebidos por transferência.
                </p>
              )}
            </>
          )
        ) : abaAtual === 'relatorios' ? (
          <RelatoriosAluno
            alunoId={aluno.id}
            alunoNome={aluno.nome}
            matricula={aluno.matricula}
            feitos={relatorios}
            anamneses={anamneses.map((a) => ({
              id: a.id,
              modelo: a.modelo.nome,
              data: a.criadoEm.toISOString(),
              autor: a.autor.nome,
            }))}
          />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Disponível em breve.
          </p>
        )}
      </main>
    </div>
  )
}
