import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    diaSemAtendimento: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    atendimento: { updateMany: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))
vi.mock('@/lib/fuso', () => ({ hojeNoFuso: () => '2026-10-09' })) // sexta

import { POST, DELETE } from '@/app/api/dias-sem-atendimento/route'

const marcar = (corpo: unknown) =>
  POST(new Request('http://localhost/api/dias-sem-atendimento', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }))
const desmarcar = (data: string) =>
  DELETE(new Request(`http://localhost/api/dias-sem-atendimento?data=${data}`, { method: 'DELETE' }))

describe('dias sem atendimento — marcar e desmarcar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.atendimento.updateMany.mockResolvedValue({ count: 2 })
    prismaMock.diaSemAtendimento.findUnique.mockResolvedValue({ id: 'd1', motivo: 'Feriado municipal' })
  })

  it('direção marca a segunda da semana que vem e cancela só os agendados', async () => {
    const r = await marcar({ data: '2026-10-12', motivo: '  Feriado municipal ' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, cancelados: 2 })
    const up = prismaMock.diaSemAtendimento.upsert.mock.calls[0][0] as { create: { motivo: string; criadoPorId: string } }
    expect(up.create.motivo).toBe('Feriado municipal')
    expect(up.create.criadoPorId).toBe('adm')
    const upd = prismaMock.atendimento.updateMany.mock.calls[0][0] as {
      where: { OR: { situacao: string }[] }; data: { situacao: string; observacao: string }
    }
    expect(upd.where.OR.map((o) => o.situacao)).toEqual(['AGENDADO', 'CANCELADO'])
    expect(upd.data).toEqual({ situacao: 'CANCELADO', observacao: 'Sem atendimento: Feriado municipal' })
    expect(registrarMock.mock.calls[0][1]).toBe('MARCOU_DIA_SEM_ATENDIMENTO')
  })

  it('a Secretaria também marca; profissional não', async () => {
    authMock.mockResolvedValue({ user: { id: 's1', perfil: 'SECRETARIA' } })
    expect((await marcar({ data: '2026-10-12', motivo: 'Decreto' })).status).toBe(200)
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect((await marcar({ data: '2026-10-12', motivo: 'Decreto' })).status).toBe(403)
    expect((await desmarcar('2026-10-12')).status).toBe(403)
  })

  it('recusa fim de semana, dia passado e motivo vazio', async () => {
    expect((await marcar({ data: '2026-10-10', motivo: 'Feriado' })).status).toBe(400)
    expect((await marcar({ data: '2026-10-08', motivo: 'Feriado' })).status).toBe(400)
    expect((await marcar({ data: '2026-10-12', motivo: ' ' })).status).toBe(400)
    expect(prismaMock.diaSemAtendimento.upsert).not.toHaveBeenCalled()
  })

  it('desmarcar apaga o dia e devolve a agendado só o que este aviso cancelou', async () => {
    const r = await desmarcar('2026-10-12')
    expect(r.status).toBe(200)
    expect(prismaMock.diaSemAtendimento.delete).toHaveBeenCalled()
    const upd = prismaMock.atendimento.updateMany.mock.calls[0][0] as {
      where: { situacao: string; ausenciaId: null; observacao: { startsWith: string } }; data: unknown
    }
    expect(upd.where.situacao).toBe('CANCELADO')
    expect(upd.where.ausenciaId).toBeNull()
    expect(upd.where.observacao).toEqual({ startsWith: 'Sem atendimento: ' })
    expect(upd.data).toEqual({ situacao: 'AGENDADO', observacao: null })
    expect(registrarMock.mock.calls[0][1]).toBe('DESMARCOU_DIA_SEM_ATENDIMENTO')
  })

  it('desmarcar dia que não está marcado: 404; dia passado: 400', async () => {
    prismaMock.diaSemAtendimento.findUnique.mockResolvedValue(null)
    expect((await desmarcar('2026-10-12')).status).toBe(404)
    expect((await desmarcar('2026-10-08')).status).toBe(400)
    expect(prismaMock.diaSemAtendimento.delete).not.toHaveBeenCalled()
  })
})
