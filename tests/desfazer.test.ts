import { describe, it, expect } from 'vitest'
import {
  camposDoHorario, comCampos, conferirDesfazer, lerMudanca, mesmosCampos,
  type CamposHorario, type MudancaHorarios,
} from '@/domain/desfazer'

const antes: CamposHorario = { diaSemana: 5, hora: '15:40', semanas: 0b0101 }
const depois: CamposHorario = { ...antes, semanas: 0b0001 }
const mudanca: MudancaHorarios = { horarios: [{ id: 'h1', antes, depois }] }

describe('camposDoHorario', () => {
  it('guarda só dia, hora e semanas', () => {
    expect(camposDoHorario({ diaSemana: 2, hora: '08:10', semanas: 3 })).toEqual({ diaSemana: 2, hora: '08:10', semanas: 3 })
  })
})

describe('mesmosCampos', () => {
  it('reconhece igual e diferente', () => {
    expect(mesmosCampos(antes, { ...antes })).toBe(true)
    expect(mesmosCampos(antes, depois)).toBe(false)
    expect(mesmosCampos(antes, { ...antes, hora: '15:00' })).toBe(false)
  })
})

describe('lerMudanca', () => {
  it('aceita o formato certo', () => {
    expect(lerMudanca(JSON.parse(JSON.stringify(mudanca)))).toEqual(mudanca)
  })
  it('recusa lixo, lista vazia e campo faltando', () => {
    expect(lerMudanca(null)).toBeNull()
    expect(lerMudanca({})).toBeNull()
    expect(lerMudanca({ horarios: [] })).toBeNull()
    expect(lerMudanca({ horarios: [{ id: 'x', antes, depois: { hora: '10:00' } }] })).toBeNull()
  })
  it('recusa o formato de antes das semanas (grupo/ciclo)', () => {
    const velho = { diaSemana: 2, hora: '08:10', grupo: null, emGrupo: false, cicloSemanas: 1, cicloOffset: 0, semanaReferencia: null }
    expect(lerMudanca({ horarios: [{ id: 'x', antes: velho, depois: velho }] })).toBeNull()
  })
})

describe('comCampos', () => {
  it('aplica dia, hora e semanas sobre o horário completo', () => {
    expect(comCampos({ id: 'h1', diaSemana: 1, hora: '07:30', semanas: 1 }, antes))
      .toEqual({ id: 'h1', diaSemana: 5, hora: '15:40', semanas: 0b0101 })
  })
})

describe('conferirDesfazer', () => {
  it('libera quando o horário ainda está como a mudança deixou', () => {
    expect(conferirDesfazer(mudanca, new Map([['h1', depois]]))).toEqual({ ok: true })
  })
  it('recusa quando já mudou de novo', () => {
    expect(conferirDesfazer(mudanca, new Map([['h1', { ...depois, hora: '15:00' }]])).ok).toBe(false)
  })
  it('recusa quando o horário sumiu (atendimento encerrado)', () => {
    expect(conferirDesfazer(mudanca, new Map()).ok).toBe(false)
  })
})
