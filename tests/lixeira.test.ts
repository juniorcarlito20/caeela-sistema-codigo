import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, excluirArquivoMock } = vi.hoisted(() => ({
  prismaMock: {
    documento: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    relatorio: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    aluno: { deleteMany: vi.fn() },
    evolucao: { deleteMany: vi.fn() },
    horario: { deleteMany: vi.fn() },
  },
  excluirArquivoMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/storage', () => ({ excluirArquivo: excluirArquivoMock }))

import { itensExpirados, limparLixeira, DIAS_LIXEIRA } from '@/lib/lixeira'

const agora = new Date('2026-09-23T12:00:00Z')
const dia = 86400000

describe('itens expirados', () => {
  it('separa o que passou de 30 dias', () => {
    const itens = [
      { id: 'velho', excluidoEm: new Date(agora.getTime() - 31 * dia) },
      { id: 'novo', excluidoEm: new Date(agora.getTime() - 5 * dia) },
      { id: 'ativo', excluidoEm: null },
    ]
    expect(itensExpirados(itens, agora)).toEqual(['velho'])
  })
  it('respeita o prazo configurado', () => {
    const itens = [{ id: 'a', excluidoEm: new Date(agora.getTime() - 10 * dia) }]
    expect(itensExpirados(itens, agora, 7)).toEqual(['a'])
    expect(itensExpirados(itens, agora, 30)).toEqual([])
  })
})

describe('limpeza da lixeira', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.relatorio.findMany.mockResolvedValue([])
    prismaMock.relatorio.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.documento.count.mockResolvedValue(0)
    prismaMock.relatorio.count.mockResolvedValue(0)
  })

  it('apaga arquivos e linhas com mais de 30 dias', async () => {
    prismaMock.documento.findMany.mockResolvedValue([
      { id: 'd1', chave: 'alunos/a1/1-laudo.jpg' },
    ])
    prismaMock.aluno.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.documento.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.evolucao.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.horario.deleteMany.mockResolvedValue({ count: 2 })

    const r = await limparLixeira(agora)

    expect(excluirArquivoMock).toHaveBeenCalledWith('alunos/a1/1-laudo.jpg')
    expect(prismaMock.documento.deleteMany).toHaveBeenCalledWith({
      where: { excluidoEm: { not: null, lt: new Date(agora.getTime() - DIAS_LIXEIRA * dia) } },
    })
    expect(r).toEqual({ alunos: 1, documentos: 1, evolucoes: 0, horarios: 2, relatorios: 0 })
  })

  describe('relatórios na lixeira', () => {
    beforeEach(() => {
      prismaMock.aluno.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.documento.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.evolucao.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.horario.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.documento.findMany.mockResolvedValue([])
    })

    it('apaga o relatório vencido e o arquivo dele quando nada mais aponta para ele', async () => {
      prismaMock.relatorio.findMany.mockResolvedValue([{ id: 'r1', pdfChave: 'relatorios/r1.pdf' }])
      prismaMock.relatorio.deleteMany.mockResolvedValue({ count: 1 })
      const r = await limparLixeira(agora)
      expect(r.relatorios).toBe(1)
      expect(excluirArquivoMock).toHaveBeenCalledTimes(1)
      expect(excluirArquivoMock).toHaveBeenCalledWith('relatorios/r1.pdf')
    })

    it('relatório e documento que dividem o arquivo vencem juntos: o arquivo sai uma vez só', async () => {
      prismaMock.relatorio.findMany.mockResolvedValue([{ id: 'r1', pdfChave: 'relatorios/r1.pdf' }])
      prismaMock.documento.findMany.mockResolvedValue([{ id: 'd1', chave: 'relatorios/r1.pdf' }])
      await limparLixeira(agora)
      expect(excluirArquivoMock).toHaveBeenCalledTimes(1)
    })

    it('se um documento restaurado ainda usa o arquivo, ele fica', async () => {
      prismaMock.relatorio.findMany.mockResolvedValue([{ id: 'r1', pdfChave: 'relatorios/r1.pdf' }])
      prismaMock.documento.count.mockResolvedValue(1)
      await limparLixeira(agora)
      expect(excluirArquivoMock).not.toHaveBeenCalled()
    })
  })
})
