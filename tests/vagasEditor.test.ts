import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, vigentesMock, slotsMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    horario: { findMany: vi.fn(), updateMany: vi.fn() },
    atendimento: { findMany: vi.fn(), update: vi.fn() },
    slotProfissional: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  vigentesMock: vi.fn(),
  slotsMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))
vi.mock('@/lib/slots', () => ({ slotsDoProfissional: slotsMock }))
vi.mock('@/lib/agendaVigente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agendaVigente')>()),
  horariosVigentes: vigentesMock,
}))

import { PUT } from '@/app/api/profissionais/[id]/horarios-atendimento/route'

const salvar = (slots: unknown[]) =>
  PUT(new Request('http://localhost/api/profissionais/p1/horarios-atendimento', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots }),
  }), { params: Promise.resolve({ id: 'p1' }) })

const horario = (id: string, alunoId: string, vagas: number) => ({
  id, vinculoId: `v-${id}`, alunoNome: `Aluno ${alunoId}`, profissionalNome: 'Profissional Teste', areaNome: 'Terapia Ocupacional',
  profissionalId: 'p1', alunoId, diaSemana: 2, hora: '08:50', semanas: 1, semanasNoCiclo: 1, cicloInicio: null, duracaoMin: 40, vagas,
})
const pedido = (vagas?: number) => ({ diaSemana: 2, hora: '08:50', duracaoMin: 40, ...(vagas === undefined ? {} : { vagas }) })

describe('PUT horarios-atendimento com vagas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'p1', nome: 'Profissional Teste' })
    prismaMock.horario.findMany.mockResolvedValue([])
    prismaMock.atendimento.findMany.mockResolvedValue([])
  })

  it('aumentar as vagas de um horário com uma criança grava e passa', async () => {
    slotsMock.mockResolvedValue([{ diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 1 }])
    vigentesMock.mockResolvedValue([horario('h1', 'a1', 1)])
    const r = await salvar([pedido(2)])
    expect(r.status).toBe(200)
    const dados = (prismaMock.slotProfissional.createMany.mock.calls[0][0] as { data: { vagas: number }[] }).data
    expect(dados).toEqual([{ profissionalId: 'p1', diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 2 }])
  })

  it('sem informar as vagas, grava 1 (individual)', async () => {
    slotsMock.mockResolvedValue([])
    vigentesMock.mockResolvedValue([])
    const r = await salvar([pedido()])
    expect(r.status).toBe(200)
    expect((prismaMock.slotProfissional.createMany.mock.calls[0][0] as { data: { vagas: number }[] }).data[0].vagas).toBe(1)
  })

  it('criar um horário já com vagas de grupo', async () => {
    slotsMock.mockResolvedValue([])
    vigentesMock.mockResolvedValue([])
    const r = await salvar([pedido(3)])
    expect(r.status).toBe(200)
    expect((prismaMock.slotProfissional.createMany.mock.calls[0][0] as { data: { vagas: number }[] }).data[0].vagas).toBe(3)
  })

  it('reduzir as vagas abaixo de quantas crianças estão no horário é recusado', async () => {
    slotsMock.mockResolvedValue([{ diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 2 }])
    vigentesMock.mockResolvedValue([horario('h1', 'a1', 2), horario('h2', 'a2', 2)])
    const r = await salvar([pedido(1)])
    expect(r.status).toBe(409)
    expect(prismaMock.slotProfissional.createMany).not.toHaveBeenCalled()
  })

  it('reduzir as vagas até o número de crianças que já estão lá é aceito', async () => {
    slotsMock.mockResolvedValue([{ diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 4 }])
    vigentesMock.mockResolvedValue([horario('h1', 'a1', 4), horario('h2', 'a2', 4)])
    const r = await salvar([pedido(2)])
    expect(r.status).toBe(200)
  })

  it('vagas fora de 1 a 20 são recusadas', async () => {
    slotsMock.mockResolvedValue([])
    vigentesMock.mockResolvedValue([])
    expect((await salvar([pedido(0)])).status).toBe(400)
    expect((await salvar([pedido(21)])).status).toBe(400)
    expect(prismaMock.slotProfissional.createMany).not.toHaveBeenCalled()
  })
})
