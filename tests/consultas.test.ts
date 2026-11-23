import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn(), findUnique: vi.fn() },
    aluno: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    vinculo: { findFirst: vi.fn(), create: vi.fn() },
    atendimento: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { POST } from '@/app/api/consultas/route'
import { DELETE } from '@/app/api/consultas/[id]/route'
import { GET as PESSOAS } from '@/app/api/consultas/pessoas/route'
import {
  agendaAvulsa,
  diaMes,
  podeDesmarcarConsulta,
  podeMarcarConsulta,
  podeVerConsultas,
  proximaMatriculaExterna,
  resumoDaPessoa,
  rotuloDia,
  separarConsultas,
  textoDaConsulta,
} from '@/domain/consultas'

const DIA = '2099-01-12' // futuro: qualquer perfil pode marcar

const marcar = (corpo: unknown) =>
  POST(
    new Request('http://localhost/api/consultas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
  )

const desmarcar = (id = 'c1') =>
  DELETE(new Request(`http://localhost/api/consultas/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  })

describe('regras puras de consultas', () => {
  it('só agenda não fixa é avulsa', () => {
    expect(agendaAvulsa('AVULSA_DIRECAO')).toBe(true)
    expect(agendaAvulsa('AVULSA_PROPRIA')).toBe(true)
    expect(agendaAvulsa('FIXA')).toBe(false)
    expect(agendaAvulsa(undefined)).toBe(false)
  })

  it('quem vê a tela: direção e profissional de agenda avulsa', () => {
    expect(podeVerConsultas('ADMIN', null)).toBe(true)
    expect(podeVerConsultas('PROFISSIONAL', 'AVULSA_PROPRIA')).toBe(true)
    expect(podeVerConsultas('PROFISSIONAL', 'FIXA')).toBe(false)
    expect(podeVerConsultas('SECRETARIA', 'AVULSA_DIRECAO')).toBe(false)
  })

  it('quem marca e quem desmarca', () => {
    const psi = { id: 'psi', tipoAgenda: 'AVULSA_DIRECAO' }
    expect(podeMarcarConsulta({ id: 'adm', perfil: 'ADMIN' }, psi)).toBe(true)
    expect(podeMarcarConsulta({ id: 'psi', perfil: 'PROFISSIONAL' }, psi)).toBe(true)
    expect(podeMarcarConsulta({ id: 'outro', perfil: 'PROFISSIONAL' }, psi)).toBe(false)
    expect(podeMarcarConsulta({ id: 'sec', perfil: 'SECRETARIA' }, psi)).toBe(false)
    expect(podeMarcarConsulta({ id: 'adm', perfil: 'ADMIN' }, { id: 'fix', tipoAgenda: 'FIXA' })).toBe(false)
    expect(podeDesmarcarConsulta({ id: 'adm', perfil: 'ADMIN' }, 'psi')).toBe(true)
    expect(podeDesmarcarConsulta({ id: 'psi', perfil: 'PROFISSIONAL' }, 'psi')).toBe(true)
    expect(podeDesmarcarConsulta({ id: 'x', perfil: 'PROFISSIONAL' }, 'psi')).toBe(false)
    expect(podeDesmarcarConsulta({ id: 'sec', perfil: 'SECRETARIA' }, 'psi')).toBe(false)
  })

  it('matrícula de pessoa de fora: EXT-ano-número', () => {
    expect(proximaMatriculaExterna(2026)).toBe('EXT-2026-0001')
    expect(proximaMatriculaExterna(2026, 'EXT-2026-0009')).toBe('EXT-2026-0010')
    expect(proximaMatriculaExterna(2027, 'EXT-2026-0009')).toBe('EXT-2027-0001')
    // matrícula de aluno não entra na conta
    expect(proximaMatriculaExterna(2026, '2026-0042')).toBe('EXT-2026-0001')
  })

  it('última e próxima consulta da pessoa', () => {
    const d = (iso: string) => new Date(`${iso}T12:00:00Z`)
    const r = resumoDaPessoa(
      [
        { data: d('2026-09-01'), hora: '09:00', situacao: 'REALIZADO' },
        { data: d('2026-10-05'), hora: '10:00', situacao: 'FALTOU' },
        { data: d('2026-10-20'), hora: '10:00', situacao: 'CANCELADO' },
        { data: d('2026-11-20'), hora: '15:00', situacao: 'AGENDADO' },
        { data: d('2026-11-10'), hora: '14:00', situacao: 'AGENDADO' },
        { data: d('2026-10-01'), hora: '08:00', situacao: 'AGENDADO' }, // passada: não é "próxima"
      ],
      '2026-11-03',
    )
    expect(r.ultima).toEqual({ dia: '2026-10-05', hora: '10:00' })
    expect(r.proxima).toEqual({ dia: '2026-11-10', hora: '14:00' })
    expect(resumoDaPessoa([], '2026-11-03')).toEqual({ ultima: null, proxima: null })
  })

  it('separa próximas e pendentes (passadas sem registro)', () => {
    const d = (iso: string) => new Date(`${iso}T12:00:00Z`)
    const { proximas, pendentes } = separarConsultas(
      [
        { id: 'a', data: d('2026-11-03'), hora: '15:00', situacao: 'AGENDADO' },
        { id: 'b', data: d('2026-11-03'), hora: '09:00', situacao: 'AGENDADO' },
        { id: 'c', data: d('2026-10-30'), hora: '09:00', situacao: 'AGENDADO' },
        { id: 'd', data: d('2026-10-29'), hora: '09:00', situacao: 'AGENDADO', temRegistro: true },
        { id: 'e', data: d('2026-10-28'), hora: '09:00', situacao: 'REALIZADO' },
      ],
      '2026-11-03',
    )
    expect(proximas.map((c) => c.id)).toEqual(['b', 'a'])
    expect(pendentes.map((c) => c.id)).toEqual(['c'])
  })

  it('textos curtos', () => {
    expect(diaMes('2026-11-03')).toBe('03/11')
    expect(rotuloDia('2026-11-03')).toBe('ter 03/11')
    expect(textoDaConsulta('Fulano', 'Dra. Ana', '2026-11-03', '14:00')).toBe('Fulano com Dra. Ana em 03/11 às 14:00')
  })
})

describe('POST /api/consultas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'psi', nome: 'Dra. Ana', tipoAgenda: 'AVULSA_DIRECAO', areaId: 'ar1' })
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A', situacao: 'ATENDIMENTO', deFora: false })
    prismaMock.atendimento.findFirst.mockResolvedValue(null)
    prismaMock.vinculo.findFirst.mockResolvedValue(null)
    prismaMock.vinculo.create.mockResolvedValue({ id: 'v1' })
    prismaMock.atendimento.create.mockResolvedValue({ id: 'at1' })
  })

  it('a direção marca para um aluno do centro e cria o vínculo sem horários', async () => {
    const r = await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })
    expect(r.status).toBe(201)
    expect(prismaMock.vinculo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { alunoId: 'al1', profissionalId: 'psi', areaId: 'ar1' } }),
    )
    expect(prismaMock.atendimento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { vinculoId: 'v1', data: new Date(`${DIA}T12:00:00`), hora: '14:00', situacao: 'AGENDADO', avulso: true },
      }),
    )
    expect(registrarMock).toHaveBeenCalledWith('adm', 'MARCOU_CONSULTA', 'Aluno A com Dra. Ana em 12/01 às 14:00')
  })

  it('reaproveita o vínculo aberto', async () => {
    prismaMock.vinculo.findFirst.mockResolvedValue({ id: 'v9' })
    await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })
    expect(prismaMock.vinculo.create).not.toHaveBeenCalled()
    expect(prismaMock.atendimento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vinculoId: 'v9' }) }),
    )
  })

  it('o profissional dono marca para si', async () => {
    authMock.mockResolvedValue({ user: { id: 'psi', perfil: 'PROFISSIONAL' } })
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(201)
  })

  it('o profissional não marca para outro profissional', async () => {
    authMock.mockResolvedValue({ user: { id: 'outro', perfil: 'PROFISSIONAL' } })
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(403)
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
  })

  it('profissional de agenda fixa é recusado, até para a direção', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'fis', nome: 'Fisio', tipoAgenda: 'FIXA', areaId: 'ar2' })
    expect((await marcar({ profissionalId: 'fis', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(403)
    authMock.mockResolvedValue({ user: { id: 'fis', perfil: 'PROFISSIONAL' } })
    expect((await marcar({ profissionalId: 'fis', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(403)
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
  })

  it('a secretaria é recusada e nada é lido', async () => {
    authMock.mockResolvedValue({ user: { id: 'sec', perfil: 'SECRETARIA' } })
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(403)
    expect(prismaMock.usuario.findFirst).not.toHaveBeenCalled()
  })

  it('sem sessão: 401', async () => {
    authMock.mockResolvedValue(null)
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(401)
  })

  it('profissional sem área: 400', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'psi', nome: 'Dra. Ana', tipoAgenda: 'AVULSA_DIRECAO', areaId: null })
    const r = await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('Este profissional está sem área. Ajuste em Profissionais.')
  })

  it('exige exatamente uma pessoa: aluno ou nova pessoa', async () => {
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00' })).status).toBe(400)
    expect(
      (await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1', novaPessoa: { nome: 'Fulana de Tal' } })).status,
    ).toBe(400)
  })

  it('confere dia e hora', async () => {
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '25:00', alunoId: 'al1' })).status).toBe(400)
    expect((await marcar({ profissionalId: 'psi', data: '2099-02-31', hora: '10:00', alunoId: 'al1' })).status).toBe(400)
  })

  it('o profissional não lança além de 30 dias atrás; a direção lança', async () => {
    authMock.mockResolvedValue({ user: { id: 'psi', perfil: 'PROFISSIONAL' } })
    expect((await marcar({ profissionalId: 'psi', data: '2020-01-10', hora: '10:00', alunoId: 'al1' })).status).toBe(400)
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    expect((await marcar({ profissionalId: 'psi', data: '2020-01-10', hora: '10:00', alunoId: 'al1' })).status).toBe(201)
  })

  it('aluno do centro desligado é recusado', async () => {
    prismaMock.aluno.findFirst.mockResolvedValue({ id: 'al1', nome: 'Aluno A', situacao: 'DESLIGADO', deFora: false })
    expect((await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })).status).toBe(400)
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
  })

  it('conflito de dia e hora: 409', async () => {
    prismaMock.atendimento.findFirst.mockResolvedValueOnce({ id: 'outra' })
    const r = await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toBe('Já existe consulta nesse dia e horário.')
    expect(prismaMock.atendimento.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ situacao: { in: ['AGENDADO', 'REALIZADO'] }, vinculo: { profissionalId: 'psi' } }),
      }),
    )
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
  })

  it('consulta cancelada no mesmo dia e hora volta a valer em vez de criar outra', async () => {
    prismaMock.atendimento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'velha' })
    prismaMock.atendimento.update.mockResolvedValue({ id: 'velha' })
    const r = await marcar({ profissionalId: 'psi', data: DIA, hora: '14:00', alunoId: 'al1' })
    expect(r.status).toBe(201)
    expect(prismaMock.atendimento.create).not.toHaveBeenCalled()
    expect(prismaMock.atendimento.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'velha' }, data: { avulso: true, situacao: 'AGENDADO', observacao: null } }),
    )
  })

  it('nova pessoa de fora: cria com matrícula EXT, situação ATENDIMENTO, e registra só o nome', async () => {
    const ano = new Date().getFullYear()
    prismaMock.aluno.findFirst.mockResolvedValue({ matricula: `EXT-${ano}-0007` })
    prismaMock.aluno.create.mockResolvedValue({ id: 'novo', nome: 'Maria da Silva', matricula: `EXT-${ano}-0008` })
    const r = await marcar({
      profissionalId: 'psi',
      data: DIA,
      hora: '09:30',
      novaPessoa: { nome: 'Maria da Silva', whatsapp: '(77) 99999-0000', ligadoAoAluno: 'mãe de um aluno' },
    })
    expect(r.status).toBe(201)
    expect(prismaMock.aluno.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matricula: { startsWith: `EXT-${ano}-` } } }),
    )
    expect(prismaMock.aluno.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: 'Maria da Silva',
        matricula: `EXT-${ano}-0008`,
        deFora: true,
        situacao: 'ATENDIMENTO',
        ligadoAoAluno: 'mãe de um aluno',
      }),
    })
    expect(registrarMock).toHaveBeenCalledWith('adm', 'CADASTROU_PESSOA_DE_FORA', 'Maria da Silva')
    expect(registrarMock).toHaveBeenCalledWith('adm', 'MARCOU_CONSULTA', 'Maria da Silva com Dra. Ana em 12/01 às 09:30')
    expect(prismaMock.vinculo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { alunoId: 'novo', profissionalId: 'psi', areaId: 'ar1' } }),
    )
  })

  it('nova pessoa sem nome: 400 e nada é criado', async () => {
    const r = await marcar({ profissionalId: 'psi', data: DIA, hora: '09:30', novaPessoa: { nome: 'ab' } })
    expect(r.status).toBe(400)
    expect(prismaMock.aluno.create).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/consultas/[id]', () => {
  const consulta = (extra: Record<string, unknown> = {}) => ({
    id: 'c1',
    data: new Date('2099-01-12T12:00:00Z'),
    hora: '14:00',
    situacao: 'AGENDADO',
    registroConsulta: null,
    vinculo: { profissionalId: 'psi', profissional: { nome: 'Dra. Ana' }, aluno: { nome: 'Aluno A' } },
    ...extra,
  })

  beforeEach(() => {
    vi.resetAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.atendimento.findFirst.mockResolvedValue(consulta())
    prismaMock.atendimento.update.mockResolvedValue({})
  })

  it('desmarca consulta agendada e sem registro', async () => {
    const r = await desmarcar()
    expect(r.status).toBe(200)
    expect(prismaMock.atendimento.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1', avulso: true } }))
    expect(prismaMock.atendimento.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { situacao: 'CANCELADO', observacao: 'Consulta desmarcada' },
    })
    expect(registrarMock).toHaveBeenCalledWith('adm', 'DESMARCOU_CONSULTA', 'Aluno A com Dra. Ana em 12/01 às 14:00')
  })

  it('o profissional dono desmarca; outro profissional não', async () => {
    authMock.mockResolvedValue({ user: { id: 'psi', perfil: 'PROFISSIONAL' } })
    expect((await desmarcar()).status).toBe(200)
    authMock.mockResolvedValue({ user: { id: 'outro', perfil: 'PROFISSIONAL' } })
    expect((await desmarcar()).status).toBe(403)
  })

  it('a secretaria é recusada', async () => {
    authMock.mockResolvedValue({ user: { id: 'sec', perfil: 'SECRETARIA' } })
    expect((await desmarcar()).status).toBe(403)
    expect(prismaMock.atendimento.update).not.toHaveBeenCalled()
  })

  it('não desmarca o que já foi realizado, faltou ou tem registro', async () => {
    prismaMock.atendimento.findFirst.mockResolvedValue(consulta({ situacao: 'REALIZADO' }))
    expect((await desmarcar()).status).toBe(409)
    prismaMock.atendimento.findFirst.mockResolvedValue(consulta({ registroConsulta: { id: 'rc1' } }))
    expect((await desmarcar()).status).toBe(409)
    expect(prismaMock.atendimento.update).not.toHaveBeenCalled()
  })

  it('consulta que não existe (ou não é avulsa): 404', async () => {
    prismaMock.atendimento.findFirst.mockResolvedValue(null)
    expect((await desmarcar()).status).toBe(404)
  })
})

describe('GET /api/consultas/pessoas', () => {
  const buscar = (qs: string) => PESSOAS(new Request(`http://localhost/api/consultas/pessoas?${qs}`))

  beforeEach(() => {
    vi.resetAllMocks()
    prismaMock.aluno.findMany.mockResolvedValue([])
  })

  it('secretaria e profissional de agenda fixa: 403', async () => {
    authMock.mockResolvedValue({ user: { id: 'sec', perfil: 'SECRETARIA' } })
    expect((await buscar('modo=fora')).status).toBe(403)
    authMock.mockResolvedValue({ user: { id: 'fis', perfil: 'PROFISSIONAL' } })
    prismaMock.usuario.findUnique.mockResolvedValue({ tipoAgenda: 'FIXA' })
    expect((await buscar('modo=fora')).status).toBe(403)
    expect(prismaMock.aluno.findMany).not.toHaveBeenCalled()
  })

  it('devolve só id, nome, matrícula e se é de fora', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.aluno.findMany.mockResolvedValue([
      { id: 'p1', nome: 'Pessoa Um', matricula: 'EXT-2026-0001', deFora: true, whatsapp: '77999990000' },
    ])
    const r = await buscar('modo=fora')
    expect(r.status).toBe(200)
    expect((await r.json()).pessoas).toEqual([{ id: 'p1', nome: 'Pessoa Um', matricula: 'EXT-2026-0001', deFora: true }])
  })

  it('o profissional vê só quem tem vínculo com ele', async () => {
    authMock.mockResolvedValue({ user: { id: 'psi', perfil: 'PROFISSIONAL' } })
    prismaMock.usuario.findUnique.mockResolvedValue({ tipoAgenda: 'AVULSA_PROPRIA' })
    await buscar('modo=acompanhados')
    const where = JSON.stringify(prismaMock.aluno.findMany.mock.calls[0][0].where)
    expect(where).toContain('"id":"psi"')
    expect(where).toContain('"fim":null')
  })

  it('modo inválido: 400', async () => {
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    expect((await buscar('modo=todos')).status).toBe(400)
  })
})
