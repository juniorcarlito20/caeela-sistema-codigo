import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'
import FolhaMensal from '@/components/FolhaMensal'

export default async function PaginaFolhaMensal() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const profissionais = await prisma.usuario.findMany({
    where: { ativo: true, perfil: 'PROFISSIONAL' },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Alunos" />
      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <Link
          href="/painel"
          className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]"
        >
          ← Voltar para o painel
        </Link>
        <h1 className="text-xl font-extrabold">Folha de presença mensal</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          O documento que substitui a folha assinada arquivada no centro
        </p>
        <FolhaMensal profissionais={profissionais} />
      </main>
    </div>
  )
}
