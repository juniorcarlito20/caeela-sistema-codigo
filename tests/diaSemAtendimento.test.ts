import { describe, it, expect } from 'vitest'
import {
  isoDia, dataDoDia, diaDaSemana, motivoParaNaoMarcar, proximoAtendimento, diasPrevistos, semanasDoCartao, avisoEnviado,
} from '@/domain/diaSemAtendimento'

const dia = (iso: string) => dataDoDia(iso)

describe('datas do dia', () => {
  it('isoDia e dataDoDia vão e voltam', () => {
    expect(isoDia(dia('2026-10-12'))).toBe('2026-10-12')
    expect(dia('2026-10-12').getHours()).toBe(12)
  })
  it('dia da semana: 1 = segunda, 7 = domingo', () => {
    expect(diaDaSemana(dia('2026-10-12'))).toBe(1)
    expect(diaDaSemana(dia('2026-10-10'))).toBe(6)
    expect(diaDaSemana(dia('2026-10-11'))).toBe(7)
  })
})

describe('motivoParaNaoMarcar', () => {
  const hoje = '2026-10-09' // sexta
  it('dia útil de hoje em diante pode', () => {
    expect(motivoParaNaoMarcar('2026-10-09', hoje)).toBeNull()
    expect(motivoParaNaoMarcar('2026-10-12', hoje)).toBeNull()
  })
  it('fim de semana não', () => {
    expect(motivoParaNaoMarcar('2026-10-10', hoje)).toMatch(/fim de semana/)
    expect(motivoParaNaoMarcar('2026-10-11', hoje)).toMatch(/fim de semana/)
  })
  it('dia que já passou não', () => {
    expect(motivoParaNaoMarcar('2026-10-08', hoje)).toMatch(/já passou/)
  })
  it('data torta não', () => {
    expect(motivoParaNaoMarcar('2026-13-40', hoje)).toMatch(/inválido/)
    expect(motivoParaNaoMarcar('amanhã', hoje)).toMatch(/inválido/)
  })
})

describe('proximoAtendimento', () => {
  const SEG_28_09 = new Date(2026, 8, 28)
  it('semanal: a mesma data na semana seguinte', () => {
    const r = { semanasNoCiclo: 1, cicloInicio: null, semanas: 1 }
    expect(isoDia(proximoAtendimento(r, dia('2026-10-12'), new Set())!)).toBe('2026-10-19')
  })
  it('quinzenal: pula a semana em que a turma não vem', () => {
    const r = { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: 0b01 }
    expect(isoDia(proximoAtendimento(r, dia('2026-10-12'), new Set())!)).toBe('2026-10-26')
  })
  it('pula outro dia sem atendimento', () => {
    const r = { semanasNoCiclo: 1, cicloInicio: null, semanas: 1 }
    expect(isoDia(proximoAtendimento(r, dia('2026-10-12'), new Set(['2026-10-19']))!)).toBe('2026-10-26')
  })
  it('sem data nas próximas 12 semanas devolve null', () => {
    const r = { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: 0 }
    expect(proximoAtendimento(r, dia('2026-10-12'), new Set())).toBeNull()
  })
})

describe('diasPrevistos', () => {
  const inicio = new Date(2026, 9, 1)
  const fim = new Date(2026, 9, 31, 23, 59, 59)
  it('conta os dias da semana em que o profissional tem aluno', () => {
    expect(diasPrevistos(inicio, fim, new Set([1]), new Set())).toBe(4) // segundas: 5, 12, 19, 26
  })
  it('dia sem atendimento não é previsto', () => {
    expect(diasPrevistos(inicio, fim, new Set([1]), new Set(['2026-10-12']))).toBe(3)
  })
  it('fim de semana nunca conta', () => {
    expect(diasPrevistos(inicio, fim, new Set([6, 7]), new Set())).toBe(0)
  })
})

describe('semanasDoCartao', () => {
  it('numa sexta: esta semana e a que vem, de segunda a sábado', () => {
    const [esta, proxima] = semanasDoCartao(dia('2026-10-09'), new Map([['2026-10-12', 'Feriado']]))
    expect(esta.titulo).toBe('Esta semana · 05/10 a 09/10')
    expect(esta.dias.map((d) => d.iso)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(esta.dias[3].passado).toBe(true)
    expect(esta.dias[4].hoje).toBe(true)
    expect(esta.dias[4].passado).toBe(false)
    expect(esta.dias[5].sabado).toBe(true)
    expect(esta.dias[0].rotulo).toBe('Seg 05')
    expect(proxima.titulo).toBe('Semana que vem · 12/10 a 16/10')
    expect(proxima.dias[0].motivo).toBe('Feriado')
    expect(proxima.dias[1].motivo).toBeNull()
  })
  it('no sábado ou domingo começa pela semana que vem', () => {
    const [primeira, segunda] = semanasDoCartao(dia('2026-10-10'), new Map())
    expect(primeira.titulo).toBe('Semana que vem · 12/10 a 16/10')
    expect(segunda.titulo).toBe('Daqui a duas semanas · 19/10 a 23/10')
  })
})

describe('avisoEnviado', () => {
  const marcadoEm = new Date('2026-10-09T18:00:00Z')
  it('nada enviado: falta avisar', () => {
    expect(avisoEnviado(null, marcadoEm)).toBe(false)
  })
  it('lembrete enviado antes de o dia ser marcado não vale como aviso', () => {
    expect(avisoEnviado(new Date('2026-10-08T15:00:00Z'), marcadoEm)).toBe(false)
  })
  it('enviado depois de marcar vale como aviso', () => {
    expect(avisoEnviado(new Date('2026-10-09T18:05:00Z'), marcadoEm)).toBe(true)
  })
})
