import { slotsPorProfissional } from '@/lib/slots'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { estaNaSemana, rotuloSemanas, semanaDoCiclo } from '@/domain/semanas'
import Cabecalho from '@/components/Cabecalho'
import GradeSemanal, { type SlotOcupado, livresNaSemana } from '@/components/GradeSemanal'

export default async function PaginaGradeCentro() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  // Uma consulta traz profissionais, vínculos e horários de uma vez.
  const profissionais = await prisma.usuario.findMany({
    where: { ativo: true, perfil: 'PROFISSIONAL' },
    orderBy: { nome: 'asc' },
    include: {
      area: true,
      vinculos: { where: { fim: null }, include: { horarios: { where: { excluidoEm: null } }, aluno: true } },
      horariosIndisponiveis: { select: { diaSemana: true, hora: true } },
    },
  })

  const slotsMap = await slotsPorProfissional(profissionais.map((p) => p.id))

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Alunos" />
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        <Link
          href="/painel"
          className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]"
        >
          ← Voltar para o painel
        </Link>
        <h1 className="text-xl font-extrabold">Grade desta semana — centro inteiro</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Verde é horário livre · use para achar vaga para quem está na lista de espera
        </p>
        {profissionais.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum profissional ativo.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {profissionais.map((p) => {
            const ciclo = { semanasNoCiclo: p.semanasNoCiclo, cicloInicio: p.cicloInicio }
            const semanaHoje = semanaDoCiclo(ciclo, new Date())
            const ocupados = new Map<string, SlotOcupado[]>()
            for (const v of p.vinculos) {
              for (const h of v.horarios) {
                if (!estaNaSemana(h.semanas, semanaHoje)) continue
                const chave = `${h.diaSemana}-${h.hora}`
                ocupados.set(chave, [
                  ...(ocupados.get(chave) ?? []),
                  {
                    nome: v.aluno.nome.split(' ')[0],
                    rotulo: rotuloSemanas(h.semanas, ciclo.semanasNoCiclo),
                    alunoId: v.aluno.id,
                  },
                ])
              }
            }
            const indisponiveisDoProfissional = new Set(
              p.horariosIndisponiveis.map((i) => `${i.diaSemana}-${i.hora}`),
            )
            const indisponiveisNaoOcupados = [...indisponiveisDoProfissional].filter(
              (c) => !ocupados.has(c),
            ).length
            const slotsDoProf = slotsMap[p.id] ?? []
            const livres = livresNaSemana(slotsDoProf, ocupados, indisponiveisNaoOcupados)
            return (
              <section key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-[15px] font-extrabold">
                  <Link href={`/profissionais/${p.id}`} className="hover:underline">
                    {p.nome}
                  </Link>{' '}
                  <span className="text-[12px] font-normal text-slate-500">
                    · {p.area?.nome ?? '—'} ·{' '}
                    <strong className="text-[#1c7a33]">{livres} livres</strong>
                    {ciclo.semanasNoCiclo > 1 && ` · Semana ${semanaHoje}`}
                  </span>
                </h2>
                <GradeSemanal ocupados={ocupados} slots={slotsDoProf} />
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
