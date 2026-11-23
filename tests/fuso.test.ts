import { describe, it, expect } from 'vitest'
import { formatarDataHora, formatarHora, hojeNoFuso, hojeDoCentro } from '@/lib/fuso'

describe('fuso do centro (Bahia, UTC-3)', () => {
  const meiaNoite = new Date('2026-10-07T03:00:21Z') // hora que o backup roda no servidor

  it('03:00 do servidor é meia-noite em Licínio de Almeida', () => {
    expect(formatarHora(meiaNoite)).toBe('00:00')
  })
  it('data e hora saem no fuso do centro', () => {
    expect(formatarDataHora(meiaNoite)).toBe('07/10/2026, 00:00:21')
  })
  it('hoje no fuso ainda é o dia anterior até 03:00 do servidor', () => {
    expect(hojeNoFuso(new Date('2026-10-07T02:59:00Z'))).toBe('2026-10-06')
    expect(hojeNoFuso(meiaNoite)).toBe('2026-10-07')
  })
  it('hojeDoCentro: depois das 21h o dia do centro ainda é o de hoje', () => {
    const dezDaNoite = new Date('2026-10-10T01:30:00Z') // 22:30 de 09/10 em Licínio de Almeida
    const d = hojeDoCentro(dezDaNoite)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 10, 9, 12])
  })
})
