import { describe, it, expect, vi } from 'vitest'

vi.mock('@/db/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/slots', () => ({ carregarDuracoes: vi.fn(), duracaoEfetiva: vi.fn(), carregarVagas: vi.fn(), vagasEfetivas: vi.fn() }))

import { descreverConflitoNovo, type HorarioVigente } from '@/lib/agendaVigente'

const h = (id: string, vagas?: number): HorarioVigente => ({
  id, vinculoId: `v-${id}`, alunoNome: `Aluno ${id}`, profissionalNome: 'Profissional Teste', areaNome: 'Terapia Ocupacional',
  profissionalId: 'p1', alunoId: `al-${id}`, diaSemana: 2, hora: '08:50', semanas: 1, semanasNoCiclo: 1, cicloInicio: null, duracaoMin: 40,
  ...(vagas === undefined ? {} : { vagas }),
})

describe('descreverConflitoNovo (texto do choque de profissional)', () => {
  it('horário individual: a mensagem de sempre, sem falar de vagas', () => {
    expect(descreverConflitoNovo({ a: h('1'), b: h('2'), motivo: 'PROFISSIONAL' }))
      .toBe('Profissional Teste ficaria com dois alunos no mesmo horário e semana (terça às 08:50)')
    expect(descreverConflitoNovo({ a: h('1', 1), b: h('2', 1), motivo: 'PROFISSIONAL' })).not.toContain('vagas')
  })
  it('horário de grupo: fala das vagas', () => {
    expect(descreverConflitoNovo({ a: h('1', 2), b: h('2', 2), motivo: 'PROFISSIONAL' }))
      .toBe('Profissional Teste ficaria com mais alunos do que as vagas do horário (terça às 08:50)')
  })
  it('a criança em dois lugares continua com o texto de sempre', () => {
    expect(descreverConflitoNovo({ a: h('1'), b: h('2'), motivo: 'ALUNO' })).toContain('ficaria em dois atendimentos ao mesmo tempo')
  })
})
