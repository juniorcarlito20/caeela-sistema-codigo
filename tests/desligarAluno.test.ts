import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn(), update: vi.fn() },
    vinculo: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { POST } from '@/app/api/alunos/[id]/desligar/route'

const chamar = (corpo: unknown) =>
  POST(new Request('http://localhost/api/alunos/al1/desligar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: 'al1' }) })

const desde = new Date('2026-09-01T12:00:00Z')

describe('POST /api/alunos/[id]/desligar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.aluno.findFirst.mockResolvedValue({
      id: 'al1', nome: 'Aluno A', situacao: 'ATENDIMENTO', situacaoDesde: desde, pausaRetomarEm: null,
    })
    prismaMock.vinculo.findMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }])
  })

  it('só a direção desliga', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect((await chamar({ situacao: 'DESLIGADO' })).status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('exige o motivo: alta, pausa ou desligado', async () => {
    expect((await chamar({})).status).toBe(400)
    expect((await chamar({ situacao: 'ATENDIMENTO' })).status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('encerra todos os atendimentos abertos, guarda o "antes" de cada um e muda a situação do aluno', async () => {
    const r = await chamar({ situacao: 'DESLIGADO' })
    expect(r.status).toBe(200)
    expect((await r.json()).encerrados).toBe(3)
    expect(prismaMock.vinculo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { alunoId: 'al1', fim: null } }))
    expect(prismaMock.vinculo.update).toHaveBeenCalledTimes(3)
    expect(prismaMock.vinculo.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: {
        fim: expect.any(Date), motivoFim: 'DESLIGADO',
        situacaoAlunoAntes: 'ATENDIMENTO', situacaoDesdeAntes: desde, pausaRetomarEmAntes: null,
      },
    })
    expect(prismaMock.aluno.update).toHaveBeenCalledWith({
      where: { id: 'al1' },
      data: { situacao: 'DESLIGADO', situacaoDesde: expect.any(Date), pausaRetomarEm: null },
    })
    expect(registrarMock).toHaveBeenCalledWith('adm', 'DESLIGOU_ALUNO', 'Aluno A (desligado; 3 atendimentos encerrados)')
  })

  it('pausa guarda a previsão de volta; os outros motivos não', async () => {
    await chamar({ situacao: 'PAUSA', pausaRetomarEm: '2026-12-01' })
    expect(prismaMock.aluno.update).toHaveBeenCalledWith({
      where: { id: 'al1' },
      data: { situacao: 'PAUSA', situacaoDesde: expect.any(Date), pausaRetomarEm: new Date('2026-12-01T12:00:00') },
    })
    prismaMock.aluno.update.mockClear()
    await chamar({ situacao: 'ALTA', pausaRetomarEm: '2026-12-01' })
    expect(prismaMock.aluno.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ situacao: 'ALTA', pausaRetomarEm: null }),
    }))
  })

  it('aluno sem atendimento aberto: só a situação muda', async () => {
    prismaMock.vinculo.findMany.mockResolvedValue([])
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A', situacao: 'ESPERA', situacaoDesde: desde, pausaRetomarEm: null })
    const r = await chamar({ situacao: 'DESLIGADO' })
    expect(r.status).toBe(200)
    expect(prismaMock.vinculo.update).not.toHaveBeenCalled()
    expect(prismaMock.aluno.update).toHaveBeenCalled()
    expect(registrarMock.mock.calls[0][2]).toBe('Aluno A (desligado; 0 atendimentos encerrados)')
  })

  it('já está com essa situação: recusa; aluno inexistente: 404', async () => {
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A', situacao: 'DESLIGADO', situacaoDesde: desde, pausaRetomarEm: null })
    expect((await chamar({ situacao: 'DESLIGADO' })).status).toBe(400)
    prismaMock.aluno.findFirst.mockResolvedValue(null)
    expect((await chamar({ situacao: 'ALTA' })).status).toBe(404)
  })

  it('data de retorno inválida: recusa sem gravar', async () => {
    expect((await chamar({ situacao: 'PAUSA', pausaRetomarEm: 'abc' })).status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
