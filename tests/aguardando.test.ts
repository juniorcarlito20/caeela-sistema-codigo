import { describe, it, expect } from 'vitest'
import { semVazioRepetido } from '@/domain/aguardando'

const v = (id: string, alunoId: string, horarios: number) => ({ id, alunoId, horarios: Array.from({ length: horarios }) })

describe('semVazioRepetido', () => {
  it('atendimento vazio de quem já tem horário com o profissional não aparece', () => {
    const lista = [v('v1', 'A', 1), v('v2', 'A', 0)]
    expect(semVazioRepetido(lista, (x) => x.alunoId).map((x) => x.id)).toEqual(['v1'])
  })
  it('quem só tem atendimento vazio continua aparecendo (aguardando horário)', () => {
    const lista = [v('v1', 'A', 1), v('v2', 'B', 0)]
    expect(semVazioRepetido(lista, (x) => x.alunoId).map((x) => x.id)).toEqual(['v1', 'v2'])
  })
  it('dois vazios do mesmo aluno aparecem uma vez só', () => {
    const lista = [v('v1', 'B', 0), v('v2', 'B', 0)]
    expect(semVazioRepetido(lista, (x) => x.alunoId).map((x) => x.id)).toEqual(['v1'])
  })
  it('atendimentos com horário nunca somem', () => {
    const lista = [v('v1', 'A', 1), v('v2', 'A', 2)]
    expect(semVazioRepetido(lista, (x) => x.alunoId).map((x) => x.id)).toEqual(['v1', 'v2'])
  })
})
