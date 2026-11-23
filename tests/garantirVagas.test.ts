import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    slotProfissional: { findMany: vi.fn(), createMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))

import { garantirVagas } from '@/lib/slots'

const grade = [
  { diaSemana: 1, hora: '08:00', duracaoMin: 40 },
  { diaSemana: 2, hora: '08:50', duracaoMin: 40 },
]

describe('garantirVagas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não baixa nem repete: pedir menos ou igual ao que já tem não grava nada', async () => {
    await garantirVagas('p1', [{ ...grade[1], vagas: 3 }], 2, '08:50', 3)
    await garantirVagas('p1', [{ ...grade[1], vagas: 3 }], 2, '08:50', 2)
    expect(prismaMock.slotProfissional.findMany).not.toHaveBeenCalled()
  })

  it('quem usa a grade padrão (nada salvo): grava a grade inteira, só este horário com as vagas novas', async () => {
    prismaMock.slotProfissional.findMany.mockResolvedValue([])
    await garantirVagas('p1', grade, 2, '08:50', 2)
    expect(prismaMock.slotProfissional.createMany).toHaveBeenCalledWith({
      data: [
        { profissionalId: 'p1', diaSemana: 1, hora: '08:00', duracaoMin: 40, vagas: 1 },
        { profissionalId: 'p1', diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 2 },
      ],
    })
  })

  it('horário já salvo: só atualiza as vagas dele', async () => {
    prismaMock.slotProfissional.findMany.mockResolvedValue([{ id: 's1', diaSemana: 1, hora: '08:00' }, { id: 's2', diaSemana: 2, hora: '08:50' }])
    await garantirVagas('p1', grade, 2, '08:50', 4)
    expect(prismaMock.slotProfissional.update).toHaveBeenCalledWith({ where: { id: 's2' }, data: { vagas: 4 } })
    expect(prismaMock.slotProfissional.createMany).not.toHaveBeenCalled()
  })

  it('há horários salvos mas este não (veio de um atendimento antigo): cria só este', async () => {
    prismaMock.slotProfissional.findMany.mockResolvedValue([{ id: 's1', diaSemana: 1, hora: '08:00' }])
    await garantirVagas('p1', grade, 2, '08:50', 2)
    expect(prismaMock.slotProfissional.create).toHaveBeenCalledWith({
      data: { profissionalId: 'p1', diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 2 },
    })
  })
})
