import { describe, it, expect } from 'vitest'
import { diasDeFaltaSeguidos, situacaoDasFaltas, FALTAS_PARA_AVISO } from '@/domain/faltas'

// Atendimentos ficam ao meio-dia (UTC) do dia, como no sistema.
const f = (situacao: string, dia: number, hora = 12) => ({ situacao, data: new Date(Date.UTC(2026, 8, dia, hora)) })
const dia = (d: number) => new Date(Date.UTC(2026, 8, d, 12))

describe('diasDeFaltaSeguidos', () => {
  it('conta os dias de falta seguidos no fim da linha do tempo', () => {
    const r = diasDeFaltaSeguidos([f('REALIZADO', 1), f('FALTOU', 8), f('FALTOU', 15)])
    expect(r.dias).toBe(2)
    expect(r.ultimaFalta?.toISOString().slice(0, 10)).toBe('2026-09-15')
    // Os dias da sequência, do mais recente para trás (o Painel mostra "Faltou em").
    expect(r.diasDaSequencia).toEqual(['2026-09-15', '2026-09-08'])
  })
  it('independe da ordem em que os itens chegam', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 15), f('REALIZADO', 1), f('FALTOU', 8)]).dias).toBe(2)
  })
  it('dois atendimentos faltados no mesmo dia valem um dia só', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 8, 9), f('FALTOU', 8, 14)]).dias).toBe(1)
  })
  it('REALIZADO no fim zera a conta', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 1), f('FALTOU', 8), f('REALIZADO', 15)]).dias).toBe(0)
  })
  it('REALIZADO no meio quebra a sequência', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 1), f('REALIZADO', 8), f('FALTOU', 15)]).dias).toBe(1)
  })
  it('um dia com falta e realizado não conta como falta', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 1), f('FALTOU', 8, 9), f('REALIZADO', 8, 14)]).dias).toBe(0)
  })
  it('falta justificada quebra a sequência', () => {
    expect(diasDeFaltaSeguidos([f('FALTOU', 1), f('JUSTIFICOU', 8), f('FALTOU', 15)]).dias).toBe(1)
    expect(diasDeFaltaSeguidos([f('FALTOU', 1), f('FALTOU', 8), f('JUSTIFICOU', 15)]).dias).toBe(0)
  })
  it('AGENDADO e CANCELADO não contam nem quebram', () => {
    expect(
      diasDeFaltaSeguidos([f('FALTOU', 1), f('CANCELADO', 8), f('FALTOU', 15), f('AGENDADO', 22)]).dias,
    ).toBe(2)
    expect(diasDeFaltaSeguidos([f('AGENDADO', 1), f('CANCELADO', 8)])).toEqual({ dias: 0, ultimaFalta: null, diasDaSequencia: [] })
  })
  it('sem itens: zero dias e sem última falta', () => {
    expect(diasDeFaltaSeguidos([])).toEqual({ dias: 0, ultimaFalta: null, diasDaSequencia: [] })
  })
  it('desde: só conta dias estritamente depois dele', () => {
    const itens = [f('FALTOU', 1), f('FALTOU', 8), f('FALTOU', 15)]
    expect(diasDeFaltaSeguidos(itens, dia(8)).dias).toBe(1)
    expect(diasDeFaltaSeguidos(itens, dia(1)).dias).toBe(2)
    expect(diasDeFaltaSeguidos(itens, dia(15))).toEqual({ dias: 0, ultimaFalta: null, diasDaSequencia: [] })
    expect(diasDeFaltaSeguidos(itens, null).dias).toBe(3)
  })
})

describe('situacaoDasFaltas', () => {
  const duas = [f('REALIZADO', 1), f('FALTOU', 8), f('FALTOU', 15)]

  it('o aviso começa com duas faltas', () => {
    expect(FALTAS_PARA_AVISO).toBe(2)
    expect(situacaoDasFaltas(duas)).toBe('AVISO')
    expect(situacaoDasFaltas(duas, null)).toBe('AVISO')
  })
  it('uma falta só ou nenhuma: sem aviso', () => {
    expect(situacaoDasFaltas([f('REALIZADO', 1), f('FALTOU', 8)])).toBeNull()
    expect(situacaoDasFaltas([])).toBeNull()
  })
  it('depois da providência a sequência já tratada fica como PROVIDENCIA', () => {
    expect(situacaoDasFaltas(duas, dia(15))).toBe('PROVIDENCIA')
  })
  it('depois da providência, uma falta nova ainda é PROVIDENCIA; duas faltas novas voltam o AVISO', () => {
    expect(situacaoDasFaltas([...duas, f('FALTOU', 22)], dia(15))).toBe('PROVIDENCIA')
    expect(situacaoDasFaltas([...duas, f('FALTOU', 22), f('FALTOU', 29)], dia(15))).toBe('AVISO')
  })
  it('se a criança voltou depois da providência, o aviso e o selo somem', () => {
    expect(situacaoDasFaltas([...duas, f('REALIZADO', 22)], dia(15))).toBeNull()
  })
  it('providência de um aluno que não está mais com faltas seguidas: null', () => {
    expect(situacaoDasFaltas([f('FALTOU', 8), f('REALIZADO', 15)], dia(8))).toBeNull()
  })
})
