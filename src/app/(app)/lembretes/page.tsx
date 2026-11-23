import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { agruparPorProfissional, linhasDasConsultas, normalizarTelefone, primeiroNome } from '@/domain/lembrete'
import { acontece } from '@/domain/semanas'
import Cabecalho from '@/components/Cabecalho'
import { BotaoEnviar, NumeroForm } from '@/components/LembretesAcoes'
import FilaLembretes from '@/components/FilaLembretes'
import SeletorDataLembretes from '@/components/SeletorDataLembretes'
import { formatarHora, hojeDoCentro } from '@/lib/fuso'
import { diasSemAtendimentoEntre, marcacaoDoDia } from '@/lib/diasSemAtendimento'
import { avisoEnviado, semanasDoCartao } from '@/domain/diaSemAtendimento'
import CartaoSemana from '@/components/CartaoSemana'

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDia(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [a, m, d] = v.split('-').map(Number)
  const data = new Date(a, m - 1, d, 12, 0, 0)
  return Number.isNaN(data.getTime()) ? null : data
}

function textoData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

const SITUACAO: Record<string, { texto: string; classe: string }> = {
  AGENDADO: { texto: 'Agendado', classe: 'bg-slate-100 text-slate-600' },
  REALIZADO: { texto: 'Veio', classe: 'bg-[#e4f6e8] text-[#1c7a33]' },
  FALTOU: { texto: 'Faltou', classe: 'bg-[#fde7e7] text-[#B3261E]' },
  JUSTIFICOU: { texto: 'Justificou', classe: 'bg-[#fff6d6] text-[#8a6100]' },
  CANCELADO: { texto: 'Cancelado', classe: 'bg-slate-100 text-slate-500' },
}

export default async function PaginaLembretes({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN' && sessao.user.perfil !== 'SECRETARIA') redirect('/agenda')
  const eSecretaria = sessao.user.perfil === 'SECRETARIA'

  const { data } = await searchParams
  // "Hoje" no fuso do centro: depois das 21h o servidor já está no dia seguinte.
  const hojeData = hojeDoCentro()
  const amanha = new Date(hojeData)
  amanha.setDate(amanha.getDate() + 1)
  const dia = parseDia(data) ?? amanha
  const diaISO = isoLocal(dia)
  const diaSemana = ((dia.getDay() + 6) % 7) + 1

  // Dia sem atendimento? A tela vira "Avisos": todas as famílias precisam ser avisadas, mesmo as
  // que já tinham recebido o lembrete ou confirmado presença antes de o dia ser marcado.
  const marcacao = await marcacaoDoDia(diaISO)
  const motivoDoDia = marcacao?.motivo ?? null
  const ateCartao = new Date(hojeData)
  ateCartao.setDate(ateCartao.getDate() + 21)
  const marcados = await diasSemAtendimentoEntre(hojeData, ateCartao)

  // Projeção da grade: vínculos vigentes com horário neste dia da semana.
  const vinculos = await prisma.vinculo.findMany({
    where: { fim: null },
    include: {
      aluno: true,
      profissional: true,
      area: true,
      horarios: { where: { diaSemana, excluidoEm: null } },
    },
  })
  const comHorario = vinculos
    .map((v) => ({
      ...v,
      horarios: v.horarios.filter((h) =>
        acontece({ semanas: h.semanas, semanasNoCiclo: v.profissional.semanasNoCiclo, cicloInicio: v.profissional.cicloInicio }, dia)),
    }))
    .filter((v) => v.horarios.length > 0)
  const inicioDia = new Date(dia)
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(inicioDia.getTime() + 86400000)
  const atendimentos = await prisma.atendimento.findMany({
    where: { data: { gte: inicioDia, lt: fimDia } },
    include: { lembrete: true },
  })
  const porChave = new Map(
    atendimentos.map((a) => [`${a.vinculoId}-${a.hora}`, a]),
  )

  const linhasFixas = comHorario
    .flatMap((v) =>
      v.horarios.map((h) => {
        const at = porChave.get(`${v.id}-${h.hora}`) ?? null
        const tel = v.aluno.whatsapp ? normalizarTelefone(v.aluno.whatsapp) : null
        return {
          vinculoId: v.id,
          hora: h.hora,
          alunoId: v.aluno.id,
          aluno: v.aluno.nome,
          responsavel: v.aluno.responsavel,
          whatsapp: v.aluno.whatsapp,
          temZap: tel !== null,
          profissionalId: v.profissionalId,
          profissional: v.profissional.nome,
          area: v.area.nome,
          atendimentoId: at?.id ?? null,
          enviadoEm: at?.lembrete?.enviadoEm ?? null,
          confirmadoEm: at?.lembrete?.confirmadoEm ?? null,
          resposta: at?.lembrete?.resposta ?? null,
          situacao: at?.situacao ?? null,
          consulta: false,
          deFora: v.aluno.deFora,
        }
      }),
    )

  // Consultas avulsas do dia dos profissionais cuja agenda a direção marca (psiquiatra). As da agenda
  // própria (assistente social) não entram. Se a mesma chave já veio de um horário fixo, fica uma só.
  const consultasDoDia = await prisma.atendimento.findMany({
    where: {
      avulso: true,
      data: { gte: inicioDia, lt: fimDia },
      vinculo: {
        aluno: { excluidoEm: null },
        profissional: { tipoAgenda: 'AVULSA_DIRECAO', ativo: true, excluidoEm: null },
      },
    },
    include: {
      lembrete: true,
      vinculo: { include: { aluno: true, profissional: true, area: true } },
    },
  })
  const linhasConsultas = linhasDasConsultas(consultasDoDia, {
    diaSemAtendimento: !!marcacao,
    chavesJaNaTela: new Set(linhasFixas.map((l) => `${l.vinculoId}-${l.hora}`)),
  })
  const linhas = [...linhasFixas, ...linhasConsultas].sort((a, b) => a.hora.localeCompare(b.hora))

  const comZap = linhas.filter((l) => l.temZap).length
  const confirmados = linhas.filter((l) => l.confirmadoEm).length
  // Quem a fila ainda precisa avisar: tem WhatsApp e (dia normal) não recebeu, não respondeu e não
  // confirmou; (dia sem atendimento) ainda não recebeu o aviso.
  const pendente = (l: (typeof linhas)[number]) =>
    l.temZap &&
    (marcacao ? !avisoEnviado(l.enviadoEm, marcacao.marcadoEm) : !l.enviadoEm && !l.resposta && !l.confirmadoEm)
  const enviou = (l: (typeof linhas)[number]) =>
    marcacao ? avisoEnviado(l.enviadoEm, marcacao.marcadoEm) : l.enviadoEm !== null
  const grupos = agruparPorProfissional(linhas)

  // Nomes clicáveis, só para consulta. Direção abre a ficha completa; a secretária vê a página da
  // equipe e a ficha do aluno em modo só leitura (sem prontuário nem botões de ação).
  const linkProfissional = (id: string) => (eSecretaria ? `/equipe/${id}` : `/profissionais/${id}`)
  const linkAluno = (id: string): string | null => `/alunos/${id}`

  const nomeAluno = (id: string, nome: string, deFora = false) => {
    // A secretária não abre ficha de pessoa de fora do centro: nome sem link.
    const href = eSecretaria && deFora ? null : linkAluno(id)
    return href ? (
      <Link href={href} className="font-bold text-[#0A63C9] underline">
        {nome}
      </Link>
    ) : (
      <strong>{nome}</strong>
    )
  }

  const avisados = marcacao ? linhas.filter((l) => avisoEnviado(l.enviadoEm, marcacao.marcadoEm)).length : 0

  const diasRapidos = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hojeData)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe={eSecretaria ? 'Secretaria' : 'Direção'} itemAtivo="Lembretes" menu={eSecretaria ? 'secretaria' : 'admin'} />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <CartaoSemana semanas={semanasDoCartao(hojeData, marcados)} />
        <h1 className="text-xl font-extrabold">{motivoDoDia ? 'Avisos' : 'Lembretes'} de {textoData(dia)}</h1>
        {motivoDoDia && (
          <p className="my-2 rounded-xl border border-[#B3261E]/30 bg-[#fde7e7] px-4 py-3 text-[13px] text-slate-700">
            <strong>Dia sem atendimento:</strong> {motivoDoDia}. Toque em <strong>📲 Avisar</strong> para mandar o aviso
            a cada família, com a data do próximo atendimento.
          </p>
        )}
        <p className="mb-4 text-[13px] text-slate-500">
          {linhas.length} {linhas.length === 1 ? 'atendimento' : 'atendimentos'} ·{' '}
          {comZap} com WhatsApp cadastrado · {marcacao ? `${avisados} ${avisados === 1 ? 'avisado' : 'avisados'}` : `${confirmados} confirmados`}
        </p>
        {grupos.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-2 text-sm font-extrabold">Profissionais do dia</h2>
            <div className="flex flex-wrap gap-2">
              {grupos.map((g) => (
                <a
                  key={g.profissionalId}
                  href={`#prof-${g.profissionalId}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-2 text-xs font-bold text-[#0A63C9]"
                >
                  {g.profissional} · {g.linhas.length}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          {diasRapidos.map((d, i) => {
            const iso = isoLocal(d)
            const selecionado = iso === diaISO
            const amanhaTag = i === 1
            const rotulo =
              i === 0
                ? 'Hoje'
                : i === 1
                  ? 'Amanhã'
                  : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
            return (
              <Link
                key={iso}
                href={`/lembretes?data=${iso}`}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 text-xs font-bold ${
                  selecionado
                    ? 'bg-[#0A63C9] text-white'
                    : amanhaTag
                      ? 'border-[1.5px] border-[#F0C000] bg-[#fff6d6] text-[#8a6100]'
                      : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
                }`}
              >
                {rotulo}
                {marcados.has(iso) && <span className="ml-1">✕</span>}
              </Link>
            )
          })}
        </div>
        <div className="mb-4">
          <SeletorDataLembretes valorAtual={diaISO} />
        </div>
        {linhas.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum atendimento neste dia.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {grupos.map((g) => {
              const pend = g.linhas.filter(pendente)
              const semZap = g.linhas.filter((l) => !l.temZap).length
              const enviados = g.linhas.filter(enviou).length
              return (
                <section key={g.profissionalId} id={`prof-${g.profissionalId}`} className="scroll-mt-4">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold">
                        <Link href={linkProfissional(g.profissionalId)} className="text-[#0A63C9] underline">
                          {g.profissional}
                        </Link>
                      </h2>
                      <p className="text-[12.5px] text-slate-500">
                        {g.area} · {g.linhas.length} {g.linhas.length === 1 ? 'atendimento' : 'atendimentos'} ·{' '}
                        {marcacao ? `${enviados} ${enviados === 1 ? 'avisado' : 'avisados'}` : `${enviados} ${enviados === 1 ? 'enviado' : 'enviados'}`}
                      </p>
                    </div>
                    {pend.length > 0 && (
                      <FilaLembretes
                        profissional={primeiroNome(g.profissional)}
                        pendentes={pend.map((l) => ({ vinculoId: l.vinculoId, hora: l.hora, aluno: l.aluno }))}
                        semZap={semZap}
                        diaISO={diaISO}
                        aviso={!!marcacao}
                      />
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {g.linhas.map((l) => (
                      <li
                        key={`${l.vinculoId}-${l.hora}`}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="min-w-[200px] flex-1 text-[13.5px]">
                          <p>
                            {nomeAluno(l.alunoId, l.aluno, l.deFora)} · {l.hora}
                            {l.consulta && (
                              <span className="ml-2 inline-block rounded-full bg-[#e8f0fb] px-2 py-0.5 align-middle text-[11px] font-bold text-[#0A63C9]">
                                consulta
                              </span>
                            )}
                          </p>
                          {l.situacao && l.situacao !== 'AGENDADO' && (
                            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${SITUACAO[l.situacao]?.classe ?? ''}`}>
                              {motivoDoDia && l.situacao === 'CANCELADO' ? 'Sem atendimento' : (SITUACAO[l.situacao]?.texto ?? l.situacao)}
                            </span>
                          )}
                          <p className="text-[12px] text-slate-500">
                            {l.responsavel ?? 'Sem responsável'} ·{' '}
                            {l.whatsapp ?? 'sem WhatsApp cadastrado'}
                            {l.whatsapp && (
                              <> <NumeroForm alunoId={l.alunoId} atual={l.whatsapp} rotulo="corrigir" /></>
                            )}
                            {l.enviadoEm && !marcacao && (
                              <>
                                {' '}· ✔ enviado às{' '}
                                {formatarHora(l.enviadoEm)}
                              </>
                            )}
                            {marcacao && avisoEnviado(l.enviadoEm, marcacao.marcadoEm) && (
                              <>
                                {' '}· ✔ aviso enviado às{' '}
                                {formatarHora(l.enviadoEm!)}
                              </>
                            )}
                            {marcacao && l.enviadoEm && !avisoEnviado(l.enviadoEm, marcacao.marcadoEm) && (
                              <>
                                {' '}·{' '}
                                <strong className="text-[#B3261E]">
                                  {l.resposta === 'VAI' ? 'tinha confirmado presença' : 'recebeu o lembrete antes'} — falta o aviso
                                </strong>
                              </>
                            )}
                          </p>
                        </div>
                        {marcacao ? (
                          l.temZap ? (
                            <BotaoEnviar vinculoId={l.vinculoId} diaISO={diaISO} hora={l.hora} aviso />
                          ) : (
                            <NumeroForm alunoId={l.alunoId} atual={l.whatsapp} />
                          )
                        ) : l.resposta === 'VAI' ? (
                          <span className="inline-block rounded-full bg-[#e4f6e8] px-3 py-1.5 text-[11.5px] font-bold text-[#1c7a33]">
                            Família confirmou presença
                          </span>
                        ) : l.resposta === 'NAO_VAI' ? (
                          <span className="inline-block rounded-full bg-[#fff6d6] px-3 py-1.5 text-[11.5px] font-bold text-[#8a6100]">
                            Família avisou que não vai
                          </span>
                        ) : l.confirmadoEm ? (
                          <span className="inline-block rounded-full bg-[#e4f6e8] px-3 py-1.5 text-[11.5px] font-bold text-[#1c7a33]">
                            Confirmado
                          </span>
                        ) : l.temZap ? (
                          <BotaoEnviar vinculoId={l.vinculoId} diaISO={diaISO} hora={l.hora} />
                        ) : (
                          <NumeroForm alunoId={l.alunoId} atual={l.whatsapp} />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
