import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { urlDoArquivo } from '@/lib/storage'
import Cabecalho from '@/components/Cabecalho'
import FormAusencia from '@/components/FormAusencia'
import BotaoApagarAusencia from '@/components/BotaoApagarAusencia'

const ROTULOS: Record<string, string> = {
  FALTA: 'Falta',
  ATESTADO: 'Atestado',
  LICENCA: 'Licença',
  FERIAS: 'Férias',
  CAPACITACAO: 'Capacitação',
  OUTRO: 'Outro',
}

export default async function PaginaAusencias({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; profissional?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const eAdmin = sessao.user.perfil === 'ADMIN'

  const { mes, profissional } = await searchParams
  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const mesSel = /^\d{4}-\d{2}$/.test(mes ?? '') ? mes! : mesAtual
  const [ano, mm] = mesSel.split('-').map(Number)
  const inicioMes = new Date(ano, mm - 1, 1)
  const fimMes = new Date(ano, mm, 0, 23, 59, 59)

  const profissionais = eAdmin
    ? await prisma.usuario.findMany({
        where: { ativo: true, perfil: 'PROFISSIONAL' },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      })
    : []

  const ausencias = await prisma.ausencia.findMany({
    where: {
      excluidoEm: null,
      inicio: { lte: fimMes },
      fim: { gte: inicioMes },
      ...(eAdmin
        ? profissional
          ? { profissionalId: profissional }
          : {}
        : { profissionalId: sessao.user.id }),
    },
    include: { profissional: { select: { id: true, nome: true } } },
    orderBy: { inicio: 'desc' },
  })

  const comUrl = []
  for (const a of ausencias) {
    comUrl.push({
      ...a,
      atestadoUrl: a.documentoChave ? await urlDoArquivo(a.documentoChave) : null,
    })
  }

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eAdmin ? 'Direção' : 'Profissional'}
        itemAtivo="Alunos"
        menu={eAdmin ? 'admin' : 'profissional'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Ausências</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {eAdmin
            ? 'Faltas, atestados, licenças, férias e capacitações da equipe'
            : 'Suas ausências registradas'}
        </p>
        <FormAusencia
          profissionais={profissionais}
          fixo={eAdmin ? undefined : sessao.user.id}
        />
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="aus-mes" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Mês
            </label>
            <input
              id="aus-mes"
              type="month"
              name="mes"
              defaultValue={mesSel}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          {eAdmin && (
            <div>
              <label htmlFor="aus-fprof" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Profissional
              </label>
              <select
                id="aus-fprof"
                name="profissional"
                defaultValue={profissional ?? ''}
                className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
              >
                <option value="">Todos</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Filtrar
          </button>
        </form>
        {comUrl.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhuma ausência neste mês.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comUrl.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p>
                  <strong>{a.profissional.nome}</strong> · {ROTULOS[a.tipo] ?? a.tipo} ·{' '}
                  {a.inicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a{' '}
                  {a.fim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </p>
                {a.justificativa && <p className="text-slate-600">{a.justificativa}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-slate-500">
                  <span>Registrado por {a.registradoPor}</span>
                  {a.atestadoUrl && (
                    <a
                      href={a.atestadoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]"
                    >
                      Ver atestado
                    </a>
                  )}
                  <Link
                    href={`/profissionais/${a.profissional.id}/ausencias`}
                    className="inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]"
                  >
                    Histórico
                  </Link>
                  <BotaoApagarAusencia id={a.id} nome={a.profissional.nome} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
