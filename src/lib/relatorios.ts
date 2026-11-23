import { prisma } from '@/db/prisma'
import { resumoDoPeriodo, textoPeriodo } from '@/domain/presenca'

export type ResumoRelatorio = {
  vinculoId: string
  area: string
  profissional: string
  periodo: string
  inicio: Date
  fim: Date
  resumo: { total: number; realizados: number; faltas: number; justificadas: number; cancelados: number }
}

// Números do relatório: atendimentos do vínculo no período. Sem período
// informado, vale do primeiro ao último atendimento do vínculo.
export async function dadosParaRelatorio(
  alunoId: string,
  vinculoId: string,
  inicioMes?: string | null,
  fimMes?: string | null,
): Promise<ResumoRelatorio> {
  const vinculo = await prisma.vinculo.findUnique({
    where: { id: vinculoId },
    include: {
      area: true,
      profissional: true,
      atendimentos: { orderBy: { data: 'asc' } },
    },
  })
  if (!vinculo || vinculo.alunoId !== alunoId) {
    throw new Error('Vínculo não encontrado para este aluno.')
  }

  let inicio: Date
  let fim: Date
  if (inicioMes && fimMes) {
    inicio = new Date(`${inicioMes}-01T12:00:00`)
    const [a, m] = fimMes.split('-').map(Number)
    fim = new Date(a, m, 0, 12, 0, 0) // último dia do mês
  } else if (vinculo.atendimentos.length > 0) {
    inicio = vinculo.atendimentos[0].data
    fim = vinculo.atendimentos[vinculo.atendimentos.length - 1].data
  } else {
    const agora = new Date()
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 12, 0, 0)
    fim = agora
  }

  const noPeriodo = vinculo.atendimentos.filter((at) => at.data >= inicio && at.data <= fim)
  return {
    vinculoId: vinculo.id,
    area: vinculo.area.nome,
    profissional: vinculo.profissional.nome,
    periodo: textoPeriodo(inicio, fim),
    inicio,
    fim,
    resumo: resumoDoPeriodo(noPeriodo),
  }
}

// Vínculo que sustenta o relatório: o mais recente do autor com o aluno
// (a direção usa o vínculo vigente mais recente do aluno).
export async function vinculoParaRelatorio(alunoId: string, autorId: string, eAdmin: boolean) {
  if (eAdmin) {
    return prisma.vinculo.findFirst({
      where: { alunoId, fim: null },
      orderBy: { inicio: 'desc' },
    })
  }
  return prisma.vinculo.findFirst({
    where: { alunoId, profissionalId: autorId },
    orderBy: { inicio: 'desc' },
  })
}
