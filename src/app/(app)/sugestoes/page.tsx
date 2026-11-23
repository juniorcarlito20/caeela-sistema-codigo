import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'
import CartaoSugestao from '@/components/CartaoSugestao'
import { filtroAlunoAtivo, incluirSugestao, paraTela } from '@/lib/sugestoes'

const FILTROS = [
  { id: 'pendentes', rotulo: 'Pendentes' },
  { id: 'resolvidas', rotulo: 'Resolvidas' },
  { id: 'todas', rotulo: 'Todas' },
] as const

export default async function PaginaSugestoes({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const { situacao } = await searchParams
  const filtro = FILTROS.find((f) => f.id === situacao)?.id ?? 'pendentes'
  const filtroSituacao: Prisma.SugestaoWhereInput =
    filtro === 'pendentes' ? { situacao: 'PENDENTE' } : filtro === 'resolvidas' ? { situacao: 'RESOLVIDA' } : {}

  const [pendentes, linhas] = await Promise.all([
    prisma.sugestao.count({ where: { situacao: 'PENDENTE', ...filtroAlunoAtivo } }),
    prisma.sugestao.findMany({
      where: { ...filtroSituacao, ...filtroAlunoAtivo },
      include: incluirSugestao,
      orderBy: { criadoEm: 'desc' },
      take: 200,
    }),
  ])
  const sugestoes = linhas.map(paraTela)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Sugestões" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Sugestões dos profissionais</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          O que os profissionais sugerem sobre cada criança: outro profissional do centro, exame ou consulta fora.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={`/sugestoes?situacao=${f.id}`}
              className={`inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-xs font-bold ${
                filtro === f.id ? 'bg-[#0A63C9] text-white' : 'border-[1.5px] border-slate-300 bg-white text-slate-600'
              }`}
            >
              {f.rotulo}
              {f.id === 'pendentes' ? ` (${pendentes})` : ''}
            </Link>
          ))}
        </div>
        {sugestoes.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            {filtro === 'pendentes' ? 'Nenhuma sugestão esperando a direção.' : 'Nenhuma sugestão nesta lista.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sugestoes.map((s) => (
              <CartaoSugestao key={s.id} s={s} mostrarAluno comAcoes />
            ))}
          </ul>
        )}
        {sugestoes.length === 200 && (
          <p className="mt-2 text-xs text-slate-500">Mostra as 200 sugestões mais recentes.</p>
        )}
      </main>
    </div>
  )
}
