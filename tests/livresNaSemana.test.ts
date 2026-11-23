import { describe, it, expect } from 'vitest'
import { livresNaSemana, totalDeVagasNaSemana } from '@/components/GradeSemanal'

const slots = [
  { diaSemana: 1, hora: '08:00', duracaoMin: 40 },
  { diaSemana: 1, hora: '08:40', duracaoMin: 40, vagas: 10 },
  { diaSemana: 2, hora: '08:00', duracaoMin: 40 },
]
const criancas = (n: number) => Array.from({ length: n }, (_, i) => ({ nome: `Aluno ${i}`, rotulo: '' }))

describe('horários livres do profissional', () => {
  it('cada horário conta uma vaga só, mesmo que tenha vagas guardadas de um grupo antigo', () => {
    expect(totalDeVagasNaSemana(slots)).toBe(3)
  })
  it('um horário com um grupo de crianças ocupa um horário só', () => {
    const ocupados = new Map([['1-08:40', criancas(10)], ['2-08:00', criancas(1)]])
    expect(livresNaSemana(slots, ocupados)).toBe(1)
  })
  it('grupo que se desfez (vagas sobrando) não vira horário livre a mais', () => {
    const ocupados = new Map([['1-08:40', criancas(1)]])
    expect(livresNaSemana(slots, ocupados)).toBe(2)
  })
  it('desconta os horários indisponíveis e nunca fica negativo', () => {
    expect(livresNaSemana(slots, new Map(), 1)).toBe(2)
    expect(livresNaSemana(slots, new Map(), 9)).toBe(0)
  })
})
