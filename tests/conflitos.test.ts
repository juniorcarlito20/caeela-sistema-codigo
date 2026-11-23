import { describe, it, expect } from 'vitest'
import {
  detectarConflito, horariosLivres, diaTotalmenteIndisponivel, diaSemAtendimento, listarConflitos,
  conflitosNovos, type Ocupacao,
} from '@/domain/conflitos'

const gradeDe = (horas: string[]) =>
  [1, 2, 3, 4, 5].flatMap((diaSemana) => horas.map((hora) => ({ diaSemana, hora, duracaoMin: 40 })))

const SEG_28_09 = new Date(2026, 8, 28)
const base: Ocupacao = { profissionalId: 'p1', alunoId: 'a1', diaSemana: 2, hora: '08:50' }
// Profissional de 2 semanas: S1 = 0b01, S2 = 0b10, as duas = 0b11.
const q = (semanas: number): Partial<Ocupacao> => ({ semanas, semanasNoCiclo: 2, cicloInicio: SEG_28_09 })

describe('detectarConflito', () => {
  it('recusa profissional já ocupado no horário', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2' }, [base]))
      .toBe('Este profissional já tem atendimento nesse dia e horário.')
  })
  it('recusa aluno em duas terapias ao mesmo tempo', () => {
    expect(detectarConflito({ ...base, profissionalId: 'p2' }, [base]))
      .toBe('Este aluno já tem atendimento nesse dia e horário.')
  })
  it('aceita horário livre', () => {
    expect(detectarConflito({ ...base, hora: '09:30' }, [base])).toBeNull()
  })
  it('não existe mais atendimento simultâneo: dois alunos na mesma semana sempre batem', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2', ...q(0b01) }, [{ ...base, ...q(0b01) }]))
      .toBe('Este profissional já tem atendimento nesse dia e horário.')
  })
  it('dois alunos em semanas diferentes do mesmo horário NÃO batem', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2', ...q(0b10) }, [{ ...base, ...q(0b01) }])).toBeNull()
  })
  it('aluno de toda semana bate com quem está em uma semana só', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2', ...q(0b11) }, [{ ...base, ...q(0b01) }]))
      .toBe('Este profissional já tem atendimento nesse dia e horário.')
  })
})

describe('horariosLivres', () => {
  it('lista horários livres do profissional', () => {
    const grade = ['07:30', '08:10', '08:50']
    const livres = horariosLivres('p1', [base], gradeDe(grade))
    expect(livres).toContainEqual({ diaSemana: 2, hora: '07:30' })
    expect(livres).not.toContainEqual({ diaSemana: 2, hora: '08:50' })
    expect(livres.length).toBe(5 * grade.length - 1)
  })
  it('não lista como livre horário marcado indisponível, mesmo sem ocupação', () => {
    const livres = horariosLivres('p1', [], gradeDe(['07:30', '08:10']), new Set(['2-07:30']))
    expect(livres).not.toContainEqual({ diaSemana: 2, hora: '07:30' })
    expect(livres).toContainEqual({ diaSemana: 2, hora: '08:10' })
  })
  it('lista como livres só os horários que o profissional tem, no dia que ele tem', () => {
    const slots = [
      { diaSemana: 1, hora: '07:00', duracaoMin: 60 },
      { diaSemana: 1, hora: '08:00', duracaoMin: 60 },
      { diaSemana: 3, hora: '08:30', duracaoMin: 30 },
    ]
    const ocupado: Ocupacao = { profissionalId: 'p1', alunoId: 'a1', diaSemana: 1, hora: '08:00' }
    expect(horariosLivres('p1', [ocupado], slots)).toEqual([
      { diaSemana: 1, hora: '07:00' },
      { diaSemana: 3, hora: '08:30' },
    ])
  })
})

describe('dia indisponível ou sem atendimento', () => {
  it('é true quando todos os horários do dia estão marcados', () => {
    expect(diaTotalmenteIndisponivel(2, new Set(['2-07:30', '2-08:10']), gradeDe(['07:30', '08:10']))).toBe(true)
  })
  it('é false quando falta pelo menos um horário do dia', () => {
    expect(diaTotalmenteIndisponivel(2, new Set(['2-07:30']), gradeDe(['07:30', '08:10']))).toBe(false)
  })
  it('é false quando nada está marcado', () => {
    expect(diaTotalmenteIndisponivel(2, new Set(), gradeDe(['07:30']))).toBe(false)
  })
  it('dia sem nenhum horário é dia sem atendimento', () => {
    const slots = [{ diaSemana: 1, hora: '07:00', duracaoMin: 60 }]
    expect(diaSemAtendimento(2, new Set(), slots)).toBe(true)
    expect(diaSemAtendimento(1, new Set(), slots)).toBe(false)
    expect(diaSemAtendimento(1, new Set(['1-07:00']), slots)).toBe(true)
    expect(diaTotalmenteIndisponivel(2, new Set(), slots)).toBe(false)
  })
})

describe('mesma criança com durações diferentes', () => {
  const crianca = (profissionalId: string, hora: string, duracaoMin: number): Ocupacao => ({
    profissionalId, alunoId: 'a1', diaSemana: 2, hora, duracaoMin,
  })
  it('recusa quando um atendimento invade o outro (09:00 de 60 min e 09:30)', () => {
    expect(detectarConflito(crianca('p2', '09:30', 30), [crianca('p1', '09:00', 60)]))
      .toBe('Este aluno já tem atendimento nesse dia e horário.')
  })
  it('aceita um logo depois do outro (09:00 de 45 min e 09:45)', () => {
    expect(detectarConflito(crianca('p2', '09:45', 60), [crianca('p1', '09:00', 45)])).toBeNull()
  })
  it('sem duração conhecida, continua comparando só o horário de início', () => {
    const a: Ocupacao = { profissionalId: 'p1', alunoId: 'a1', diaSemana: 2, hora: '09:00' }
    const b: Ocupacao = { profissionalId: 'p2', alunoId: 'a1', diaSemana: 2, hora: '09:30' }
    expect(detectarConflito(b, [a])).toBeNull()
  })
  it('a agenda inteira também acusa a criança que ficou em dois lugares ao mesmo tempo', () => {
    const lista = [{ id: 'x', ...crianca('p1', '09:00', 60) }, { id: 'y', ...crianca('p2', '09:30', 30) }]
    expect(listarConflitos(lista).map((p) => p.motivo)).toEqual(['ALUNO'])
  })
})

describe('listarConflitos (agenda inteira)', () => {
  const h = (id: string, o: Partial<Ocupacao> = {}) => ({
    id, profissionalId: 'p1', alunoId: 'a1', diaSemana: 2, hora: '09:30', ...o,
  })
  it('agenda sem choque não devolve nada', () => {
    expect(listarConflitos([h('1'), h('2', { alunoId: 'a2', profissionalId: 'p2', hora: '10:10' })])).toEqual([])
  })
  it('mesma criança com dois profissionais no mesmo dia e hora', () => {
    const r = listarConflitos([h('1'), h('2', { profissionalId: 'p2' })])
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('ALUNO')
    expect([r[0].a.id, r[0].b.id].sort()).toEqual(['1', '2'])
  })
  it('dois alunos com o mesmo profissional no mesmo horário e semana', () => {
    const r = listarConflitos([h('1'), h('2', { alunoId: 'a2' })])
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('PROFISSIONAL')
  })
  it('semanas alternadas não conflitam, mesmo no mesmo horário', () => {
    expect(listarConflitos([h('1', q(0b01)), h('2', { alunoId: 'a2', ...q(0b10) })])).toEqual([])
  })
  it('criança em semanas que se cruzam entre profissionais com contagens diferentes', () => {
    // p2 tem 4 semanas começando uma semana depois: a Semana 1 dele é a Semana 2 de p1
    const outro = { profissionalId: 'p2', semanas: 0b0001, semanasNoCiclo: 4, cicloInicio: new Date(2026, 9, 5) }
    expect(listarConflitos([h('1', q(0b10)), h('2', outro)]).map((p) => p.motivo)).toEqual(['ALUNO'])
    expect(listarConflitos([h('1', q(0b01)), h('2', outro)])).toEqual([])
  })
  it('dia ou hora diferentes nunca conflitam', () => {
    expect(listarConflitos([h('1'), h('2', { profissionalId: 'p2', hora: '10:10' }), h('3', { profissionalId: 'p3', diaSemana: 3 })])).toEqual([])
  })
  it('cada par aparece uma vez só', () => {
    expect(listarConflitos([h('1'), h('2', { profissionalId: 'p2' }), h('3', { profissionalId: 'p3' })])).toHaveLength(3)
  })
})

describe('conflitosNovos', () => {
  const h = (id: string, o: Partial<Ocupacao> = {}) => ({
    id, profissionalId: 'p1', alunoId: 'a1', diaSemana: 2, hora: '09:30', ...o,
  })
  it('ignora o conflito que já existia e acusa só o novo', () => {
    const antes = [h('1'), h('2', { profissionalId: 'p2' }), h('3', { alunoId: 'a9', diaSemana: 3 })]
    const depois = [h('1'), h('2', { profissionalId: 'p2' }), h('3', { alunoId: 'a1', diaSemana: 2, profissionalId: 'p3' })]
    const novos = conflitosNovos(antes, depois)
    expect(novos).toHaveLength(2)
    expect(novos.every((p) => p.a.id === '3' || p.b.id === '3')).toBe(true)
  })
  it('nada de novo quando a mudança não cria choque', () => {
    const antes = [h('1'), h('2', { profissionalId: 'p2' })]
    expect(conflitosNovos(antes, antes)).toEqual([])
  })
  it('ligar uma semana que outro aluno já usa cria choque', () => {
    const antes = [h('1', q(0b01)), h('2', { alunoId: 'a2', ...q(0b10) })]
    const depois = [h('1', q(0b11)), h('2', { alunoId: 'a2', ...q(0b10) })]
    expect(conflitosNovos(antes, depois).map((p) => p.motivo)).toEqual(['PROFISSIONAL'])
  })
})

describe('horário de grupo (vagas)', () => {
  // `base` é um aluno de p1 na terça 08:50; `q(...)` põe o profissional em 2 semanas.
  const g = (alunoId: string, extra: Partial<Ocupacao> = {}): Ocupacao => ({ ...base, alunoId, vagas: 2, ...extra })

  it('cabe mais de um aluno até o limite de vagas', () => {
    expect(detectarConflito(g('a2'), [g('a1')])).toBeNull()
  })
  it('recusa quando as vagas acabam, e a mensagem fala das vagas', () => {
    expect(detectarConflito(g('a3'), [g('a1'), g('a2')]))
      .toBe('Este horário já está com todas as vagas ocupadas nessa semana.')
  })
  it('sem vagas informadas o horário continua individual, com a mensagem de sempre', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2' }, [base]))
      .toBe('Este profissional já tem atendimento nesse dia e horário.')
  })
  it('as vagas contam semana a semana', () => {
    const existentes = [g('a1', q(0b01)), g('a2', q(0b10))]
    expect(detectarConflito(g('a3', q(0b01)), existentes)).toBeNull()
    expect(detectarConflito(g('a3', q(0b11)), existentes)).toBeNull()
    expect(detectarConflito(g('a3', q(0b01)), [g('a1', q(0b01)), g('a4', q(0b01))])).not.toBeNull()
    expect(detectarConflito(g('a3', q(0b10)), [g('a1', q(0b01)), g('a4', q(0b01))])).toBeNull()
  })
  it('a mesma criança continua sem poder estar em dois lugares', () => {
    expect(detectarConflito(g('a1', { profissionalId: 'p2' }), [g('a1')]))
      .toBe('Este aluno já tem atendimento nesse dia e horário.')
  })
  it('a capacidade do horário é o maior número de vagas que os atendimentos dele declaram', () => {
    expect(detectarConflito({ ...base, alunoId: 'a2' }, [g('a1')])).toBeNull()
  })

  it('horariosLivres: horário de grupo com vaga sobrando ainda é livre', () => {
    const slots = [
      { diaSemana: 2, hora: '08:50', duracaoMin: 40, vagas: 2 },
      { diaSemana: 2, hora: '09:30', duracaoMin: 40 },
    ]
    const ocupados = [g('a1'), { ...base, alunoId: 'a2', hora: '09:30' }]
    expect(horariosLivres('p1', ocupados, slots).map((l) => l.hora)).toEqual(['08:50'])
    expect(horariosLivres('p1', [g('a1'), g('a2')], slots).map((l) => l.hora)).toEqual(['09:30'])
  })

  it('listarConflitos: só acusa quando passa das vagas, com todos os pares', () => {
    const h = (id: string, alunoId: string, extra: Partial<Ocupacao> = {}) => ({ ...g(alunoId, extra), id })
    expect(listarConflitos([h('1', 'a1'), h('2', 'a2')])).toEqual([])
    const pares = listarConflitos([h('1', 'a1'), h('2', 'a2'), h('3', 'a3')])
    expect(pares).toHaveLength(3)
    expect(pares.every((p) => p.motivo === 'PROFISSIONAL')).toBe(true)
  })
  it('listarConflitos: cada par aparece uma vez, mesmo em várias semanas', () => {
    const h = (id: string, alunoId: string) => ({ ...g(alunoId, { vagas: 1, ...q(0b11) }), id })
    expect(listarConflitos([h('1', 'a1'), h('2', 'a2')])).toHaveLength(1)
  })
  it('conflitosNovos: a segunda criança cabe; a terceira cria choque', () => {
    const h = (id: string, alunoId: string) => ({ ...g(alunoId), id })
    expect(conflitosNovos([h('1', 'a1')], [h('1', 'a1'), h('2', 'a2')])).toEqual([])
    expect(conflitosNovos([h('1', 'a1'), h('2', 'a2')], [h('1', 'a1'), h('2', 'a2'), h('3', 'a3')]).length).toBeGreaterThan(0)
  })
  it('baixar as vagas com o horário cheio cria choque novo (o editor de horários usa isso)', () => {
    const h = (id: string, alunoId: string, vagas: number) => ({ ...g(alunoId, { vagas }), id })
    const antes = [h('1', 'a1', 2), h('2', 'a2', 2)]
    const depois = [h('1', 'a1', 1), h('2', 'a2', 1)]
    expect(conflitosNovos(antes, depois).length).toBeGreaterThan(0)
  })
})
