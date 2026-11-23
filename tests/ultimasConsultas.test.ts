import { describe, it, expect } from 'vitest'
import { ultimasConsultas, type ConsultaAnterior } from '@/domain/consultas'

const c = (id: string, autorId: string, dia: string, hora = '09:00', extra: Partial<ConsultaAnterior> = {}): ConsultaAnterior => ({
  id,
  autorId,
  autorNome: autorId,
  criadoEm: new Date(`${dia}T18:00:00Z`),
  data: new Date(`${dia}T12:00:00Z`),
  hora,
  tipo: 'CONSULTA_NO_CENTRO',
  situacao: 'REALIZADO',
  presentes: null,
  registro: `registro ${id}`,
  encaminhamentos: [],
  proximoPasso: null,
  ...extra,
})

const itens = [
  c('a', 'p1', '2026-09-01'),
  c('b', 'p1', '2026-09-15'),
  c('c', 'p1', '2026-10-01'),
  c('d', 'p1', '2026-10-15'),
  c('e', 'p2', '2026-10-20'),
  c('f', 'p1', '2026-11-10'),
]

const base = {
  transferencias: [],
  antesDe: { data: new Date('2026-11-03T12:00:00Z'), hora: '09:00' },
}

describe('ultimasConsultas', () => {
  it('só as anteriores à consulta aberta, no máximo 3, da mais recente para a mais antiga', () => {
    const r = ultimasConsultas(itens, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect(r.map((x) => x.id)).toEqual(['d', 'c', 'b'])
  })

  it('não mostra consulta de outro profissional sem transferência', () => {
    const r = ultimasConsultas(itens, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' }, limite: 10 })
    expect(r.map((x) => x.id)).not.toContain('e')
  })

  it('quem recebeu a pessoa por transferência vê as anteriores à transferência', () => {
    const r = ultimasConsultas(itens, {
      ...base,
      sessao: { id: 'p3', perfil: 'PROFISSIONAL' },
      transferencias: [{ paraProfissionalId: 'p3', criadoEm: new Date('2026-10-18T12:00:00Z') }],
    })
    // d (escrita em 15/10, antes da transferência) entra; e (20/10, depois) não
    expect(r.map((x) => x.id)).toEqual(['d', 'c', 'b'])
  })

  it('a direção vê todas as que a consulta devolveu', () => {
    const r = ultimasConsultas(itens, { ...base, sessao: { id: 'adm', perfil: 'ADMIN' }, limite: 10 })
    expect(r.map((x) => x.id)).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('no mesmo dia, conta o horário', () => {
    const doDia = [c('m', 'p1', '2026-11-03', '07:20'), c('n', 'p1', '2026-11-03', '09:00'), c('o', 'p1', '2026-11-03', '15:00')]
    const r = ultimasConsultas(doDia, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect(r.map((x) => x.id)).toEqual(['m'])
  })

  it('ignora as que não têm texto de registro (ex.: faltou sem registro)', () => {
    const r = ultimasConsultas([c('z', 'p1', '2026-10-30', '09:00', { registro: '  ', situacao: 'FALTOU' }), c('y', 'p1', '2026-10-01')], {
      ...base,
      sessao: { id: 'p1', perfil: 'PROFISSIONAL' },
    })
    expect(r.map((x) => x.id)).toEqual(['y'])
  })

  it('primeira vez: lista vazia', () => {
    expect(ultimasConsultas([], { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })).toEqual([])
  })
})
