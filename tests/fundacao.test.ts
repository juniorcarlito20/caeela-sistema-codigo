import { describe, it, expect } from 'vitest'

describe('fundação', () => {
  it('resolve o alias @ e roda TypeScript', async () => {
    // Usa um módulo de domínio puro, sem dependência do runtime do Next.js
    // (@/app/page hoje importa autenticação, que só resolve dentro do Next).
    const mod = await import('@/domain/matricula')
    expect(typeof mod.proximaMatricula).toBe('function')
  })
})
