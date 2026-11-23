import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, authMock, registrarMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() },
    area: { findUnique: vi.fn() },
    vinculo: { count: vi.fn() },
  },
  authMock: vi.fn(),
  registrarMock: vi.fn(),
}))

vi.mock('@/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/registro', () => ({ registrarAcesso: registrarMock }))

import { PATCH } from '@/app/api/usuarios/[id]/route'
import { POST } from '@/app/api/usuarios/route'
import { motivoParaNaoTrocarTipoAgenda, seloDoNome, seloTipoAgenda } from '@/domain/tipoAgenda'

const editar = (corpo: unknown) =>
  PATCH(
    new Request('http://localhost/api/usuarios/u1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id: 'u1' }) },
  )

const base = { nome: 'Profissional Teste', usuario: 'teste.psi' }
const dadosGravados = () => (prismaMock.usuario.update.mock.calls[0][0] as { data: Record<string, unknown> }).data

describe('PATCH /api/usuarios/[id] — tipo de agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.usuario.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'u1'
        ? { id: 'u1', nome: 'Profissional Teste', usuario: 'teste.psi', perfil: 'PROFISSIONAL', tipoAgenda: 'FIXA' }
        : null,
    )
    prismaMock.usuario.update.mockResolvedValue({})
  })

  it('a direção muda para agenda própria com lembrete e o Histórico registra', async () => {
    const r = await editar({ ...base, tipoAgenda: 'AVULSA_DIRECAO' })
    expect(r.status).toBe(200)
    expect(dadosGravados().tipoAgenda).toBe('AVULSA_DIRECAO')
    const acoes = registrarMock.mock.calls.map((c) => c[1])
    expect(acoes).toContain('MUDOU_TIPO_AGENDA')
  })

  it('valor fora da lista é recusado e nada é gravado', async () => {
    const r = await editar({ ...base, tipoAgenda: 'QUALQUER' })
    expect(r.status).toBe(400)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('sem tipoAgenda no corpo, mantém o que já existe e não registra mudança', async () => {
    const r = await editar(base)
    expect(r.status).toBe(200)
    expect(dadosGravados().tipoAgenda).toBe('FIXA')
    expect(registrarMock.mock.calls.map((c) => c[1])).not.toContain('MUDOU_TIPO_AGENDA')
  })

  it('só a direção pode editar', async () => {
    authMock.mockResolvedValue({ user: { id: 'p9', perfil: 'PROFISSIONAL' } })
    expect((await editar({ ...base, tipoAgenda: 'AVULSA_PROPRIA' })).status).toBe(403)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('tipo de agenda diferente de FIXA não vale para quem não é profissional', async () => {
    prismaMock.usuario.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'u1'
        ? { id: 'u1', nome: 'Secretaria Teste', usuario: 'teste.sec', perfil: 'SECRETARIA', tipoAgenda: 'FIXA' }
        : null,
    )
    const r = await editar({ nome: 'Secretaria Teste', usuario: 'teste.sec', tipoAgenda: 'AVULSA_DIRECAO' })
    expect(r.status).toBe(400)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })
})

describe('regras do tipo de agenda', () => {
  it('só profissional pode ter agenda avulsa', () => {
    expect(motivoParaNaoTrocarTipoAgenda('PROFISSIONAL', 'AVULSA_PROPRIA')).toBeNull()
    expect(motivoParaNaoTrocarTipoAgenda('ADMIN', 'AVULSA_PROPRIA')).not.toBeNull()
    expect(motivoParaNaoTrocarTipoAgenda('SECRETARIA', 'FIXA')).toBeNull()
  })

  it('a lista de Profissionais só leva selo quando a agenda não é fixa', () => {
    expect(seloTipoAgenda('FIXA')).toBeNull()
    expect(seloTipoAgenda('AVULSA_DIRECAO')).toBe('Agenda própria')
    expect(seloTipoAgenda('AVULSA_PROPRIA')).toBe('Agenda própria')
  })

  it('ao lado do nome: Direção, Secretaria ou Agenda própria; agenda fixa sem selo', () => {
    expect(seloDoNome('ADMIN', 'FIXA')).toBe('Direção')
    expect(seloDoNome('SECRETARIA', 'FIXA')).toBe('Secretaria')
    expect(seloDoNome('PROFISSIONAL', 'AVULSA_DIRECAO')).toBe('Agenda própria')
    expect(seloDoNome('PROFISSIONAL', 'FIXA')).toBeNull()
  })
})

describe('POST /api/usuarios — tipo de agenda já no cadastro', () => {
  const criar = (corpo: unknown) =>
    POST(
      new Request('http://localhost/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }),
    )
  const novo = { nome: 'Profissional Novo', usuario: 'novo.psiq', senha: 'provisoria1', perfil: 'PROFISSIONAL' }
  const gravado = () => (prismaMock.usuario.create.mock.calls[0][0] as { data: Record<string, unknown> }).data

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'adm', perfil: 'ADMIN' } })
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    prismaMock.usuario.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'u9',
      ...data,
    }))
  })

  it('a direção cadastra já com agenda própria com lembrete, e o Histórico conta', async () => {
    const r = await criar({ ...novo, tipoAgenda: 'AVULSA_DIRECAO' })
    expect(r.status).toBe(201)
    expect(gravado().tipoAgenda).toBe('AVULSA_DIRECAO')
    expect(registrarMock.mock.calls[0][2]).toMatch(/agenda própria, com lembrete/)
  })

  it('sem escolher, fica agenda fixa', async () => {
    expect((await criar(novo)).status).toBe(201)
    expect(gravado().tipoAgenda).toBe('FIXA')
  })

  it('valor fora da lista é recusado', async () => {
    expect((await criar({ ...novo, tipoAgenda: 'QUALQUER' })).status).toBe(400)
    expect(prismaMock.usuario.create).not.toHaveBeenCalled()
  })

  it('secretaria ou direção não recebem agenda avulsa', async () => {
    expect((await criar({ ...novo, perfil: 'SECRETARIA', tipoAgenda: 'AVULSA_PROPRIA' })).status).toBe(400)
    expect(prismaMock.usuario.create).not.toHaveBeenCalled()
  })
})
