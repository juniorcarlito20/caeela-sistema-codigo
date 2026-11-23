import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn() },
    atendimento: { findMany: vi.fn() },
    providenciaFalta: { findFirst: vi.fn(), create: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { POST } from '@/app/api/alunos/[id]/providencia-faltas/route'

const chamar = (corpo: unknown) =>
  POST(new Request('http://localhost/api/alunos/al1/providencia-faltas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: 'al1' }) })

const at = (situacao: string, dia: number) => ({ situacao, data: new Date(Date.UTC(2026, 8, dia, 12)) })

describe('POST /api/alunos/[id]/providencia-faltas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A' })
    prismaMock.atendimento.findMany.mockResolvedValue([at('REALIZADO', 1), at('FALTOU', 8), at('FALTOU', 15)])
    prismaMock.providenciaFalta.findFirst.mockResolvedValue(null)
  })

  it('só a direção registra', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect((await chamar({ tipo: 'OUTRA' })).status).toBe(403)
    expect(prismaMock.providenciaFalta.create).not.toHaveBeenCalled()
  })

  it('tipo inválido ou ausente: 400', async () => {
    expect((await chamar({})).status).toBe(400)
    expect((await chamar({ tipo: 'QUALQUER' })).status).toBe(400)
    expect(prismaMock.providenciaFalta.create).not.toHaveBeenCalled()
  })

  it('observação com mais de 300 letras: 400 com mensagem clara', async () => {
    const r = await chamar({ tipo: 'OUTRA', observacao: 'a'.repeat(301) })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('A observação pode ter até 300 letras.')
    expect(prismaMock.providenciaFalta.create).not.toHaveBeenCalled()
  })

  it('sem aviso ativo (menos de 2 dias de falta): 400', async () => {
    prismaMock.atendimento.findMany.mockResolvedValue([at('REALIZADO', 1), at('FALTOU', 8)])
    const r = await chamar({ tipo: 'CONTATO_FAMILIA' })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('Este aluno não está com faltas seguidas para tratar.')
    expect(prismaMock.providenciaFalta.create).not.toHaveBeenCalled()
  })

  it('sequência já coberta por uma providência anterior: 400', async () => {
    prismaMock.providenciaFalta.findFirst.mockResolvedValue({ cobreAte: new Date(Date.UTC(2026, 8, 15, 12)) })
    expect((await chamar({ tipo: 'OUTRA' })).status).toBe(400)
    expect(prismaMock.providenciaFalta.create).not.toHaveBeenCalled()
  })

  it('aluno inexistente: 404', async () => {
    prismaMock.aluno.findFirst.mockResolvedValue(null)
    expect((await chamar({ tipo: 'OUTRA' })).status).toBe(404)
  })

  it('caso ok: grava cobreAte = dia da última falta e registra o Histórico sem a observação', async () => {
    const r = await chamar({ tipo: 'ASSISTENCIA_SOCIAL', observacao: '  Observação de teste  ' })
    expect(r.status).toBe(200)
    expect(prismaMock.providenciaFalta.create).toHaveBeenCalledWith({
      data: {
        alunoId: 'al1', tipo: 'ASSISTENCIA_SOCIAL', observacao: 'Observação de teste',
        cobreAte: new Date(Date.UTC(2026, 8, 15, 12)), autorId: 'adm',
      },
    })
    expect(registrarMock).toHaveBeenCalledWith('adm', 'REGISTROU_PROVIDENCIA_FALTAS', 'Aluno A (Acionou a assistência social)')
    expect(JSON.stringify(registrarMock.mock.calls)).not.toContain('Observação de teste')
  })

  it('observação é opcional (grava null) e depois de uma providência velha conta só os dias novos', async () => {
    prismaMock.providenciaFalta.findFirst.mockResolvedValue({ cobreAte: new Date(Date.UTC(2026, 8, 1, 12)) })
    const r = await chamar({ tipo: 'OUTRA' })
    expect(r.status).toBe(200)
    expect(prismaMock.providenciaFalta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ observacao: null, cobreAte: new Date(Date.UTC(2026, 8, 15, 12)) }),
    })
  })
})
