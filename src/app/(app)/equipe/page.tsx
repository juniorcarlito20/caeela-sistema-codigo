// src/app/(app)/equipe/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'

// Agendas da equipe, só para ver (Secretaria). A direção usa Profissionais/Agendas.
export default async function PaginaEquipe() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'SECRETARIA' && sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const profissionais = await prisma.usuario.findMany({
    where: { ativo: true, perfil: 'PROFISSIONAL' },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, area: { select: { nome: true } } },
  })
  const eSecretaria = sessao.user.perfil === 'SECRETARIA'

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eSecretaria ? 'Secretaria' : 'Direção'}
        itemAtivo="Agendas"
        menu={eSecretaria ? 'secretaria' : 'admin'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Agendas da equipe</h1>
        <p className="mb-4 text-[13px] text-slate-500">Toque num profissional para ver quem ele atende em cada semana.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {profissionais.map((p) => (
            <li key={p.id}>
              <Link
                href={`/equipe/${p.id}`}
                className="flex min-h-[56px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-[#0A63C9]"
              >
                <strong className="text-[14px] text-[#0A63C9]">{p.nome}</strong>
                <span className="text-[12.5px] text-slate-500">{p.area?.nome ?? '—'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
