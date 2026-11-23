import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock, vigentesMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(async (ops: unknown[]) => ops),
    horario: { update: vi.fn((x: unknown) => x) },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
  vigentesMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({
  registrarAcesso: registrarMock,
  quando: (d: number, h: string) => `dia ${d} ${h}`,
}))
vi.mock('@/lib/slots', () => ({
  carregarDuracoes: async () => new Map(),
  duracaoEfetiva: (_m: unknown, _p: string, _d: number, _h: string, r?: number | null) => r ?? 40,
}))
vi.mock('@/lib/agendaVigente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agendaVigente')>()),
  horariosVigentes: vigentesMock,
}))

import { POST } from '@/app/api/horarios/trocar/route'

const CICLO = new Date(2026, 8, 28)
function h(id: string, hora: string, semanas: number, extra: Record<string, unknown> = {}) {
  return {
    id, vinculoId: `v-${id}`, alunoNome: `Aluno ${id}`, profissionalNome: 'Profissional Teste',
    areaNome: 'Nutrição', profissionalId: 'p1', alunoId: `al-${id}`, diaSemana: 2, hora,
    semanas, semanasNoCiclo: 4, cicloInicio: CICLO, duracaoMin: 40, ...extra,
  }
}
function requisicao(corpo: unknown): Request {
  return new Request('http://localhost/api/horarios/trocar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
}
const gravou = (id: string) =>
  prismaMock.horario.update.mock.calls.map((c) => c[0] as { where: { id: string }; data: unknown }).find((c) => c.where.id === id)?.data

describe('POST /api/horarios/trocar com deslocamento de semana', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
  })

  it('troca as turmas no mesmo horário (1 e 3 ↔ 2 e 4)', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '08:50', 0b1010)])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'], deslocamento: 1 }))
    expect(r.status).toBe(200)
    expect(gravou('A')).toEqual({ diaSemana: 2, hora: '08:50', semanas: 0b1010 })
    expect(gravou('B')).toEqual({ diaSemana: 2, hora: '08:50', semanas: 0b0101 })
    const mudanca = registrarMock.mock.calls[0][3] as { horarios: { id: string; depois: { semanas: number } }[] }
    expect(mudanca.horarios.find((x) => x.id === 'A')?.depois.semanas).toBe(0b1010)
  })

  it('sem deslocamento, o mesmo horário continua recusado', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '08:50', 0b1010)])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'] }))
    expect(r.status).toBe(400)
    expect(prismaMock.horario.update).not.toHaveBeenCalled()
  })

  it('quinzenal com mensal: cada um mantém a frequência', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '10:10', 0b0010)])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'], deslocamento: 1 }))
    expect(r.status).toBe(200)
    expect(gravou('A')).toEqual({ diaSemana: 2, hora: '10:10', semanas: 0b1010 })
    expect(gravou('B')).toEqual({ diaSemana: 2, hora: '08:50', semanas: 0b0001 })
  })

  it('recusa se a semana nova bate com outra criança', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '10:10', 0b0010), h('C', '10:10', 0b1000)])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'], deslocamento: 1 }))
    expect(r.status).toBe(409)
    expect(prismaMock.horario.update).not.toHaveBeenCalled()
  })

  it('recusa trocar de semana entre profissionais diferentes', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '10:10', 0b1010, { profissionalId: 'p2' })])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'], deslocamento: 1 }))
    expect(r.status).toBe(400)
  })

  it('sem deslocamento troca só o horário, como antes', async () => {
    vigentesMock.mockResolvedValue([h('A', '08:50', 0b0101), h('B', '10:10', 0b0101)])
    const r = await POST(requisicao({ idsOrigem: ['A'], idsDestino: ['B'] }))
    expect(r.status).toBe(200)
    expect(gravou('A')).toEqual({ diaSemana: 2, hora: '10:10', semanas: 0b0101 })
    expect(gravou('B')).toEqual({ diaSemana: 2, hora: '08:50', semanas: 0b0101 })
  })
})
