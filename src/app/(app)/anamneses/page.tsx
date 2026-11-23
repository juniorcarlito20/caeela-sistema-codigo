import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { agruparPorSecao, ehPergunta, type Campo } from '@/domain/anamnese'
import Cabecalho from '@/components/Cabecalho'

export default async function PaginaAnamneses({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; aluno?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')

  const { q, aluno } = await searchParams
  const busca = (q ?? '').trim()

  const modelos = await prisma.modeloAnamnese.findMany({
    where: {
      ativo: true,
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    },
    include: { area: true },
    orderBy: { nome: 'asc' },
  })

  let nomeAluno: string | null = null
  if (aluno) {
    const a = await prisma.aluno.findFirst({
      where: { id: aluno, excluidoEm: null },
      select: { nome: true },
    })
    nomeAluno = a?.nome ?? null
  }
  const menu = sessao.user.perfil === 'ADMIN' ? ('admin' as const) : ('profissional' as const)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={sessao.user.perfil === 'ADMIN' ? 'Direção' : 'Profissional'}
        itemAtivo="Alunos"
        menu={menu}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Anamneses</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {nomeAluno
            ? `Escolha o modelo para ${nomeAluno}`
            : 'Os modelos servem para todos os profissionais — a escolha varia com a idade e o caso'}
        </p>
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          {aluno && <input type="hidden" name="aluno" value={aluno} />}
          <input
            type="search"
            name="q"
            defaultValue={busca}
            placeholder="Buscar modelo…"
            className="min-h-[44px] min-w-[200px] flex-1 rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Buscar
          </button>
        </form>
        <div className="flex flex-col gap-2">
          {modelos.map((m) => {
            const campos = m.campos as unknown as Campo[]
            const secoes = agruparPorSecao(campos)
            const temEscala = campos.some((c) => c.tipo === 'escala')
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-[200px] flex-1">
                  <p className="text-[15px] font-extrabold">{m.nome}</p>
                  <p className="text-[12.5px] text-slate-500">
                    {m.area?.nome ? `Área sugerida: ${m.area.nome} · ` : ''}
                    {campos.filter(ehPergunta).length} campos em {secoes.length}{' '}
                    {secoes.length === 1 ? 'seção' : 'seções'}
                  </p>
                </div>
                {nomeAluno ? (
                  <Link
                    href={`/alunos/${aluno}/anamnese/${m.id}${temEscala ? '?nova=1' : ''}`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] min-w-[110px] px-5 py-2.5 text-sm font-bold text-white"
                    title={temEscala ? 'Começa uma nova aplicação em branco (as anteriores ficam na aba Anamnese)' : undefined}
                  >
                    Preencher
                  </Link>
                ) : (
                  <span
                    title="Escolha o aluno na ficha dele para preencher"
                    className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 min-w-[110px] px-5 py-2.5 text-sm font-bold text-slate-400"
                  >
                    Preencher
                  </span>
                )}
              </div>
            )
          })}
          {modelos.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Nenhum modelo encontrado.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
