import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { pendenciasDoAluno, rotuloSituacao } from '@/domain/matricula'
import { podeVerAluno } from '@/domain/permissoes'
import Cabecalho from '@/components/Cabecalho'
import FiltroSituacaoAluno from '@/components/FiltroSituacaoAluno'

const SITUACOES = ['ESPERA', 'ATENDIMENTO', 'PAUSA', 'ALTA', 'DESLIGADO'] as const

export default async function PaginaAlunos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; situacao?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const { q, situacao } = await searchParams

  // Direção e Secretaria veem todos os alunos (a Secretaria só consulta); Profissional vê os seus.
  const eSecretaria = sessao.user.perfil === 'SECRETARIA'
  const veTodos = sessao.user.perfil === 'ADMIN' || eSecretaria
  const detalhe = sessao.user.perfil === 'ADMIN' ? 'Direção' : eSecretaria ? 'Secretaria' : 'Profissional'
  const busca = (q ?? '').trim()
  const digitos = busca.replace(/\D/g, '')
  const filtroSituacao = SITUACOES.includes(situacao as (typeof SITUACOES)[number])
    ? situacao!
    : undefined
  // Sem filtro, a lista não traz os desligados (nem os conta); "TODOS" traz tudo.
  const comDesligados = situacao === 'TODOS'

  // Profissional vê os alunos com vínculo seu (vigente ou já encerrado: histórico).
  let idsPermitidos: string[] | undefined
  if (!veTodos) {
    const meus = await prisma.vinculo.findMany({
      where: { profissionalId: sessao.user.id },
      select: { alunoId: true },
    })
    idsPermitidos = [...new Set(meus.map((v) => v.alunoId))]
    if (idsPermitidos.length === 0) {
      return (
        <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
          <Cabecalho nome={sessao.user.name ?? ''} detalhe={detalhe} itemAtivo="Alunos" menu="profissional" />
          <main className="mx-auto w-full max-w-5xl px-4 py-5">
            <h1 className="text-xl font-extrabold">Meus alunos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Você ainda não tem alunos encaminhados.
            </p>
          </main>
        </div>
      )
    }
  }

  const alunos = await prisma.aluno.findMany({
    where: {
      excluidoEm: null,
      deFora: false, // pessoa de fora do centro nunca entra na lista de alunos, nem com desligados
      ...(idsPermitidos ? { id: { in: idsPermitidos } } : {}),
      ...(filtroSituacao
        ? { situacao: filtroSituacao as (typeof SITUACOES)[number] }
        : comDesligados
          ? {}
          : { situacao: { not: 'DESLIGADO' as const } }),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { matricula: { contains: busca, mode: 'insensitive' } },
              ...(digitos ? [{ cpf: { contains: digitos } }] : []),
            ],
          }
        : {}),
    },
    // Na fila de espera, ordena por quem espera há mais tempo, não alfabético.
    orderBy: filtroSituacao === 'ESPERA' ? { situacaoDesde: 'asc' } : { nome: 'asc' },
  })

  // Garante a regra de isolamento também no código, não só na consulta.
  let visiveis = alunos
  if (!veTodos && idsPermitidos) {
    const vinculos = await prisma.vinculo.findMany({
      where: { alunoId: { in: idsPermitidos }, profissionalId: sessao.user.id },
      select: { alunoId: true, profissionalId: true, fim: true },
    })
    const porAluno = new Map<string, { profissionalId: string; fim: Date | null }[]>()
    for (const v of vinculos) {
      const lista = porAluno.get(v.alunoId) ?? []
      lista.push({ profissionalId: v.profissionalId, fim: v.fim })
      porAluno.set(v.alunoId, lista)
    }
    visiveis = alunos.filter((a) =>
      podeVerAluno(
        { id: sessao.user.id, perfil: sessao.user.perfil },
        porAluno.get(a.id) ?? [],
      ),
    )
  }

  const titulo = veTodos ? 'Alunos' : 'Meus alunos'
  const menu = sessao.user.perfil === 'ADMIN' ? ('admin' as const) : eSecretaria ? ('secretaria' as const) : ('profissional' as const)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe={detalhe} itemAtivo="Alunos" menu={menu} />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-extrabold">{titulo}</h1>
            <p className="text-[13px] text-slate-500">
              {visiveis.length} {visiveis.length === 1 ? 'aluno' : 'alunos'}
            </p>
          </div>
          {sessao.user.perfil === 'ADMIN' && (
            <Link
              href="/alunos/novo"
              className="ml-auto inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white"
            >
              + Novo aluno
            </Link>
          )}
        </div>
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome, matrícula ou CPF…"
            className="min-h-[44px] min-w-[200px] flex-1 rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
          <FiltroSituacaoAluno
            opcoes={[
              ...SITUACOES.map((s) => ({ valor: s as string, rotulo: rotuloSituacao(s) })),
              { valor: 'TODOS', rotulo: 'Todas, com desligados' },
            ]}
            valorAtual={filtroSituacao ?? (comDesligados ? 'TODOS' : '')}
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Buscar
          </button>
        </form>
        {visiveis.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum aluno encontrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visiveis.map((a) => {
              const pendencias = pendenciasDoAluno(a)
              return (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <Link href={`/alunos/${a.id}`} className="block">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-[15px]">{a.nome}</strong>
                      <span className="text-xs text-slate-500">{a.matricula}</span>
                      <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
                        {rotuloSituacao(a.situacao)}
                      </span>
                      {a.situacao === 'ESPERA' && a.pausaRetomarEm && (
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">
                          retornando de pausa
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
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
