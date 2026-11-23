import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    vinculo: { count: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { motivoParaNaoExcluir } from '@/domain/acesso'
import { excluirProfissional } from '@/app/(app)/profissionais/acoes'

const base = {
  quemExcluiId: 'adm',
  alvoId: 'prof1',
  perfilAlvo: 'PROFISSIONAL' as const,
  alunosVigentes: 0,
  contasDeDirecaoAtivas: 2,
}

describe('motivoParaNaoExcluir', () => {
  it('sem alunos e sem outras travas: pode', () => {
    expect(motivoParaNaoExcluir(base)).toBeNull()
  })
  it('recusa excluir a si mesmo', () => {
    expect(motivoParaNaoExcluir({ ...base, alvoId: 'adm' })).toMatch(/própria conta/)
  })
  it('recusa quem ainda atende alunos (singular e plural)', () => {
    expect(motivoParaNaoExcluir({ ...base, alunosVigentes: 1 })).toBe(
      'Essa pessoa ainda atende 1 aluno. Encerre ou transfira antes de excluir.',
    )
    expect(motivoParaNaoExcluir({ ...base, alunosVigentes: 3 })).toBe(
      'Essa pessoa ainda atende 3 alunos. Encerre ou transfira antes de excluir.',
    )
  })
  it('recusa a última conta da direção', () => {
    expect(motivoParaNaoExcluir({ ...base, perfilAlvo: 'ADMIN', contasDeDirecaoAtivas: 1 })).toMatch(
      /última conta da direção/,
    )
  })
  it('permite excluir outra conta da direção quando há mais de uma', () => {
    expect(motivoParaNaoExcluir({ ...base, perfilAlvo: 'ADMIN', contasDeDirecaoAtivas: 2 })).toBeNull()
  })
})

describe('excluirProfissional (ação de servidor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', name: 'Direção Teste', perfil: 'ADMIN' } })
    prismaMock.usuario.findUnique.mockResolvedValue({ nome: 'Profissional Teste', perfil: 'PROFISSIONAL', excluidoEm: null })
    prismaMock.usuario.count.mockResolvedValue(2)
    prismaMock.vinculo.count.mockResolvedValue(0)
  })

  it('sem vínculo aberto: inativa, grava excluidoEm/excluidoPor e registra no Histórico', async () => {
    const r = await excluirProfissional('prof1')
    expect(r).toEqual({ ok: true })
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'prof1' },
      data: { ativo: false, excluidoEm: expect.any(Date), excluidoPor: 'Direção Teste' },
    })
    expect(registrarMock).toHaveBeenCalledWith('adm', 'EXCLUIU_PROFISSIONAL', 'Profissional Teste')
  })

  it('com vínculo aberto: recusa e não grava', async () => {
    prismaMock.vinculo.count.mockResolvedValue(2)
    const r = await excluirProfissional('prof1')
    expect(r.erro).toBe('Essa pessoa ainda atende 2 alunos. Encerre ou transfira antes de excluir.')
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('quem não é direção não exclui', async () => {
    authMock.mockResolvedValue({ user: { id: 'p2', name: 'Outro', perfil: 'PROFISSIONAL' } })
    const r = await excluirProfissional('prof1')
    expect(r.erro).toBeTruthy()
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('não exclui a si mesmo', async () => {
    const r = await excluirProfissional('adm')
    expect(r.erro).toMatch(/própria conta/)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('pessoa já excluída ou inexistente: recusa', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    expect((await excluirProfissional('x')).erro).toBeTruthy()
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })
})
