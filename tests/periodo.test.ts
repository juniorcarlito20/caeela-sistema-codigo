import { describe, it, expect } from 'vitest'
import { textoPeriodo } from '@/domain/presenca'

describe('texto do período', () => {
  it('mesmo mês escreve o mês por extenso', () => {
    expect(textoPeriodo(new Date(2026, 8, 3), new Date(2026, 8, 28))).toBe('setembro de 2026')
  })
  it('mesmo ano escreve de um mês ao outro', () => {
    expect(textoPeriodo(new Date(2026, 2, 5), new Date(2026, 8, 20))).toBe(
      'de março a setembro de 2026',
    )
  })
  it('anos diferentes mantêm o ano dos dois lados', () => {
    expect(textoPeriodo(new Date(2025, 10, 3), new Date(2026, 1, 10))).toBe(
      'de 11/2025 a 02/2026',
    )
  })
})
