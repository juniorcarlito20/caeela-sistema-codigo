import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => {
  const prismaMock = {
    atendimento: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    registroConsulta: { upsert: vi.fn() },
    $transaction: vi.fn(),
  }
  return { prismaMock, authMock: vi.fn(), registrarMock: vi.fn() }
})

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))
vi.mock('@/lib/fuso', () => ({ hojeNoFuso: () => '2026-11-03' }))

import { PUT } from '@/app/api/consultas/[id]/registro/route'

const TEXTO_SIGILOSO = 'TEXTO-SIGILOSO-DE-TESTE-123'

const chamar = (corpo: unknown, id = 'at1') =>
  PUT(
    new Request(`http://localhost/api/consultas/${id}/registro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id }) },
  )

const valido = { situacao: 'REALIZADO', tipo: 'CONSULTA_NO_CENTRO', registro: TEXTO_SIGILOSO }

function consultaDoBanco(extra: Record<string, unknown> = {}) {
  return {
    id: 'at1',
    data: new Date('2026-11-03T12:00:00Z'),
    hora: '09:00',
    situacao: 'AGENDADO',
    confirmadoEm: null,
    vinculoId: 'v1',
    registroConsulta: null,
    vinculo: {
      profissionalId: 'p1',
      profissional: { nome: 'Dra. Ana' },
      aluno: { nome: 'Pessoa Teste' },
    },
    ...extra,
  }
}

describe('PUT /api/consultas/[id]/registro', () => {
  let consulta: ReturnType<typeof consultaDoBanco>
  let haConflito: boolean

  beforeEach(() => {
    vi.clearAllMocks()
    consulta = consultaDoBanco()
    haConflito = false
    authMock.mockResolvedValue({ user: { id: 'p1', perfil: 'PROFISSIONAL' } })
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    // 1a busca: a consulta; conflito de horário (situacao in [...]); demais (consulta cancelada): nada.
    prismaMock.atendimento.findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ('id' in args.where) return consulta
      if (typeof args.where.situacao === 'object') return haConflito ? { id: 'outra' } : null
      return null
    })
    prismaMock.atendimento.create.mockResolvedValue({ id: 'novo' })
    prismaMock.atendimento.update.mockResolvedValue({ id: 'at1' })
    prismaMock.registroConsulta.upsert.mockResolvedValue({ id: 'rc1' })
  })

  it('sem login: 401', async () => {
    authMock.mockResolvedValue(null)
    expect((await chamar(valido)).status).toBe(401)
  })

  it('a direção não grava (só lê): 403', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    expect((await chamar(valido)).status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('a secretaria não grava: 403', async () => {
    authMock.mockResolvedValue({ user: { id: 's1', perfil: 'SECRETARIA' } })
    expect((await chamar(valido)).status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('outro profissional não grava: 403', async () => {
    authMock.mockResolvedValue({ user: { id: 'p2', perfil: 'PROFISSIONAL' } })
    expect((await chamar(valido)).status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('consulta que não existe (ou não é avulsa): 404', async () => {
    prismaMock.atendimento.findFirst.mockResolvedValue(null)
    expect((await chamar(valido)).status).toBe(404)
  })

  it('aconteceu sem registro: 400', async () => {
    expect((await chamar({ ...valido, registro: '   ' })).status).toBe(400)
    expect((await chamar({ situacao: 'REALIZADO', tipo: 'TELEFONE' })).status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('faltou sem registro: ok, marca FALTOU', async () => {
    const r = await chamar({ situacao: 'FALTOU', tipo: 'CONSULTA_NO_CENTRO' })
    expect(r.status).toBe(200)
    expect(prismaMock.atendimento.update).toHaveBeenCalledWith({
      where: { id: 'at1' },
      data: { situacao: 'FALTOU', confirmadoEm: expect.any(Date), registradoPorId: 'p1' },
    })
    expect(prismaMock.registroConsulta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ registro: '', autorId: 'p1' }) }),
    )
  })

  it('tipo inválido ou registro acima de 100 mil caracteres: 400', async () => {
    expect((await chamar({ ...valido, tipo: 'OUTRA' })).status).toBe(400)
    expect((await chamar({ ...valido, registro: 'a'.repeat(100001) })).status).toBe(400)
    expect((await chamar({ ...valido, registro: 'a'.repeat(100000) })).status).toBe(200)
  })

  it('grava o registro e marca REALIZADO, com quem registrou', async () => {
    const r = await chamar({
      ...valido,
      presentes: ' mãe ',
      encaminhamentos: ['CRAS', 'UBS'],
      proximoPasso: 'Levar o laudo',
    })
    expect(r.status).toBe(200)
    expect(prismaMock.atendimento.update).toHaveBeenCalledWith({
      where: { id: 'at1' },
      data: { situacao: 'REALIZADO', confirmadoEm: expect.any(Date), registradoPorId: 'p1' },
    })
    const upsert = prismaMock.registroConsulta.upsert.mock.calls[0][0]
    expect(upsert.where).toEqual({ atendimentoId: 'at1' })
    expect(upsert.create).toMatchObject({
      atendimentoId: 'at1',
      autorId: 'p1',
      tipo: 'CONSULTA_NO_CENTRO',
      presentes: 'mãe',
      registro: TEXTO_SIGILOSO,
      encaminhamentos: ['CRAS', 'UBS'],
      proximoPasso: 'Levar o laudo',
      retornoEm: null,
    })
    expect(upsert.update).not.toHaveProperty('autorId')
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
  })

  it('psiquiatra (agenda própria com lembrete) não grava encaminhamentos nem visita domiciliar', async () => {
    consulta = consultaDoBanco({
      vinculo: { profissionalId: 'p1', profissional: { nome: 'Dr. Psiq', tipoAgenda: 'AVULSA_DIRECAO' }, aluno: { nome: 'Pessoa Teste' } },
    })
    expect((await chamar({ ...valido, tipo: 'VISITA_DOMICILIAR' })).status).toBe(400)
    expect((await chamar({ ...valido, tipo: 'TELEFONE', encaminhamentos: ['CRAS'] })).status).toBe(200)
    const upsert = prismaMock.registroConsulta.upsert.mock.calls[0][0]
    expect(upsert.create).toMatchObject({ tipo: 'TELEFONE', encaminhamentos: [] })
  })

  it('assistente social continua com visita domiciliar e encaminhamentos', async () => {
    consulta = consultaDoBanco({
      vinculo: { profissionalId: 'p1', profissional: { nome: 'Assistente', tipoAgenda: 'AVULSA_PROPRIA' }, aluno: { nome: 'Pessoa Teste' } },
    })
    expect((await chamar({ ...valido, tipo: 'VISITA_DOMICILIAR', encaminhamentos: ['CREAS'] })).status).toBe(200)
    const upsert = prismaMock.registroConsulta.upsert.mock.calls[0][0]
    expect(upsert.create).toMatchObject({ tipo: 'VISITA_DOMICILIAR', encaminhamentos: ['CREAS'] })
  })

  it('edição não troca o autor nem a hora da primeira confirmação', async () => {
    const antes = new Date('2026-11-03T13:00:00Z')
    consulta = consultaDoBanco({ situacao: 'REALIZADO', confirmadoEm: antes, registroConsulta: { id: 'rc1', retornoEm: null } })
    expect((await chamar(valido)).status).toBe(200)
    expect(prismaMock.atendimento.update).toHaveBeenCalledWith({
      where: { id: 'at1' },
      data: expect.objectContaining({ confirmadoEm: antes }),
    })
  })

  it('respeita o limite de 30 dias', async () => {
    consulta = consultaDoBanco({ data: new Date('2026-09-20T12:00:00Z') })
    const r = await chamar(valido)
    expect(r.status).toBe(403)
    expect((await r.json()).erro).toMatch(/30 dias/)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    // dentro do limite (30 dias atrás) passa
    consulta = consultaDoBanco({ data: new Date('2026-10-04T12:00:00Z') })
    expect((await chamar(valido)).status).toBe(200)
  })

  it('consulta desmarcada não recebe registro: 409', async () => {
    consulta = consultaDoBanco({ situacao: 'CANCELADO' })
    expect((await chamar(valido)).status).toBe(409)
  })

  describe('retorno', () => {
    it('cria a próxima consulta avulsa AGENDADO no mesmo vínculo', async () => {
      const r = await chamar({ ...valido, retornoData: '2026-11-20', retornoHora: '14:00' })
      expect(r.status).toBe(200)
      expect(prismaMock.atendimento.create).toHaveBeenCalledWith({
        data: { vinculoId: 'v1', data: new Date('2026-11-20T12:00:00'), hora: '14:00', situacao: 'AGENDADO', avulso: true },
        select: { id: true },
      })
      expect(prismaMock.registroConsulta.upsert.mock.calls[0][0].create.retornoEm).toEqual(new Date('2026-11-20T14:00:00Z'))
    })

    it('hora é obrigatória quando há data (e vice-versa)', async () => {
      expect((await chamar({ ...valido, retornoData: '2026-11-20' })).status).toBe(400)
      expect((await chamar({ ...valido, retornoHora: '14:00' })).status).toBe(400)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('só datas futuras', async () => {
      expect((await chamar({ ...valido, retornoData: '2026-11-03', retornoHora: '14:00' })).status).toBe(400)
      expect((await chamar({ ...valido, retornoData: '2026-10-01', retornoHora: '14:00' })).status).toBe(400)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('conflito no dia e hora do retorno: 409, sem registrar no Histórico', async () => {
      haConflito = true
      const r = await chamar({ ...valido, retornoData: '2026-11-20', retornoHora: '14:00' })
      expect(r.status).toBe(409)
      expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
      expect(registrarMock).not.toHaveBeenCalled()
    })

    it('ao editar com o mesmo retorno, não cria outra consulta', async () => {
      consulta = consultaDoBanco({
        situacao: 'REALIZADO',
        registroConsulta: { id: 'rc1', retornoEm: new Date('2026-11-20T14:00:00Z') },
      })
      const r = await chamar({ ...valido, retornoData: '2026-11-20', retornoHora: '14:00' })
      expect(r.status).toBe(200)
      expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
      expect(prismaMock.atendimento.updateMany).not.toHaveBeenCalled()
    })

    it('ao editar com outro retorno, tira o antigo (se ainda só marcado) e cria o novo', async () => {
      consulta = consultaDoBanco({
        situacao: 'REALIZADO',
        registroConsulta: { id: 'rc1', retornoEm: new Date('2026-11-20T14:00:00Z') },
      })
      const r = await chamar({ ...valido, retornoData: '2026-11-25', retornoHora: '10:30' })
      expect(r.status).toBe(200)
      expect(prismaMock.atendimento.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ vinculoId: 'v1', hora: '14:00', situacao: 'AGENDADO', avulso: true }),
        data: { situacao: 'CANCELADO', observacao: 'Retorno alterado' },
      })
      expect(prismaMock.atendimento.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ hora: '10:30', avulso: true, situacao: 'AGENDADO' }) }),
      )
    })
  })

  describe('Histórico', () => {
    it('guarda só quem e sobre quem, nunca o texto', async () => {
      const r = await chamar({
        ...valido,
        presentes: TEXTO_SIGILOSO,
        proximoPasso: TEXTO_SIGILOSO,
        retornoData: '2026-11-20',
        retornoHora: '14:00',
      })
      expect(r.status).toBe(200)
      expect(registrarMock).toHaveBeenCalledTimes(1)
      expect(registrarMock).toHaveBeenCalledWith('p1', 'REGISTROU_CONSULTA', 'Pessoa Teste com Dra. Ana em 03/11')
      expect(JSON.stringify(registrarMock.mock.calls)).not.toContain(TEXTO_SIGILOSO)
    })
  })
})
