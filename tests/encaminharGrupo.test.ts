import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, vigentesMock, garantirMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn(), update: vi.fn() },
    usuario: { findFirst: vi.fn() },
    area: { findUnique: vi.fn() },
    vinculo: { findFirst: vi.fn(), create: vi.fn() },
    horario: { create: vi.fn() },
  },
  authMock: vi.fn(),
  vigentesMock: vi.fn(),
  garantirMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: vi.fn(),
  quando: (d: number, h: string) => `dia ${d} ${h}`,
}))
vi.mock('@/lib/slots', () => ({
  slotsDoProfissional: async () => [{ diaSemana: 2, hora: '08:50', duracaoMin: 40 }],
  carregarDuracoes: async () => new Map(),
  duracaoEfetiva: (_m: unknown, _p: string, _d: number, _h: string, r?: number | null) => r ?? 40,
  garantirVagas: garantirMock,
}))
vi.mock('@/lib/agendaVigente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agendaVigente')>()),
  horariosVigentes: vigentesMock,
}))

import { POST } from '@/app/api/vinculos/route'

const base = {
  alunoId: 'al2', areaId: 'ar1', profissionalId: 'p1', diaSemana: 2, hora: '08:50',
  inicio: '2026-10-21', fim: null, semanas: 1,
}
const chamar = (extra: object = {}) =>
  POST(new Request('http://localhost/api/vinculos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, ...extra }),
  }))

const horarioDe = (id: string, alunoId: string, profissionalId = 'p1', hora = '08:50') => ({
  id, vinculoId: `v-${id}`, alunoNome: `Aluno ${alunoId}`, profissionalNome: 'Profissional Teste', areaNome: 'Terapia',
  profissionalId, alunoId, diaSemana: 2, hora, semanas: 1, semanasNoCiclo: 1, cicloInicio: null, duracaoMin: 40, vagas: 1,
})

describe('POST /api/vinculos — "+" na agenda (mais uma criança no mesmo horário)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al2', nome: 'Aluno B' })
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'p1', nome: 'Profissional Teste', semanasNoCiclo: 1, cicloInicio: null })
    prismaMock.area.findUnique.mockResolvedValue({ id: 'ar1', nome: 'Terapia' })
    prismaMock.vinculo.findFirst.mockResolvedValue(null)
    prismaMock.vinculo.create.mockResolvedValue({ id: 'v-novo' })
    vigentesMock.mockResolvedValue([horarioDe('h1', 'al1')])
  })

  it('sem o "+": horário individual ocupado continua recusando', async () => {
    const r = await chamar()
    expect(r.status).toBe(409)
    expect(garantirMock).not.toHaveBeenCalled()
    expect(prismaMock.vinculo.create).not.toHaveBeenCalled()
  })

  it('com o "+": encaixa a criança e sobe as vagas do horário para 2', async () => {
    const r = await chamar({ grupo: true })
    expect(r.status).toBe(201)
    expect(garantirMock).toHaveBeenCalledWith('p1', expect.any(Array), 2, '08:50', 2)
    expect(prismaMock.vinculo.create).toHaveBeenCalled()
  })

  it('a terceira criança sobe as vagas para 3', async () => {
    vigentesMock.mockResolvedValue([horarioDe('h1', 'al1'), { ...horarioDe('h2', 'al3'), vagas: 2 }])
    const r = await chamar({ grupo: true })
    expect(r.status).toBe(201)
    expect(garantirMock).toHaveBeenCalledWith('p1', expect.any(Array), 2, '08:50', 3)
  })

  it('a criança que já tem atendimento com outro profissional nessa hora: recusa e não mexe nas vagas', async () => {
    vigentesMock.mockResolvedValue([horarioDe('h1', 'al1'), horarioDe('h9', 'al2', 'p9')])
    const r = await chamar({ grupo: true })
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toContain('dois atendimentos ao mesmo tempo')
    expect(garantirMock).not.toHaveBeenCalled()
    expect(prismaMock.vinculo.create).not.toHaveBeenCalled()
  })

  it('numa semana vazia o "+" não mexe nas vagas', async () => {
    vigentesMock.mockResolvedValue([])
    const r = await chamar({ grupo: true })
    expect(r.status).toBe(201)
    expect(garantirMock).not.toHaveBeenCalled()
  })

  it('passou de 20 crianças: recusa', async () => {
    vigentesMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ ...horarioDe(`h${i}`, `x${i}`), vagas: 20 })))
    const r = await chamar({ grupo: true })
    expect(r.status).toBe(400)
    expect(garantirMock).not.toHaveBeenCalled()
  })
})
