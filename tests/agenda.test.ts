import { describe, it, expect } from 'vitest'
import { gerarSemana, segundaDaSemana } from '@/domain/agenda'

const horarios = [
  { vinculoId: 'v1', diaSemana: 1, hora: '07:30', vigenteAte: null },
  { vinculoId: 'v2', diaSemana: 3, hora: '09:30', vigenteAte: new Date('2026-01-01') },
]

describe('agenda', () => {
  it('projeta os horários fixos na semana pedida', () => {
    const semana = gerarSemana(horarios, new Date('2026-09-21')) // segunda
    expect(semana).toHaveLength(1)
    expect(semana[0].data.toISOString().slice(0, 10)).toBe('2026-09-21')
    expect(semana[0].hora).toBe('07:30')
  })
  it('ignora horário cuja vigência terminou', () => {
    const semana = gerarSemana(horarios, new Date('2026-09-21'))
    expect(semana.find((s) => s.vinculoId === 'v2')).toBeUndefined()
  })
  it('ignora horário de vínculo já encerrado', () => {
    const comFim = [
      ...horarios,
      { vinculoId: 'v3', diaSemana: 2, hora: '08:50', vigenteAte: null, vinculoFim: new Date('2026-09-10') },
    ]
    const semana = gerarSemana(comFim, new Date('2026-09-21'))
    expect(semana.find((s) => s.vinculoId === 'v3')).toBeUndefined()
    expect(semana.find((s) => s.vinculoId === 'v1')).toBeDefined()
  })
  it('devolve os dias na ordem de segunda a sexta', () => {
    const foraDeOrdem = [
      { vinculoId: 'v5', diaSemana: 5, hora: '07:30', vigenteAte: null },
      { vinculoId: 'v1', diaSemana: 1, hora: '10:10', vigenteAte: null },
      { vinculoId: 'v3', diaSemana: 3, hora: '08:50', vigenteAte: null },
    ]
    const semana = gerarSemana(foraDeOrdem, new Date('2026-09-21'))
    expect(semana.map((s) => s.data.toISOString().slice(0, 10))).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-25',
    ])
  })
})

describe('agenda em semanas', () => {
  const SEMANA1 = new Date(2026, 8, 21) // segunda da Semana 1
  it('horário de profissional de 1 semana aparece toda semana (não regressão)', () => {
    const semanal = [{ vinculoId: 'v1', diaSemana: 2, hora: '08:50', vigenteAte: null }]
    expect(gerarSemana(semanal, SEMANA1)).toHaveLength(1)
    expect(gerarSemana(semanal, new Date(2026, 8, 28))).toHaveLength(1)
  })
  it('quinzenal aparece só nas semanas marcadas', () => {
    const ciclo = { semanasNoCiclo: 2, cicloInicio: SEMANA1 }
    const quinzenal = [
      { vinculoId: 'g1', diaSemana: 2, hora: '08:50', vigenteAte: null, semanas: 0b01, ...ciclo },
      { vinculoId: 'g2', diaSemana: 2, hora: '08:50', vigenteAte: null, semanas: 0b10, ...ciclo },
    ]
    expect(gerarSemana(quinzenal, SEMANA1).map((s) => s.vinculoId)).toEqual(['g1'])
    expect(gerarSemana(quinzenal, new Date(2026, 8, 28)).map((s) => s.vinculoId)).toEqual(['g2'])
    expect(gerarSemana(quinzenal, new Date(2026, 9, 5)).map((s) => s.vinculoId)).toEqual(['g1'])
  })
})

describe('segunda da semana', () => {
  const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  it('acha a segunda a partir de qualquer dia', () => {
    expect(isoLocal(segundaDaSemana(new Date(2026, 8, 23)))).toBe('2026-09-21') // quarta
    expect(isoLocal(segundaDaSemana(new Date(2026, 8, 27)))).toBe('2026-09-21') // domingo
    expect(isoLocal(segundaDaSemana(new Date(2026, 8, 21)))).toBe('2026-09-21') // a própria segunda
  })
})
