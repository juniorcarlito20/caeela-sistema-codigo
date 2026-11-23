import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    relatorio: { findUnique: vi.fn(), update: vi.fn() },
    documento: { updateMany: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: registrarMock,
  nomeDoAluno: async () => 'Aluno A',
}))

import { DELETE } from '@/app/api/relatorios/[id]/route'

const chamar = (id = 'r1') => DELETE(new Request(`http://localhost/api/relatorios/${id}`, { method: 'DELETE' }), {
  params: Promise.resolve({ id }),
})
const relatorio = {
  id: 'r1', alunoId: 'al1', autorId: 'prof1', comAnamnese: false, pdfChave: 'relatorios/r1.pdf', excluidoEm: null,
}

describe('DELETE /api/relatorios/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'prof1', name: 'Profissional Teste', perfil: 'PROFISSIONAL' } })
    prismaMock.relatorio.findUnique.mockResolvedValue(relatorio)
  })

  it('sem login: 401', async () => {
    authMock.mockResolvedValue(null)
    expect((await chamar()).status).toBe(401)
    expect(prismaMock.relatorio.update).not.toHaveBeenCalled()
  })

  it('quem emitiu exclui: vai para a lixeira e o documento da pasta sai junto', async () => {
    const r = await chamar()
    expect(r.status).toBe(200)
    expect(prismaMock.relatorio.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { excluidoEm: expect.any(Date), excluidoPor: 'Profissional Teste' },
    })
    expect(prismaMock.documento.updateMany).toHaveBeenCalledWith({
      where: { alunoId: 'al1', chave: 'relatorios/r1.pdf', excluidoEm: null },
      data: { excluidoEm: expect.any(Date), excluidoPor: 'Profissional Teste' },
    })
    expect(registrarMock).toHaveBeenCalledWith('prof1', 'EXCLUIU_RELATORIO', expect.stringContaining('Aluno A'))
  })

  it('o registro no Histórico não leva o conteúdo do relatório', async () => {
    await chamar()
    const [, , alvo] = registrarMock.mock.calls[0]
    expect(alvo).not.toContain('texto')
  })

  it('outro profissional não exclui relatório alheio', async () => {
    authMock.mockResolvedValue({ user: { id: 'prof2', name: 'Outro', perfil: 'PROFISSIONAL' } })
    expect((await chamar()).status).toBe(403)
    expect(prismaMock.relatorio.update).not.toHaveBeenCalled()
  })

  it('a direção exclui relatório de qualquer um', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', name: 'Direção', perfil: 'ADMIN' } })
    expect((await chamar()).status).toBe(200)
  })

  it('relatório já excluído ou inexistente: 404', async () => {
    prismaMock.relatorio.findUnique.mockResolvedValue({ ...relatorio, excluidoEm: new Date() })
    expect((await chamar()).status).toBe(404)
    prismaMock.relatorio.findUnique.mockResolvedValue(null)
    expect((await chamar()).status).toBe(404)
  })
})
