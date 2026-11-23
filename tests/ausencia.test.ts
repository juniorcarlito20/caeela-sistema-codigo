import { describe, it, expect } from 'vitest'
import { diasDaAusencia, contaComoFaltaDoAluno, resumoFrequencia, ausenciaCancela } from '@/domain/ausencia'

describe('ausência do profissional', () => {
  it('lista os dias entre início e fim, inclusive', () => {
    const dias = diasDaAusencia(new Date(2026, 8, 21), new Date(2026, 8, 23))
    expect(dias).toHaveLength(3)
  })
  it('ausência de um dia só devolve esse dia', () => {
    expect(diasDaAusencia(new Date(2026, 8, 21), new Date(2026, 8, 21))).toHaveLength(1)
  })
  it('atendimento cancelado por ausência não conta como falta do aluno', () => {
    expect(contaComoFaltaDoAluno('CANCELADO')).toBe(false)
    expect(contaComoFaltaDoAluno('FALTOU')).toBe(true)
    expect(contaComoFaltaDoAluno('JUSTIFICOU')).toBe(false)
  })
  it('resume a frequência do mês separando justificada de não justificada', () => {
    const r = resumoFrequencia(
      [{ tipo: 'ATESTADO', dias: 2 }, { tipo: 'FALTA', dias: 1 }], 20)
    expect(r).toEqual({ previstos: 20, ausentes: 3, justificados: 2,
                        naoJustificados: 1, percentual: 85 })
  })
  it('fim antes do início devolve lista vazia', () => {
    expect(diasDaAusencia(new Date(2026, 8, 23), new Date(2026, 8, 21))).toEqual([])
  })
  it('sem ausência o percentual é 100', () => {
    expect(resumoFrequencia([], 20)).toEqual({
      previstos: 20, ausentes: 0, justificados: 0, naoJustificados: 0, percentual: 100,
    })
  })
  it('ausência só cancela o que estava agendado: falta, justificativa e presença ficam', () => {
    expect(ausenciaCancela('AGENDADO')).toBe(true)
    expect(ausenciaCancela('FALTOU')).toBe(false)
    expect(ausenciaCancela('JUSTIFICOU')).toBe(false)
    expect(ausenciaCancela('REALIZADO')).toBe(false)
    expect(ausenciaCancela('CANCELADO')).toBe(false)
  })
})
