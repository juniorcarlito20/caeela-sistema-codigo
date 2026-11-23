import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    aluno: { findFirst: vi.fn() },
    vinculo: { findMany: vi.fn() },
    area: { findUnique: vi.fn() },
    sugestao: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { POST } from '@/app/api/sugestoes/route'
import { PATCH } from '@/app/api/sugestoes/[id]/route'

const criar = (corpo: unknown) =>
  POST(new Request('http://localhost/api/sugestoes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }))
const fechar = (corpo: unknown) =>
  PATCH(new Request('http://localhost/api/sugestoes/s1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: 's1' }) })

const TEXTO = 'Sugiro avaliação com a fonoaudióloga, texto secreto.'

describe('POST /api/sugestoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A' })
    prismaMock.vinculo.findMany.mockResolvedValue([{ profissionalId: 'p1', fim: null }])
    prismaMock.area.findUnique.mockResolvedValue({ id: 'ar1', nome: 'Fonoaudiologia' })
    prismaMock.sugestao.create.mockResolvedValue({ id: 's1' })
  })

  it('profissional com vínculo cria a sugestão e o Histórico não leva o texto', async () => {
    const r = await criar({ alunoId: 'al1', tipo: 'PROFISSIONAL_DO_CENTRO', areaId: 'ar1', texto: `  ${TEXTO}  ` })
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ id: 's1' })
    const dados = (prismaMock.sugestao.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(dados).toMatchObject({ alunoId: 'al1', autorId: 'p1', tipo: 'PROFISSIONAL_DO_CENTRO', areaId: 'ar1', texto: TEXTO })
    expect(registrarMock.mock.calls[0][1]).toBe('SUGERIU_ENCAMINHAMENTO')
    expect(registrarMock.mock.calls[0][2]).not.toContain('secreto')
  })

  it('exame ou consulta não leva área', async () => {
    await criar({ alunoId: 'al1', tipo: 'EXAME_OU_CONSULTA', areaId: 'ar1', texto: TEXTO })
    expect((prismaMock.sugestao.create.mock.calls[0][0] as { data: { areaId: unknown } }).data.areaId).toBeNull()
    expect(prismaMock.area.findUnique).not.toHaveBeenCalled()
  })

  it('profissional sem vínculo com o aluno é recusado', async () => {
    prismaMock.vinculo.findMany.mockResolvedValue([{ profissionalId: 'outro', fim: null }])
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: TEXTO })).status).toBe(403)
    expect(prismaMock.sugestao.create).not.toHaveBeenCalled()
  })

  it('direção e Secretaria não criam sugestão', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: TEXTO })).status).toBe(403)
    authMock.mockResolvedValue({ user: { id: 's1', perfil: 'SECRETARIA' } })
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: TEXTO })).status).toBe(403)
    expect(prismaMock.sugestao.create).not.toHaveBeenCalled()
  })

  it('recusa dados ruins: tipo do centro sem área, área inexistente, texto curto', async () => {
    expect((await criar({ alunoId: 'al1', tipo: 'PROFISSIONAL_DO_CENTRO', texto: TEXTO })).status).toBe(400)
    prismaMock.area.findUnique.mockResolvedValue(null)
    expect((await criar({ alunoId: 'al1', tipo: 'PROFISSIONAL_DO_CENTRO', areaId: 'zzz', texto: TEXTO })).status).toBe(400)
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: 'oi' })).status).toBe(400)
    expect(prismaMock.sugestao.create).not.toHaveBeenCalled()
  })

  it('recusa tipo desconhecido e aluno que não existe', async () => {
    const r = await criar({ alunoId: 'al1', tipo: 'QUALQUER', texto: TEXTO })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('Escolha o tipo da sugestão.')
    prismaMock.aluno.findFirst.mockResolvedValue(null)
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: TEXTO })).status).toBe(404)
    expect(prismaMock.sugestao.create).not.toHaveBeenCalled()
  })

  it('quem não entrou é recusado com 401', async () => {
    authMock.mockResolvedValue(null)
    expect((await criar({ alunoId: 'al1', tipo: 'OUTRA', texto: TEXTO })).status).toBe(401)
  })
})

describe('PATCH /api/sugestoes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.sugestao.findUnique.mockResolvedValue({
      id: 's1', tipo: 'EXAME_OU_CONSULTA', situacao: 'PENDENTE', texto: TEXTO, aluno: { nome: 'Aluno A' },
    })
    prismaMock.sugestao.updateMany.mockResolvedValue({ count: 1 })
  })

  it('a direção resolve com observação, e o Histórico não leva o texto', async () => {
    const r = await fechar({ acao: 'resolver', observacao: '  Família avisada.  ' })
    expect(r.status).toBe(200)
    const upd = prismaMock.sugestao.updateMany.mock.calls[0][0] as {
      where: { id: string; situacao: string }; data: Record<string, unknown>
    }
    expect(upd.where).toEqual({ id: 's1', situacao: 'PENDENTE' })
    expect(upd.data).toMatchObject({ situacao: 'RESOLVIDA', observacaoDirecao: 'Família avisada.', fechadaPorId: 'adm' })
    expect(upd.data.fechadaEm).toBeInstanceOf(Date)
    expect(registrarMock.mock.calls[0][1]).toBe('RESOLVEU_SUGESTAO')
    expect(registrarMock.mock.calls[0][2]).not.toContain('secreto')
  })

  it('descartar grava descartada; observação vazia vira nula', async () => {
    await fechar({ acao: 'descartar', observacao: '   ' })
    const upd = prismaMock.sugestao.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(upd.data).toMatchObject({ situacao: 'DESCARTADA', observacaoDirecao: null })
    expect(registrarMock.mock.calls[0][1]).toBe('DESCARTOU_SUGESTAO')
  })

  it('só a direção fecha', async () => {
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect((await fechar({ acao: 'resolver' })).status).toBe(403)
    authMock.mockResolvedValue({ user: { id: 's1', perfil: 'SECRETARIA' } })
    expect((await fechar({ acao: 'resolver' })).status).toBe(403)
    expect(prismaMock.sugestao.updateMany).not.toHaveBeenCalled()
  })

  it('sugestão que não existe: 404; que já foi encerrada: 409', async () => {
    prismaMock.sugestao.findUnique.mockResolvedValue(null)
    expect((await fechar({ acao: 'resolver' })).status).toBe(404)
    prismaMock.sugestao.findUnique.mockResolvedValue({ id: 's1', tipo: 'OUTRA', situacao: 'RESOLVIDA', aluno: { nome: 'Aluno A' } })
    prismaMock.sugestao.updateMany.mockResolvedValue({ count: 0 })
    expect((await fechar({ acao: 'resolver' })).status).toBe(409)
  })

  it('observação longa demais é recusada', async () => {
    expect((await fechar({ acao: 'resolver', observacao: 'x'.repeat(501) })).status).toBe(400)
    expect(prismaMock.sugestao.updateMany).not.toHaveBeenCalled()
  })

  it('quem não entrou é recusado com 401', async () => {
    authMock.mockResolvedValue(null)
    expect((await fechar({ acao: 'resolver' })).status).toBe(401)
    expect(prismaMock.sugestao.updateMany).not.toHaveBeenCalled()
  })
})
