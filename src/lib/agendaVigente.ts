import { prisma } from '@/db/prisma'
import { carregarDuracoes, duracaoEfetiva, carregarVagas, vagasEfetivas } from '@/lib/slots'
import { conflitosNovos, type Ocupacao } from '@/domain/conflitos'

export type HorarioVigente = Ocupacao & {
  id: string
  vinculoId: string
  alunoNome: string
  profissionalNome: string
  areaNome: string
  semanas: number
  semanasNoCiclo: number
  cicloInicio: Date | null
}

// Todos os horários que valem hoje (vínculo aberto, horário não excluído, aluno fora da lixeira),
// cada um com o ciclo de semanas do seu profissional.
export async function horariosVigentes(): Promise<HorarioVigente[]> {
  const duracoes = await carregarDuracoes()
  const vagas = await carregarVagas()
  const vinculos = await prisma.vinculo.findMany({
    where: { fim: null, aluno: { excluidoEm: null, deFora: false } },
    select: {
      id: true,
      alunoId: true,
      profissionalId: true,
      aluno: { select: { nome: true } },
      profissional: { select: { nome: true, semanasNoCiclo: true, cicloInicio: true } },
      area: { select: { nome: true } },
      horarios: { where: { excluidoEm: null } },
    },
  })
  return vinculos.flatMap((v) =>
    v.horarios.map((h) => ({
      id: h.id,
      vinculoId: v.id,
      alunoNome: v.aluno.nome,
      profissionalNome: v.profissional.nome,
      areaNome: v.area.nome,
      profissionalId: v.profissionalId,
      alunoId: v.alunoId,
      diaSemana: h.diaSemana,
      hora: h.hora,
      semanas: h.semanas,
      semanasNoCiclo: v.profissional.semanasNoCiclo,
      cicloInicio: v.profissional.cicloInicio,
      duracaoMin: duracaoEfetiva(duracoes, v.profissionalId, h.diaSemana, h.hora, h.duracaoMin),
      vagas: vagasEfetivas(vagas, v.profissionalId, h.diaSemana, h.hora),
    })),
  )
}

const DIAS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta']

// Frase pronta pra tela: explica qual batida a mudança criaria.
export function descreverConflitoNovo(p: {
  a: HorarioVigente
  b: HorarioVigente
  motivo: 'ALUNO' | 'PROFISSIONAL'
}): string {
  const quando = `${DIAS[p.a.diaSemana]} às ${p.a.hora}`
  // Horário individual (1 vaga): a mensagem de sempre. Horário de grupo: fala das vagas.
  const emGrupo = Math.max(p.a.vagas ?? 1, p.b.vagas ?? 1) > 1
  if (p.motivo === 'ALUNO') {
    return `${p.a.alunoNome} ficaria em dois atendimentos ao mesmo tempo (${quando}: ${p.a.profissionalNome} e ${p.b.profissionalNome})`
  }
  return emGrupo
    ? `${p.a.profissionalNome} ficaria com mais alunos do que as vagas do horário (${quando})`
    : `${p.a.profissionalNome} ficaria com dois alunos no mesmo horário e semana (${quando})`
}

// Toda rota que grava horário passa por aqui: devolve a frase do primeiro choque NOVO que a
// mudança criaria, ou null se pode gravar. Choques que já existiam não travam.
export function conflitoDaMudanca(antes: HorarioVigente[], depois: HorarioVigente[]): string | null {
  const novos = conflitosNovos(antes, depois)
  return novos.length > 0 ? descreverConflitoNovo(novos[0]) : null
}
