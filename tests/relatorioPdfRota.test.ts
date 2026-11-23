import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, lerMock } = vi.hoisted(() => ({
  prismaMock: { relatorio: { findUnique: vi.fn() }, transferencia: { findMany: vi.fn() } },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  lerMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))
vi.mock('@/lib/storage', () => ({ lerArquivo: lerMock }))

import { GET } from '@/app/api/relatorios/[id]/pdf/route'

const abrir = () =>
  GET(new Request('http://localhost/api/relatorios/r1/pdf'), { params: Promise.resolve({ id: 'r1' }) })

const relatorio = (extra: Record<string, unknown> = {}) => ({
  id: 'r1', alunoId: 'al1', autorId: 'p1', tipo: 'ACOMPANHAMENTO', pdfChave: 'relatorios/r1.pdf',
  criadoEm: new Date('2026-10-20T12:00:00Z'), comAnamnese: false, ...extra,
})

describe('GET /api/relatorios/[id]/pdf registra a abertura no Histórico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    prismaMock.relatorio.findUnique.mockResolvedValue(relatorio())
    prismaMock.transferencia.findMany.mockResolvedValue([])
    lerMock.mockResolvedValue({ corpo: Buffer.from('%PDF'), tipo: 'application/pdf' })
  })

  it('quem escreveu abre e a abertura fica registrada', async () => {
    const r = await abrir()
    expect(r.status).toBe(200)
    expect(registrarMock).toHaveBeenCalledWith('p1', 'ABRIU_RELATORIO', 'relatorio:r1')
  })

  it('relatório com anamnese diz isso no registro, sem nenhum conteúdo', async () => {
    prismaMock.relatorio.findUnique.mockResolvedValue(relatorio({ comAnamnese: true }))
    await abrir()
    expect(registrarMock).toHaveBeenCalledWith('p1', 'ABRIU_RELATORIO', 'relatorio:r1 · com anamnese')
  })

  it('a direção abre o de qualquer um e fica registrado com o nome dela', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    const r = await abrir()
    expect(r.status).toBe(200)
    expect(registrarMock).toHaveBeenCalledWith('adm', 'ABRIU_RELATORIO', 'relatorio:r1')
  })

  it('colega sem acesso é recusado e nada é registrado como aberto', async () => {
    authMock.mockResolvedValue({ user: { id: 'outro', perfil: 'PROFISSIONAL' } })
    const r = await abrir()
    expect(r.status).toBe(403)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('arquivo que não existe: 404 e nada registrado', async () => {
    lerMock.mockResolvedValue(null)
    const r = await abrir()
    expect(r.status).toBe(404)
    expect(registrarMock).not.toHaveBeenCalled()
  })
})
