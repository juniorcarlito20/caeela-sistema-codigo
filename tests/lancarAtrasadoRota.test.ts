import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    atendimento: { findUnique: vi.fn(), update: vi.fn() },
    evolucao: { findUnique: vi.fn(), update: vi.fn() },
  },
  authMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: vi.fn(),
  nomeDoAluno: vi.fn(async () => 'Aluno A'),
  nomeDoAlunoDaEvolucao: vi.fn(async () => 'Aluno A'),
}))
vi.mock('@/lib/storage', () => ({ chaveDeAssinatura: vi.fn(), enviarArquivo: vi.fn() }))
vi.mock('@/lib/diasSemAtendimento', () => ({ semAtendimentoNoDia: vi.fn(async () => null) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import { PUT } from '@/app/api/atendimentos/[id]/route'
import { PATCH } from '@/app/api/evolucoes/[id]/route'

const MENSAGEM = 'Só dá para lançar até 30 dias atrás. Fale com a direção.'
const antigo = new Date('2020-03-02T12:00:00')
const recente = new Date()

const presenca = (id = 'at1') =>
  PUT(
    new Request('http://localhost/api/atendimentos/at1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situacao: 'REALIZADO' }),
    }),
    { params: Promise.resolve({ id }) },
  )

describe('PUT /api/atendimentos/[id] — limite de 30 dias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.atendimento.update.mockResolvedValue({ situacao: 'REALIZADO' })
  })

  const dar = (data: Date) =>
    prismaMock.atendimento.findUnique.mockResolvedValue({
      id: 'at1', data, hora: '09:00', assinaturaId: null, assinadoEm: null,
      vinculo: { profissionalId: 'p1', alunoId: 'al1' },
    })

  it('recusa o profissional além do limite', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    dar(antigo)
    const r = await presenca()
    expect(r.status).toBe(403)
    expect((await r.json()).erro).toBe(MENSAGEM)
    expect(prismaMock.atendimento.update).not.toHaveBeenCalled()
  })

  it('aceita a direção em qualquer data', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    dar(antigo)
    expect((await presenca()).status).toBe(200)
    expect(prismaMock.atendimento.update).toHaveBeenCalled()
  })

  it('aceita o profissional dentro do limite', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    dar(recente)
    expect((await presenca()).status).toBe(200)
  })
})

describe('PATCH /api/evolucoes/[id] — limite de 30 dias', () => {
  beforeEach(() => vi.clearAllMocks())

  const editar = () =>
    PATCH(
      new Request('http://localhost/api/evolucoes/ev1', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atividade: 'a', objetivo: 'b' }),
      }),
      { params: Promise.resolve({ id: 'ev1' }) },
    )

  it('recusa o autor além do limite', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    prismaMock.evolucao.findUnique.mockResolvedValue({ id: 'ev1', autorId: 'p1', atendimento: { data: antigo } })
    const r = await editar()
    expect(r.status).toBe(403)
    expect((await r.json()).erro).toBe(MENSAGEM)
    expect(prismaMock.evolucao.update).not.toHaveBeenCalled()
  })

  it('aceita o autor dentro do limite', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    prismaMock.evolucao.findUnique.mockResolvedValue({ id: 'ev1', autorId: 'p1', atendimento: { data: recente } })
    expect((await editar()).status).toBe(200)
  })
})
