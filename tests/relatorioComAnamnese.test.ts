import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, pdfMock, dadosMock, vinculoMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn() },
    vinculo: { findMany: vi.fn() },
    transferencia: { findMany: vi.fn() },
    anamnese: { findMany: vi.fn() },
    relatorio: { create: vi.fn(), update: vi.fn() },
    documento: { create: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  pdfMock: vi.fn(),
  dadosMock: vi.fn(),
  vinculoMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))
vi.mock('@/lib/storage', () => ({ enviarArquivo: vi.fn() }))
vi.mock('@/lib/pdf/timbre', () => ({ carregarLogos: async () => ({ logo: 'x', brasao: 'y' }) }))
vi.mock('@/lib/pdf/relatorio', () => ({ gerarRelatorioPDF: pdfMock, codigoVerificacao: () => 'ABC12345' }))
vi.mock('@/lib/relatorios', () => ({ dadosParaRelatorio: dadosMock, vinculoParaRelatorio: vinculoMock }))

import { POST } from '@/app/api/relatorios/route'

const requisicao = (corpo: unknown) =>
  new Request('http://localhost/api/relatorios', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })

const opcoes = ['Nem um pouco', 'Só um pouco', 'Bastante', 'Demais']
const anamnese = (id: string, autorId: string) => ({
  id, autorId, alunoId: 'al1', criadoEm: new Date('2026-10-20T12:00:00Z'),
  respostas: { i1: 'Bastante' },
  modelo: { nome: 'Modelo de Teste', campos: [{ id: 'i1', rotulo: '1. Item um', tipo: 'escala', opcoes, secao: 'Grupo A' }] },
  autor: { nome: 'Profissional Teste' },
})

describe('POST /api/relatorios com e sem anamnese', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'p1', name: 'Profissional Teste', perfil: 'PROFISSIONAL' } })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A', matricula: '2026-0001' })
    prismaMock.vinculo.findMany.mockResolvedValue([{ profissionalId: 'p1', fim: null }])
    prismaMock.transferencia.findMany.mockResolvedValue([])
    prismaMock.relatorio.create.mockResolvedValue({ id: 'r1' })
    vinculoMock.mockResolvedValue({ id: 'v1' })
    dadosMock.mockResolvedValue({
      periodo: 'outubro de 2026', area: 'Psicopedagogia', profissional: 'Profissional Teste',
      resumo: { total: 1, realizados: 1, faltas: 0, justificadas: 0, cancelados: 0 },
    })
    pdfMock.mockResolvedValue(Buffer.from('%PDF'))
  })

  const base = { alunoId: 'al1', tipo: 'ACOMPANHAMENTO', texto: 'Texto do relatório.' }

  it('sem anamnese: vai para a pasta Documentos, como sempre', async () => {
    const r = await POST(requisicao(base))
    expect(r.status).toBe(201)
    expect(prismaMock.documento.create).toHaveBeenCalledTimes(1)
    expect((prismaMock.relatorio.create.mock.calls[0][0] as { data: { comAnamnese: boolean } }).data.comAnamnese).toBe(false)
    expect((pdfMock.mock.calls[0][0] as { anexos: unknown[] }).anexos).toEqual([])
  })

  it('com anamnese própria: anexa ao PDF e NÃO vai para a pasta Documentos', async () => {
    prismaMock.anamnese.findMany.mockResolvedValue([anamnese('a1', 'p1')])
    const r = await POST(requisicao({ ...base, anamneseIds: ['a1'] }))
    expect(r.status).toBe(201)
    expect(prismaMock.documento.create).not.toHaveBeenCalled()
    expect((prismaMock.relatorio.create.mock.calls[0][0] as { data: { comAnamnese: boolean } }).data.comAnamnese).toBe(true)
    const anexos = (pdfMock.mock.calls[0][0] as { anexos: { modelo: string; secoes: unknown[] }[] }).anexos
    expect(anexos).toHaveLength(1)
    expect(anexos[0].modelo).toBe('Modelo de Teste')
    expect(registrarMock.mock.calls[0][2]).toContain('com anamnese')
  })

  it('recusa anamnese escrita por outro profissional', async () => {
    prismaMock.anamnese.findMany.mockResolvedValue([anamnese('a2', 'outro')])
    const r = await POST(requisicao({ ...base, anamneseIds: ['a2'] }))
    expect(r.status).toBe(403)
    expect(prismaMock.relatorio.create).not.toHaveBeenCalled()
  })

  it('recusa anamnese que não é deste aluno (ou não existe)', async () => {
    prismaMock.anamnese.findMany.mockResolvedValue([])
    const r = await POST(requisicao({ ...base, anamneseIds: ['a3'] }))
    expect(r.status).toBe(404)
    expect(prismaMock.relatorio.create).not.toHaveBeenCalled()
  })

  it('a direção anexa a anamnese de qualquer profissional', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', name: 'Direção Teste', perfil: 'ADMIN' } })
    prismaMock.anamnese.findMany.mockResolvedValue([anamnese('a2', 'outro')])
    const r = await POST(requisicao({ ...base, anamneseIds: ['a2'] }))
    expect(r.status).toBe(201)
  })
})
