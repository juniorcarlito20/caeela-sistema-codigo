import { describe, it, expect } from 'vitest'
import { agruparPorProfissional } from '@/domain/lembrete'

const l = (profissionalId: string, profissional: string, hora: string, area = 'Área X') => ({
  profissionalId, profissional, area, hora,
})

describe('agruparPorProfissional', () => {
  it('lista vazia devolve nenhum grupo', () => {
    expect(agruparPorProfissional([])).toEqual([])
  })

  it('junta as linhas de cada profissional, por hora', () => {
    const grupos = agruparPorProfissional([
      l('p1', 'Profissional Teste A', '10:00'),
      l('p2', 'Profissional Teste B', '08:00'),
      l('p1', 'Profissional Teste A', '09:00'),
    ])
    expect(grupos).toHaveLength(2)
    const a = grupos.find((g) => g.profissionalId === 'p1')!
    expect(a.linhas.map((x) => x.hora)).toEqual(['09:00', '10:00'])
    expect(a.profissional).toBe('Profissional Teste A')
    expect(a.area).toBe('Área X')
  })

  it('ordena os grupos pelo primeiro horário do dia', () => {
    const grupos = agruparPorProfissional([
      l('p1', 'Profissional Teste A', '09:00'),
      l('p2', 'Profissional Teste B', '08:00'),
      l('p1', 'Profissional Teste A', '07:00'),
    ])
    expect(grupos.map((g) => g.profissionalId)).toEqual(['p1', 'p2'])
  })

  it('empate no primeiro horário: ordem pelo nome', () => {
    const grupos = agruparPorProfissional([
      l('p2', 'Profissional Teste B', '08:00'),
      l('p1', 'Profissional Teste A', '08:00'),
    ])
    expect(grupos.map((g) => g.profissional)).toEqual(['Profissional Teste A', 'Profissional Teste B'])
  })
})
