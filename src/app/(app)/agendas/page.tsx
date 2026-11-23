import { slotsPorProfissional } from '@/lib/slots'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'
import AgendasClient, {
  type AlunoOpcao,
  type OcupacaoTela,
  type VinculoVigente,
} from '@/components/AgendasClient'

export default async function PaginaAgendas({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')
  const { aluno } = await searchParams

  const [alunos, areas, profissionais, vinculos, indisponibilidades] = await Promise.all([
    prisma.aluno.findMany({
      where: { excluidoEm: null, deFora: false, situacao: { not: 'DESLIGADO' } },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, matricula: true, situacao: true },
    }),
    prisma.area.findMany({ orderBy: { nome: 'asc' } }),
    prisma.usuario.findMany({
      where: { ativo: true, perfil: 'PROFISSIONAL' },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, usuario: true, areaId: true, semanasNoCiclo: true },
    }),
    prisma.vinculo.findMany({
      where: { fim: null, aluno: { deFora: false } },
      include: {
        aluno: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true, semanasNoCiclo: true } },
        area: { select: { id: true, nome: true } },
        horarios: { where: { excluidoEm: null } },
      },
      orderBy: { inicio: 'desc' },
    }),
    prisma.horarioIndisponivel.findMany({
      select: { profissionalId: true, diaSemana: true, hora: true },
    }),
  ])

  const ocupacoes: OcupacaoTela[] = vinculos.flatMap((v) =>
    v.horarios.map((h) => ({
      vinculoId: v.id,
      horarioId: h.id,
      alunoId: v.alunoId,
      alunoNome: v.aluno.nome,
      profissionalId: v.profissionalId,
      diaSemana: h.diaSemana,
      hora: h.hora,
      local: h.local,
      semanas: h.semanas,
    })),
  )

  const vigentes: VinculoVigente[] = vinculos.flatMap((v) =>
    v.horarios.map((h) => ({
      vinculoId: v.id,
      horarioId: h.id,
      alunoId: v.alunoId,
      alunoNome: v.aluno.nome,
      profissionalId: v.profissionalId,
      profissionalNome: v.profissional.nome,
      areaId: v.area.id,
      areaNome: v.area.nome,
      diaSemana: h.diaSemana,
      hora: h.hora,
      semanas: h.semanas,
      semanasNoCiclo: v.profissional.semanasNoCiclo,
      inicio: v.inicio.toISOString().slice(0, 10),
    })),
  )

  const slotsMap = await slotsPorProfissional(profissionais.map((p) => p.id))

  const opcoes: AlunoOpcao[] = alunos.map((a) => ({
    id: a.id,
    nome: a.nome,
    matricula: a.matricula,
    situacao: a.situacao,
  }))

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe="Direção"
        itemAtivo="Agendas"
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Encaminhar aluno</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Escolha o aluno, a área e o profissional, toque num horário verde e confirme
        </p>
        <AgendasClient
          alunos={opcoes}
          areas={areas}
          profissionais={profissionais}
          ocupacoes={ocupacoes}
          vigentes={vigentes}
          alunoInicial={aluno ?? ''}
          indisponibilidades={indisponibilidades}
          slotsPorProfissional={slotsMap}
        />
      </main>
    </div>
  )
}
