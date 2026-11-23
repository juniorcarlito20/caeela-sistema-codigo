// src/app/(app)/equipe/[id]/page.tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { slotsDoProfissional } from '@/lib/slots'
import { estaNaSemana, semanaDoCiclo, todasAsSemanas } from '@/domain/semanas'
import Cabecalho from '@/components/Cabecalho'
import GradeSemanalEditavel, { type CelulaAgenda } from '@/components/GradeSemanalEditavel'
import SemanasDoProfissional, { type SemanaResumo } from '@/components/SemanasDoProfissional'

// A agenda de um profissional, só para ver: as semanas e a grade, sem editar e sem abrir
// a ficha do aluno.
export default async function PaginaAgendaDaEquipe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ semana?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'SECRETARIA' && sessao.user.perfil !== 'ADMIN') redirect('/agenda')
  const eSecretaria = sessao.user.perfil === 'SECRETARIA'

  const { id } = await params
  const { semana } = await searchParams
  const profissional = await prisma.usuario.findFirst({
    where: { id, perfil: 'PROFISSIONAL' },
    include: { area: true },
  })
  if (!profissional) notFound()

  const [vinculos, indisponiveisBrutos, slots] = await Promise.all([
    prisma.vinculo.findMany({
      where: { profissionalId: id, fim: null, aluno: { excluidoEm: null, deFora: false } },
      include: { aluno: { select: { id: true, nome: true } }, horarios: { where: { excluidoEm: null } } },
    }),
    prisma.horarioIndisponivel.findMany({ where: { profissionalId: id }, select: { diaSemana: true, hora: true } }),
    slotsDoProfissional(id),
  ])
  const indisponiveis = new Set(indisponiveisBrutos.map((i) => `${i.diaSemana}-${i.hora}`))

  const ciclo = { semanasNoCiclo: profissional.semanasNoCiclo, cicloInicio: profissional.cicloInicio }
  const semanaAtual = semanaDoCiclo(ciclo, new Date())
  const pedida = Number(semana)
  const semanaVista = Number.isInteger(pedida) && pedida >= 1 && pedida <= ciclo.semanasNoCiclo ? pedida : semanaAtual

  const celulas = new Map<string, CelulaAgenda>()
  for (const v of vinculos) {
    for (const h of v.horarios) {
      const chave = `${h.diaSemana}-${h.hora}`
      const celula = celulas.get(chave) ?? { itens: [] }
      celula.itens.push({ horarioId: h.id, vinculoId: v.id, alunoId: v.aluno.id, alunoNome: v.aluno.nome, semanas: h.semanas })
      celulas.set(chave, celula)
    }
  }
  const todas = todasAsSemanas(ciclo.semanasNoCiclo)
  // Sem datas nas abas (a semana se reconhece pela turma), igual à ficha do profissional.
  const semanasResumo: SemanaResumo[] = Array.from({ length: ciclo.semanasNoCiclo }, (_, i) => i + 1).map((n) => {
    return {
      n,
      nomes: [
        ...new Set(
          vinculos.flatMap((v) =>
            v.horarios.filter((h) => estaNaSemana(h.semanas, n) && h.semanas !== todas).map(() => v.aluno.nome.split(' ')[0]),
          ),
        ),
      ].sort(),
    }
  })

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eSecretaria ? 'Secretaria' : 'Direção'}
        itemAtivo="Agendas"
        menu={eSecretaria ? 'secretaria' : 'admin'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <Link href="/equipe" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]">
          ← Voltar
        </Link>
        <h1 className="mb-3 text-xl font-extrabold">
          {profissional.nome}{' '}
          <span className="text-[13px] font-normal text-slate-500">· {profissional.area?.nome ?? '—'}</span>
        </h1>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SemanasDoProfissional
            profissionalId={id}
            caminhoBase={`/equipe/${id}`}
            semanasNoCiclo={ciclo.semanasNoCiclo}
            semanaVista={semanaVista}
            semanaAtual={semanaAtual}
            semanas={semanasResumo}
            editavel={false}
          />
          <GradeSemanalEditavel
            key={semanaVista}
            celulas={celulas}
            semanaVista={semanaVista}
            semanasNoCiclo={ciclo.semanasNoCiclo}
            editavel={false}
            linkAluno={false}
            alunos={[]}
            profissionalId={id}
            areaId=""
            indisponiveis={indisponiveis}
            slots={slots}
            profissionalNome={profissional.nome}
          />
        </div>
      </main>
    </div>
  )
}
