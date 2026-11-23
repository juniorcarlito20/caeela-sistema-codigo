import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: { horario: { findFirst: vi.fn(), update: vi.fn() } },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: registrarMock,
  quando: (d: number, h: string) => `dia ${d} ${h}`,
}))

import { DELETE } from '@/app/api/horarios/[id]/route'

const chamar = () => DELETE(new Request('http://localhost/api/horarios/h1', { method: 'DELETE' }), {
  params: Promise.resolve({ id: 'h1' }),
})

describe('DELETE /api/horarios/[id] — liberar horário sem encerrar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', name: 'Direção Teste', perfil: 'ADMIN' } })
    prismaMock.horario.findFirst.mockResolvedValue({
      id: 'h1', diaSemana: 2, hora: '08:50',
      vinculo: { aluno: { nome: 'Aluno A' }, profissional: { nome: 'Profissional Teste' } },
    })
  })

  it('exclui o horário de forma reversível e mantém o vínculo', async () => {
    const r = await chamar()
    expect(r.status).toBe(200)
    expect(prismaMock.horario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h1', excluidoEm: null, vinculo: { fim: null } } }),
    )
    const dados = prismaMock.horario.update.mock.calls[0][0] as { where: { id: string }; data: { excluidoEm: Date; excluidoPor: string } }
    expect(dados.where).toEqual({ id: 'h1' })
    expect(dados.data.excluidoEm).toBeInstanceOf(Date)
    expect(dados.data.excluidoPor).toBe('Direção Teste')
    expect(registrarMock.mock.calls[0][1]).toBe('TIROU_DO_HORARIO')
  })

  it('só a direção libera', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect((await chamar()).status).toBe(403)
    authMock.mockResolvedValue({ user: { id: 's1', perfil: 'SECRETARIA' } })
    expect((await chamar()).status).toBe(403)
    expect(prismaMock.horario.update).not.toHaveBeenCalled()
  })

  it('horário inexistente, já liberado ou de atendimento encerrado: 404', async () => {
    prismaMock.horario.findFirst.mockResolvedValue(null)
    expect((await chamar()).status).toBe(404)
    expect(prismaMock.horario.update).not.toHaveBeenCalled()
  })
})
