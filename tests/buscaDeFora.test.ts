import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
    vinculo: { findMany: vi.fn() },
    atendimento: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))

import { buscar } from '@/lib/busca'

describe('buscar — pessoas de fora do centro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$queryRaw.mockRejectedValue(new Error('sem unaccent'))
    prismaMock.aluno.findMany.mockResolvedValue([])
    prismaMock.usuario.findMany.mockResolvedValue([])
    prismaMock.vinculo.findMany.mockResolvedValue([])
    prismaMock.atendimento.findMany.mockResolvedValue([])
  })

  it('a consulta de alunos exclui deFora (e continua excluindo lixeira e desligados)', async () => {
    await buscar({ id: 'a1', perfil: 'ADMIN' }, 'maria')
    const where = (prismaMock.aluno.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where
    expect(where).toMatchObject({ excluidoEm: null, deFora: false, situacao: { not: 'DESLIGADO' } })
  })
})
