import { describe, it, expect } from 'vitest'
import { AREAS_PADRAO } from '@/db/seed'

describe('seed', () => {
  it('traz as áreas reais do centro', () => {
    expect(AREAS_PADRAO).toContain('Psicologia')
    expect(AREAS_PADRAO).toContain('Psicopedagogia AEE')
    expect(AREAS_PADRAO).toContain('Fonoaudiologia')
    expect(AREAS_PADRAO).toContain('Fisioterapia')
    expect(AREAS_PADRAO).toContain('Nutrição')
    expect(AREAS_PADRAO.length).toBeGreaterThanOrEqual(10)
  })
})
