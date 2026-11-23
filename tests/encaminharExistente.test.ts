import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, vigentesMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn(), update: vi.fn() },
    usuario: { findFirst: vi.fn() },
    area: { findUnique: vi.fn() },
    vinculo: { findFirst: vi.fn(), create: vi.fn() },
    horario: { create: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  vigentesMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: registrarMock,
  quando: (d: number, h: string) => `dia ${d} ${h}`,
}))
vi.mock('@/lib/slots', () => ({
  slotsDoProfissional: async () => [{ diaSemana: 2, hora: '08:50', duracaoMin: 40 }],
  carregarDuracoes: async () => new Map(),
  duracaoEfetiva: (_m: unknown, _p: string, _d: number, _h: string, r?: number | null) => r ?? 40,
}))
vi.mock('@/lib/agendaVigente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agendaVigente')>()),
  horariosVigentes: vigentesMock,
}))

import { POST } from '@/app/api/vinculos/route'

const corpo = {
  alunoId: 'al1', areaId: 'ar1', profissionalId: 'p1', diaSemana: 2, hora: '08:50',
  inicio: '2026-10-08', fim: null, semanas: 1,
}
const chamar = () =>
  POST(new Request('http://localhost/api/vinculos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }))

describe('POST /api/vinculos — aluno que já é do profissional', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A' })
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'p1', nome: 'Profissional Teste', semanasNoCiclo: 2, cicloInicio: new Date(2026, 8, 28) })
    prismaMock.area.findUnique.mockResolvedValue({ id: 'ar1', nome: 'Nutrição' })
    prismaMock.vinculo.create.mockResolvedValue({ id: 'v-novo' })
    vigentesMock.mockResolvedValue([])
  })

  it('aguardando horário: o horário entra no vínculo que já existe', async () => {
    prismaMock.vinculo.findFirst.mockResolvedValue({ id: 'v-existente' })
    const r = await chamar()
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ id: 'v-existente' })
    expect(prismaMock.vinculo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { alunoId: 'al1', profissionalId: 'p1', areaId: 'ar1', fim: null } }),
    )
    expect(prismaMock.horario.create).toHaveBeenCalledWith({
      data: { vinculoId: 'v-existente', diaSemana: 2, hora: '08:50', duracaoMin: 40, semanas: 1 },
    })
    expect(prismaMock.vinculo.create).not.toHaveBeenCalled()
  })

  it('aluno novo para o profissional: cria o vínculo como antes', async () => {
    prismaMock.vinculo.findFirst.mockResolvedValue(null)
    const r = await chamar()
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ id: 'v-novo' })
    expect(prismaMock.vinculo.create).toHaveBeenCalled()
    expect(prismaMock.horario.create).not.toHaveBeenCalled()
  })
})
