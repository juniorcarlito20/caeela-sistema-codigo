import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { diasDaAusencia, resumoFrequencia, type TipoAusencia } from '@/domain/ausencia'
import { diasPrevistos, isoDia } from '@/domain/diaSemAtendimento'
import { diasSemAtendimentoEntre } from '@/lib/diasSemAtendimento'
import Cabecalho from '@/components/Cabecalho'
import FormAusencia from '@/components/FormAusencia'
import BotaoApagarAusencia from '@/components/BotaoApagarAusencia'
import { urlDoArquivo } from '@/lib/storage'

const ROTULOS: Record<string, string> = {
  FALTA: 'Falta',
  ATESTADO: 'Atestado',
  LICENCA: 'Licença',
  FERIAS: 'Férias',
  CAPACITACAO: 'Capacitação',
  OUTRO: 'Outro',
}

export default async function PaginaAusenciasProfissional({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
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

  const { mes } = await searchParams
  const mesSel =
    mes && /^\d{4}-\d{2}$/.test(mes)
      ? mes
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [ano, mm] = mesSel.split('-').map(Number)
  const inicioMes = new Date(ano, mm - 1, 1)
  const fimMes = new Date(ano, mm, 0, 23, 59, 59)

  // Dia sem atendimento do centro não é dia previsto nem conta como ausência.
  const semAtendimento = new Set((await diasSemAtendimentoEntre(inicioMes, fimMes)).keys())

  const ausencias = await prisma.ausencia.findMany({
    where: { profissionalId: id, excluidoEm: null },
    orderBy: { inicio: 'desc' },
    take: 60,
  })
  const doMes = ausencias.filter((a) => a.inicio <= fimMes && a.fim >= inicioMes)
  const diasPorTipo = new Map<string, number>()
  const datas: { dia: string; tipo: string }[] = []
  for (const a of doMes) {
    const dias = diasDaAusencia(
      a.inicio < inicioMes ? inicioMes : a.inicio,
      a.fim > fimMes ? fimMes : a.fim,
    ).filter((d) => !semAtendimento.has(isoDia(d)))
    diasPorTipo.set(a.tipo, (diasPorTipo.get(a.tipo) ?? 0) + dias.length)
    for (const d of dias) {
      datas.push({
        dia: d.toLocaleDateString('pt-BR'),
        tipo: ROTULOS[a.tipo] ?? a.tipo,
      })
    }
  }
  datas.sort((a, b) => a.dia.localeCompare(b.dia))

  const horarios = await prisma.horario.findMany({
    where: { vinculo: { profissionalId: id, fim: null }, excluidoEm: null },
    select: { diaSemana: true },
  })
  const diasComHorario = new Set(horarios.map((h) => h.diaSemana))
  const previstos = diasPrevistos(inicioMes, fimMes, diasComHorario, semAtendimento)
  const resumo = resumoFrequencia(
    [...diasPorTipo.entries()].map(([tipo, dias]) => ({ tipo, dias })),
    previstos,
  )

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eAdmin ? 'Direção' : 'Profissional'}
        itemAtivo={eAdmin ? 'Profissionais' : 'Agenda'}
        menu={eAdmin ? 'admin' : 'profissional'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Frequência de {profissional.nome}</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {profissional.area?.nome ?? '—'}
        </p>

        {!eAdmin && <FormAusencia profissionais={[]} fixo={id} />}

        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="f-mes" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Mês
            </label>
            <input
              id="f-mes"
              type="month"
              name="mes"
              defaultValue={mesSel}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Ver
          </button>
          <a
            href={`/api/ausencias/frequencia?profissionalId=${id}&mes=${mesSel}`}
            download
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white"
          >
            📄 Baixar PDF do mês
          </a>
        </form>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-2xl leading-none text-[#0A63C9]">{resumo.previstos}</strong>
            <span className="text-[11.5px] text-slate-500">dias previstos</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-2xl leading-none text-[#B3261E]">{resumo.ausentes}</strong>
            <span className="text-[11.5px] text-slate-500">
              ausentes ({resumo.justificados} justificados)
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-2xl leading-none text-[#2EA84A]">{resumo.percentual}%</strong>
            <span className="text-[11.5px] text-slate-500">de presença</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-2xl leading-none text-slate-600">{datas.length}</strong>
            <span className="text-[11.5px] text-slate-500">dias listados abaixo</span>
          </div>
        </div>

        {datas.length > 0 && (
          <ul className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
            {datas.map((d, i) => (
              <li key={`${d.dia}-${i}`} className="border-b border-slate-100 py-1.5 last:border-0">
                {d.dia} · {d.tipo}
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-2 text-[15px] font-extrabold">Histórico</h2>
        {ausencias.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhuma ausência registrada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ausencias.map((a) => (
              <AusenciaLinha key={a.id} id={a.id} tipo={a.tipo} inicio={a.inicio} fim={a.fim}
                justificativa={a.justificativa} documentoChave={a.documentoChave}
                registradoPor={a.registradoPor} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

async function AusenciaLinha({
  id, tipo, inicio, fim, justificativa, documentoChave, registradoPor,
}: {
  id: string
  tipo: TipoAusencia
  inicio: Date
  fim: Date
  justificativa: string | null
  documentoChave: string | null
  registradoPor: string
}) {
  const url = documentoChave ? await urlDoArquivo(documentoChave) : null
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p>
        <strong>{ROTULOS[tipo] ?? tipo}</strong> ·{' '}
        {inicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a{' '}
        {fim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
      </p>
      {justificativa && <p className="text-slate-600">{justificativa}</p>}
      <p className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-slate-500">
        <span>Registrado por {registradoPor}</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]"
          >
            Ver atestado
          </a>
        )}
        <BotaoApagarAusencia id={id} nome="esta ausência" />
      </p>
    </li>
  )
}
