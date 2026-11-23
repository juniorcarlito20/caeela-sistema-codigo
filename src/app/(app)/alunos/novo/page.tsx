import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { proximaMatricula } from '@/domain/matricula'
import Cabecalho from '@/components/Cabecalho'
import FormularioAluno from '@/components/FormularioAluno'

export default async function PaginaNovoAluno() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const ano = new Date().getFullYear()
  const ultima = await prisma.aluno.findFirst({
    where: { matricula: { startsWith: `${ano}-` } },
    orderBy: { matricula: 'desc' },
    select: { matricula: true },
  })
  const proxima = proximaMatricula(ano, ultima?.matricula)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={sessao.user.perfil === 'ADMIN' ? 'Direção' : 'Profissional'}
        itemAtivo="Alunos"
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Novo aluno</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          A matrícula é gerada automaticamente ao salvar · próxima:{' '}
          <strong>{proxima}</strong>
        </p>
        <FormularioAluno />
      </main>
    </div>
  )
}
