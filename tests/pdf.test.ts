import { describe, it, expect } from 'vitest'
import { resumoDoPeriodo, percentualPresenca } from '@/domain/presenca'

const atendimentos = [
  { situacao: 'REALIZADO' }, { situacao: 'REALIZADO' },
  { situacao: 'FALTOU' }, { situacao: 'JUSTIFICOU' }, { situacao: 'AGENDADO' },
] as const

describe('resumo do período', () => {
  it('conta cada situação e ignora os agendados', () => {
    expect(resumoDoPeriodo([...atendimentos])).toEqual({
      total: 4, realizados: 2, faltas: 1, justificadas: 1, cancelados: 0,
    })
  })
  it('lista vazia devolve tudo zerado', () => {
    expect(resumoDoPeriodo([])).toEqual({
      total: 0, realizados: 0, faltas: 0, justificadas: 0, cancelados: 0,
    })
  })
  it('só agendados devolve tudo zerado', () => {
    expect(resumoDoPeriodo([{ situacao: 'AGENDADO' }, { situacao: 'AGENDADO' }])).toEqual({
      total: 0, realizados: 0, faltas: 0, justificadas: 0, cancelados: 0,
    })
  })
  it('cancelado pelo centro conta à parte e não entra no total', () => {
    expect(
      resumoDoPeriodo([{ situacao: 'REALIZADO' }, { situacao: 'CANCELADO' }]),
    ).toEqual({ total: 1, realizados: 1, faltas: 0, justificadas: 0, cancelados: 1 })
  })
})

describe('percentual de presença', () => {
  it('divide realizados pelo total e arredonda', () => {
    expect(percentualPresenca([...atendimentos])).toBe(50)
  })
  it('devolve 0 quando não há nada para contar', () => {
    expect(percentualPresenca([])).toBe(0)
    expect(percentualPresenca([{ situacao: 'AGENDADO' }])).toBe(0)
  })
})
