// tests/sugestoesLib.test.ts
// A leitura das sugestões é a parte mais delicada: só o autor vê a própria sugestão, e aluno na
// lixeira não aparece.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { sugestao: { findMany: vi.fn() } },
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))

import { paraTela, sugestoesDoAluno } from '@/lib/sugestoes'

const linha = {
  id: 's1',
  alunoId: 'al1',
  tipo: 'EXAME_OU_CONSULTA',
  texto: 'Texto da sugestão',
  situacao: 'PENDENTE',
  observacaoDirecao: null,
  criadoEm: new Date('2026-10-21T12:00:00Z'),
  fechadaEm: null,
  aluno: { nome: 'Aluno A' },
  area: null,
  autor: { nome: 'Maria da Silva' },
}

describe('sugestoesDoAluno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.sugestao.findMany.mockResolvedValue([linha])
  })

  it('o profissional recebe só as sugestões que ele mesmo escreveu', async () => {
    await sugestoesDoAluno('al1', 'PROFISSIONAL', 'p1')
    const where = prismaMock.sugestao.findMany.mock.calls[0][0].where
    expect(where).toEqual({ alunoId: 'al1', autorId: 'p1', aluno: { excluidoEm: null } })
  })

  it('a direção recebe todas as do aluno', async () => {
    await sugestoesDoAluno('al1', 'ADMIN', 'adm')
    const where = prismaMock.sugestao.findMany.mock.calls[0][0].where
    expect(where).toEqual({ alunoId: 'al1', aluno: { excluidoEm: null } })
    expect(where).not.toHaveProperty('autorId')
  })

  it('aluno da lixeira não aparece em lugar nenhum', async () => {
    await sugestoesDoAluno('al1', 'ADMIN', 'adm')
    expect(prismaMock.sugestao.findMany.mock.calls[0][0].where.aluno).toEqual({ excluidoEm: null })
  })
})

describe('paraTela', () => {
  it('manda as datas como texto e o que a tela precisa', () => {
    const tela = paraTela(linha as never)
    expect(tela).toMatchObject({
      id: 's1',
      alunoId: 'al1',
      alunoNome: 'Aluno A',
      tipo: 'EXAME_OU_CONSULTA',
      areaNome: null,
      situacao: 'PENDENTE',
      observacaoDirecao: null,
      autorNome: 'Maria da Silva',
      criadoEm: '2026-10-21T12:00:00.000Z',
      fechadaEm: null,
    })
  })

  it('sugestão fechada leva a data do fechamento', () => {
    const tela = paraTela({ ...linha, situacao: 'RESOLVIDA', fechadaEm: new Date('2026-10-22T09:00:00Z') } as never)
    expect(tela.fechadaEm).toBe('2026-10-22T09:00:00.000Z')
  })
})
