import { describe, it, expect } from 'vitest'
import { podeVerRegistroClinico } from '@/domain/transferencia'

const admin = { id: 'a1', perfil: 'ADMIN' as const }
const autora = { id: 'p1', perfil: 'PROFISSIONAL' as const }
const nova = { id: 'p2', perfil: 'PROFISSIONAL' as const }
const outra = { id: 'p3', perfil: 'PROFISSIONAL' as const }

const registro = { autorId: 'p1', criadoEm: new Date('2026-09-10T12:00:00') }
const transferencia = [{ paraProfissionalId: 'p2', criadoEm: new Date('2026-09-15T12:00:00') }]

describe('registro clínico com transferência', () => {
  it('autora vê o que escreveu', () => {
    expect(podeVerRegistroClinico(autora, registro, [])).toBe(true)
  })
  it('admin vê tudo', () => {
    expect(podeVerRegistroClinico(admin, registro, [])).toBe(true)
  })
  it('sem transferência, colega não vê', () => {
    expect(podeVerRegistroClinico(nova, registro, [])).toBe(false)
  })
  it('transferência posterior ao registro libera para a nova', () => {
    expect(podeVerRegistroClinico(nova, registro, transferencia)).toBe(true)
  })
  it('transferência anterior ao registro não libera', () => {
    const depois = { autorId: 'p1', criadoEm: new Date('2026-09-20T12:00:00') }
    expect(podeVerRegistroClinico(nova, depois, transferencia)).toBe(false)
  })
  it('transferência para outra pessoa não libera', () => {
    expect(podeVerRegistroClinico(outra, registro, transferencia)).toBe(false)
  })
})
