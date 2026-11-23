import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, semAtendimentoMock } = vi.hoisted(() => ({
  prismaMock: {
    atendimento: { findUnique: vi.fn(), update: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  semAtendimentoMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: registrarMock,
  nomeDoAluno: async () => 'Aluno Fictício',
}))
vi.mock('@/lib/storage', () => ({
  chaveDeAssinatura: (id: string) => `assinaturas/${id}.png`,
  enviarArquivo: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => 'agente-teste' }),
}))
vi.mock('@/lib/diasSemAtendimento', () => ({ semAtendimentoNoDia: semAtendimentoMock }))

import { PUT } from '@/app/api/atendimentos/[id]/route'

function requisicao(corpo: unknown): Request {
  return new Request('http://localhost/api/atendimentos/a1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

const hojeISO = new Date().toISOString()
const hojeBR = `${hojeISO.slice(8, 10)}/${hojeISO.slice(5, 7)}`

describe('PUT /api/atendimentos/[id] sem assinatura obrigatória', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    semAtendimentoMock.mockResolvedValue(null)
    authMock.mockResolvedValue({ user: { id: 'prof1', perfil: 'PROFISSIONAL' } })
    prismaMock.atendimento.findUnique.mockResolvedValue({
      id: 'a1',
      assinaturaId: null,
      assinadoEm: null,
      data: new Date(), // hoje: dentro do limite de 30 dias para lançar
      hora: '08:10',
      vinculo: { profissionalId: 'prof1', alunoId: 'al1' },
    })
    prismaMock.atendimento.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'a1',
      situacao: 'REALIZADO',
      assinadoEm: null,
      dispositivo: 'agente-teste',
      confirmadoEm: new Date('2026-09-29T12:00:00Z'),
      registradoPorId: 'prof1',
      ...data,
    }))
  })

  it("REALIZADO sem assinatura é aceito e registra quem confirmou", async () => {
    const resposta = await PUT(requisicao({ situacao: 'REALIZADO' }), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(resposta.status).toBe(200)
    expect(prismaMock.atendimento.update).toHaveBeenCalledOnce()
    const dados = prismaMock.atendimento.update.mock.calls[0][0].data
    expect(dados.situacao).toBe('REALIZADO')
    expect(dados.confirmadoEm).toBeInstanceOf(Date)
    expect(dados.registradoPorId).toBe('prof1')
    expect(dados.assinaturaId).toBeNull()
    expect(registrarMock).toHaveBeenCalledWith(
      'prof1',
      'REGISTROU_PRESENCA',
      `Aluno Fictício (presença, ${hojeBR} 08:10)`,
    )
  })

  it('FALTOU sem assinatura também é aceito com a trilha preenchida', async () => {
    prismaMock.atendimento.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'a1',
      situacao: 'FALTOU',
      ...data,
    }))
    const resposta = await PUT(requisicao({ situacao: 'FALTOU' }), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(resposta.status).toBe(200)
    const dados = prismaMock.atendimento.update.mock.calls[0][0].data
    expect(dados.confirmadoEm).toBeInstanceOf(Date)
    expect(dados.registradoPorId).toBe('prof1')
  })

  it('em dia sem atendimento não registra presença nem falta', async () => {
    semAtendimentoMock.mockResolvedValue('Feriado municipal')
    const resposta = await PUT(requisicao({ situacao: 'FALTOU' }), { params: Promise.resolve({ id: 'a1' }) })
    expect(resposta.status).toBe(409)
    expect((await resposta.json()).erro).toContain('Feriado municipal')
    expect(prismaMock.atendimento.update).not.toHaveBeenCalled()
  })
})
