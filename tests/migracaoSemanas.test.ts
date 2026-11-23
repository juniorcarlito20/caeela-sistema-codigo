// tests/migracaoSemanas.test.ts
import { describe, it, expect } from 'vitest'
import {
  semanaAtivaAntiga, cicloDoProfissional, semanasDoHorarioAntigo, datasIguais, alunosNaMesmaSemana,
} from '@/domain/migracaoSemanas'

const SEG_28_09 = new Date(2026, 8, 28)
const SEG_05_10 = new Date(2026, 9, 5)

describe('semanaAtivaAntiga (cópia fiel do comportamento antigo)', () => {
  it('quinzenal offset 1 ativo na semana seguinte à referência', () => {
    const r = { cicloSemanas: 2, cicloOffset: 1, semanaReferencia: SEG_28_09 }
    expect(semanaAtivaAntiga(r, SEG_28_09)).toBe(false)
    expect(semanaAtivaAntiga(r, SEG_05_10)).toBe(true)
  })
  it('rodízio sem referência contava como sempre ativo', () => {
    expect(semanaAtivaAntiga({ cicloSemanas: 2, cicloOffset: 1, semanaReferencia: null }, SEG_28_09)).toBe(true)
  })
})

describe('cicloDoProfissional', () => {
  it('só semanal: 1 semana, sem início', () => {
    expect(cicloDoProfissional([{ cicloSemanas: 1, cicloOffset: 0, semanaReferencia: null }]))
      .toEqual({ semanasNoCiclo: 1, cicloInicio: null })
  })
  it('quinzenal: 2 semanas, começando na referência', () => {
    expect(cicloDoProfissional([
      { cicloSemanas: 1, cicloOffset: 0, semanaReferencia: null },
      { cicloSemanas: 2, cicloOffset: 1, semanaReferencia: SEG_28_09 },
    ])).toEqual({ semanasNoCiclo: 2, cicloInicio: SEG_28_09 })
  })
  it('com mensal: 4 semanas, começando na referência mais antiga', () => {
    const c = cicloDoProfissional([
      { cicloSemanas: 2, cicloOffset: 0, semanaReferencia: SEG_05_10 },
      { cicloSemanas: 4, cicloOffset: 2, semanaReferencia: SEG_28_09 },
    ])
    expect(c).toEqual({ semanasNoCiclo: 4, cicloInicio: SEG_28_09 })
  })
  it('ciclo de 3 semanas não tem como converter', () => {
    expect(cicloDoProfissional([{ cicloSemanas: 3, cicloOffset: 0, semanaReferencia: SEG_28_09 }]))
      .toEqual({ erro: 'ciclo de 3 semanas' })
  })
})

describe('semanasDoHorarioAntigo', () => {
  const ciclo4 = { semanasNoCiclo: 4, cicloInicio: SEG_28_09 }
  const ciclo2 = { semanasNoCiclo: 2, cicloInicio: SEG_28_09 }
  it('semanal vira todas as semanas', () => {
    expect(semanasDoHorarioAntigo({ cicloSemanas: 1, cicloOffset: 0, semanaReferencia: null }, ciclo4)).toBe(0b1111)
  })
  it('quinzenal em profissional de 2 semanas', () => {
    expect(semanasDoHorarioAntigo({ cicloSemanas: 2, cicloOffset: 1, semanaReferencia: SEG_28_09 }, ciclo2)).toBe(0b10)
  })
  it('quinzenal em profissional de 4 semanas ocupa duas alternadas', () => {
    expect(semanasDoHorarioAntigo({ cicloSemanas: 2, cicloOffset: 0, semanaReferencia: SEG_28_09 }, ciclo4)).toBe(0b0101)
  })
  it('mensal ocupa uma', () => {
    expect(semanasDoHorarioAntigo({ cicloSemanas: 4, cicloOffset: 2, semanaReferencia: SEG_28_09 }, ciclo4)).toBe(0b0100)
  })
  it('referência diferente da do profissional: reposiciona mantendo as datas', () => {
    // referência uma semana depois do início: o "offset 0" dele cai na Semana 2 do profissional
    expect(semanasDoHorarioAntigo({ cicloSemanas: 4, cicloOffset: 0, semanaReferencia: SEG_05_10 }, ciclo4)).toBe(0b0010)
  })
  it('rodízio sem referência vira todas as semanas (era sempre ativo)', () => {
    expect(semanasDoHorarioAntigo({ cicloSemanas: 2, cicloOffset: 1, semanaReferencia: null }, ciclo4)).toBe(0b1111)
  })
})

describe('datasIguais — a prova antes de gravar', () => {
  it('todas as combinações antigas convertidas dão as mesmas datas por 13 semanas', () => {
    const ciclo = { semanasNoCiclo: 4, cicloInicio: SEG_28_09 }
    for (const ref of [SEG_28_09, SEG_05_10, new Date(2026, 7, 3)]) {
      for (const [c, o] of [[1, 0], [2, 0], [2, 1], [4, 0], [4, 1], [4, 2], [4, 3]]) {
        const antigo = { cicloSemanas: c, cicloOffset: o, semanaReferencia: ref }
        const novo = { ...ciclo, semanas: semanasDoHorarioAntigo(antigo, ciclo) }
        expect(datasIguais(antigo, novo, new Date(2026, 9, 8))).toBe(true)
      }
    }
  })
  it('acusa diferença quando a máscara está errada', () => {
    const antigo = { cicloSemanas: 2, cicloOffset: 0, semanaReferencia: SEG_28_09 }
    expect(datasIguais(antigo, { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: 0b10 }, SEG_28_09)).toBe(false)
  })
})

describe('alunosNaMesmaSemana', () => {
  const r = (semanas: number) => ({ semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas })
  it('acha dois alunos do mesmo profissional no mesmo horário e semana', () => {
    const lista = [
      { id: 'h1', profissionalId: 'p1', diaSemana: 2, hora: '08:00', ritmo: r(0b01) },
      { id: 'h2', profissionalId: 'p1', diaSemana: 2, hora: '08:00', ritmo: r(0b11) },
      { id: 'h3', profissionalId: 'p1', diaSemana: 3, hora: '08:00', ritmo: r(0b01) },
    ]
    expect(alunosNaMesmaSemana(lista).map(([a, b]) => [a.id, b.id])).toEqual([['h1', 'h2']])
  })
  it('semanas alternadas no mesmo horário não contam', () => {
    const lista = [
      { id: 'h1', profissionalId: 'p1', diaSemana: 2, hora: '08:00', ritmo: r(0b01) },
      { id: 'h2', profissionalId: 'p1', diaSemana: 2, hora: '08:00', ritmo: r(0b10) },
    ]
    expect(alunosNaMesmaSemana(lista)).toEqual([])
  })
})
