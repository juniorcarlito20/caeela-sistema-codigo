import { describe, it, expect } from 'vitest'
import { DIAS_PARA_LANCAR, podeLancarNoDia, lancadoDepois, textoLancadoDepois } from '@/domain/presenca'

describe('podeLancarNoDia', () => {
  const hoje = '2026-11-03'
  it('o limite é de 30 dias', () => expect(DIAS_PARA_LANCAR).toBe(30))
  it('hoje pode', () => expect(podeLancarNoDia('PROFISSIONAL', hoje, hoje)).toBe(true))
  it('30 dias atrás pode', () => expect(podeLancarNoDia('PROFISSIONAL', '2026-10-04', hoje)).toBe(true))
  it('31 dias atrás não pode', () => {
    expect(podeLancarNoDia('PROFISSIONAL', '2026-10-03', hoje)).toBe(false)
    expect(podeLancarNoDia('SECRETARIA', '2026-10-03', hoje)).toBe(false)
  })
  it('a direção sempre pode', () => expect(podeLancarNoDia('ADMIN', '2020-01-01', hoje)).toBe(true))
  it('data futura passa', () => expect(podeLancarNoDia('SECRETARIA', '2026-11-04', hoje)).toBe(true))
  it('atravessa virada de ano', () => {
    expect(podeLancarNoDia('PROFISSIONAL', '2025-12-02', '2026-01-01')).toBe(true)
    expect(podeLancarNoDia('PROFISSIONAL', '2025-12-01', '2026-01-01')).toBe(false)
  })
})

describe('lancadoDepois', () => {
  it('mesmo dia: nada', () => {
    expect(lancadoDepois('2026-11-03', new Date('2026-11-03T15:00:00Z'))).toBeNull()
  })
  it('sem registro: nada', () => expect(lancadoDepois('2026-11-03', null)).toBeNull())
  it('dia seguinte: texto', () => {
    expect(lancadoDepois('2026-11-03', new Date('2026-11-04T15:00:00Z'))).toBe('Lançado em 04/11')
    expect(textoLancadoDepois('2026-11-03', new Date('2026-11-04T15:00:00Z'))).toBe(
      'Lançado em 04/11 (referente a 03/11)',
    )
  })
  it('usa o fuso do centro: 01h UTC do dia 4 ainda é dia 3 na Bahia', () => {
    expect(lancadoDepois('2026-11-03', new Date('2026-11-04T01:00:00Z'))).toBeNull()
    expect(lancadoDepois('2026-11-03', new Date('2026-11-04T03:30:00Z'))).toBe('Lançado em 04/11')
  })
})
