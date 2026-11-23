import { describe, it, expect } from 'vitest'
import { filtrarEvolucoesVisiveis, ultimasEvolucoes } from '@/domain/evolucao'

const evolucoes = [
  { id: 'e1', autorId: 'p1', atividade: 'Casinha', objetivo: 'Ampliar vocabulário' },
  { id: 'e2', autorId: 'p2', atividade: 'Cubo', objetivo: 'Verbalizar estratégias' },
]

describe('evoluções visíveis', () => {
  it('profissional vê só as suas', () => {
    const r = filtrarEvolucoesVisiveis({ id: 'p1', perfil: 'PROFISSIONAL' }, evolucoes)
    expect(r.map((e) => e.id)).toEqual(['e1'])
  })
  it('admin vê todas', () => {
    const r = filtrarEvolucoesVisiveis({ id: 'x', perfil: 'ADMIN' }, evolucoes)
    expect(r).toHaveLength(2)
  })
  it('lista vazia devolve lista vazia para os dois perfis', () => {
    expect(
      filtrarEvolucoesVisiveis({ id: 'p1', perfil: 'PROFISSIONAL' }, []),
    ).toEqual([])
    expect(filtrarEvolucoesVisiveis({ id: 'x', perfil: 'ADMIN' }, [])).toEqual([])
  })
  it('profissional com duas entre quatro vê só as duas', () => {
    const quatro = [
      ...evolucoes,
      { id: 'e3', autorId: 'p1', atividade: 'Bola', objetivo: 'Esperar a vez' },
      { id: 'e4', autorId: 'p3', atividade: 'Massa', objetivo: 'Coordenação' },
    ]
    const r = filtrarEvolucoesVisiveis({ id: 'p1', perfil: 'PROFISSIONAL' }, quatro)
    expect(r.map((e) => e.id)).toEqual(['e1', 'e3'])
  })
})

describe('últimas evoluções na tela de escrever a nova', () => {
  const dia = (d: string) => new Date(`${d}T12:00:00Z`)
  const ev = (id: string, autorId: string, d: string, hora = '08:00', criado = d) => ({
    id, autorId, autorNome: `Autor ${autorId}`, criadoEm: dia(criado), data: dia(d), hora,
    atividade: `Atividade ${id}`, objetivo: `Objetivo ${id}`, observacoes: null,
  })
  const itens = [
    ev('a', 'p1', '2026-10-01'),
    ev('b', 'p1', '2026-10-08'),
    ev('c', 'p1', '2026-10-15'),
    ev('d', 'p1', '2026-10-22'),
    ev('e', 'p2', '2026-10-20'),
    ev('f', 'p1', '2026-10-29'), // o próprio atendimento aberto
    ev('g', 'p1', '2026-11-05'), // depois do atendimento aberto
  ]
  const base = {
    transferencias: [],
    profissionalDoAtendimento: 'p1',
    antesDe: { data: dia('2026-10-29'), hora: '08:00' },
  }

  it('profissional vê as 3 últimas dele, da mais recente para a mais antiga, só antes do atendimento aberto', () => {
    const r = ultimasEvolucoes(itens, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect(r.map((e) => e.id)).toEqual(['d', 'c', 'b'])
  })
  it('não mostra a evolução de outro profissional sem transferência', () => {
    const r = ultimasEvolucoes(itens, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' }, limite: 10 })
    expect(r.map((e) => e.id)).not.toContain('e')
  })
  it('quem recebeu o aluno por transferência vê as anteriores à transferência', () => {
    const r = ultimasEvolucoes(itens, {
      ...base,
      profissionalDoAtendimento: 'p3',
      sessao: { id: 'p3', perfil: 'PROFISSIONAL' },
      transferencias: [{ paraProfissionalId: 'p3', criadoEm: dia('2026-10-25') }],
    })
    expect(r.map((e) => e.id)).toEqual(['d', 'e', 'c'])
  })
  it('a direção vê as do profissional daquele atendimento', () => {
    const r = ultimasEvolucoes(itens, { ...base, sessao: { id: 'adm', perfil: 'ADMIN' } })
    expect(r.map((e) => e.id)).toEqual(['d', 'c', 'b'])
  })
  it('no mesmo dia, conta o horário', () => {
    const doDia = [ev('m', 'p1', '2026-10-29', '07:20'), ev('n', 'p1', '2026-10-29', '09:00')]
    const r = ultimasEvolucoes(doDia, { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })
    expect(r.map((e) => e.id)).toEqual(['m'])
  })
  it('primeira vez: lista vazia', () => {
    expect(ultimasEvolucoes([], { ...base, sessao: { id: 'p1', perfil: 'PROFISSIONAL' } })).toEqual([])
  })
})
