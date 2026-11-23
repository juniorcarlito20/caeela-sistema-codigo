import { describe, it, expect } from 'vitest'
import {
  duracaoDoSlot, fimDoSlot, gerarHorarios, gradePadrao, horasDaGrade, horasDoDia,
  intervalosSeSobrepoem, slotsEfetivos, temSlot, validarSlots, vagasDoSlot,
  LIMITE_VAGAS, type Slot,
} from '@/domain/grade'

const s = (diaSemana: number, hora: string, duracaoMin = 60): Slot => ({ diaSemana, hora, duracaoMin })

describe('grade padrão e slots efetivos', () => {
  it('a grade padrão tem 12 horários nos 5 dias', () => {
    expect(gradePadrao()).toHaveLength(60)
  })
  it('sem horários salvos vale a grade padrão', () => {
    expect(slotsEfetivos([])).toHaveLength(60)
  })
  it('com horários salvos vale só o que foi salvo', () => {
    expect(slotsEfetivos([s(1, '07:00')])).toEqual([s(1, '07:00')])
  })
  it('atendimento fora da grade aparece (não fica escondido) com a duração dele', () => {
    const r = slotsEfetivos([s(1, '07:00')], [{ diaSemana: 3, hora: '09:00', duracaoMin: 30 }, { diaSemana: 1, hora: '07:00', duracaoMin: 40 }])
    expect(r).toEqual([s(1, '07:00'), s(3, '09:00', 30)])
  })
  it('horas da grade e por dia', () => {
    const slots = [s(1, '08:00'), s(1, '07:00'), s(3, '08:30', 30)]
    expect(horasDaGrade(slots)).toEqual(['07:00', '08:00', '08:30'])
    expect(horasDoDia(slots, 1)).toEqual(['07:00', '08:00'])
    expect(temSlot(slots, 3, '08:30')).toBe(true)
    expect(temSlot(slots, 2, '08:30')).toBe(false)
    expect(duracaoDoSlot(slots, 3, '08:30')).toBe(30)
  })
})

describe('sobreposição de horários', () => {
  it('começa antes de o outro terminar = bate', () => {
    expect(intervalosSeSobrepoem('10:00', 30, '10:15', 30)).toBe(true)
    expect(intervalosSeSobrepoem('10:00', 60, '10:30', 15)).toBe(true)
  })
  it('um logo depois do outro não bate', () => {
    expect(intervalosSeSobrepoem('07:00', 60, '08:00', 60)).toBe(false)
    expect(intervalosSeSobrepoem('09:00', 45, '09:45', 60)).toBe(false)
  })
  it('fim do horário', () => {
    expect(fimDoSlot('09:00', 45)).toBe('09:45')
    expect(fimDoSlot('07:30', 40)).toBe('08:10')
  })
})

describe('validarSlots', () => {
  it('aceita 1h + 1h + 45min em sequência', () => {
    expect(validarSlots([s(1, '07:00', 60), s(1, '08:00', 60), s(1, '09:00', 45)])).toEqual([])
  })
  it('avisa quando dois horários do mesmo dia se sobrepõem', () => {
    const r = validarSlots([s(3, '10:00', 30), s(3, '10:15', 30)])
    expect(r).toHaveLength(1)
    expect(r[0].mensagem).toMatch(/10:15 bate com 10:00/)
  })
  it('o mesmo horário em dias diferentes está certo', () => {
    expect(validarSlots([s(1, '08:00'), s(2, '08:00')])).toEqual([])
  })
  it('recusa hora fora de formato, duração absurda e horário repetido', () => {
    expect(validarSlots([s(1, '7h30')])[0].mensagem).toMatch(/formato/)
    expect(validarSlots([s(1, '07:30', 3)])[0].mensagem).toMatch(/duração/)
    expect(validarSlots([s(1, '07:30', 500)])[0].mensagem).toMatch(/duração/)
    expect(validarSlots([s(1, '07:30'), s(1, '07:30')])[0].mensagem).toMatch(/duas vezes/)
    expect(validarSlots([s(6, '07:30')])[0].mensagem).toMatch(/Dia/)
  })
})

describe('gerarHorarios', () => {
  it('de 07:00 até 11:00 de 60 em 60 gera 4 horários', () => {
    expect(gerarHorarios('07:00', '11:00', 60).map((x) => x.hora)).toEqual(['07:00', '08:00', '09:00', '10:00'])
  })
  it('de 30 em 30 e sem estourar o fim', () => {
    expect(gerarHorarios('08:00', '09:45', 30).map((x) => x.hora)).toEqual(['08:00', '08:30', '09:00'])
  })
  it('entradas inválidas não geram nada', () => {
    expect(gerarHorarios('x', '11:00', 30)).toEqual([])
    expect(gerarHorarios('07:00', '11:00', 0)).toEqual([])
  })
})

describe('vagas do horário (atendimento em grupo)', () => {
  it('sem informar, o horário é individual (1 vaga); horário que não existe também', () => {
    expect(vagasDoSlot([s(2, '08:50')], 2, '08:50')).toBe(1)
    expect(vagasDoSlot([s(2, '08:50')], 3, '08:50')).toBe(1)
  })
  it('lê as vagas de um horário de grupo', () => {
    expect(vagasDoSlot([{ ...s(2, '08:50'), vagas: 3 }, s(2, '09:30')], 2, '08:50')).toBe(3)
    expect(vagasDoSlot([{ ...s(2, '08:50'), vagas: 3 }, s(2, '09:30')], 2, '09:30')).toBe(1)
  })
  it('validarSlots aceita de 1 a 20 vagas e recusa o resto', () => {
    expect(validarSlots([{ ...s(1, '08:00'), vagas: 1 }])).toEqual([])
    expect(validarSlots([{ ...s(1, '08:00'), vagas: LIMITE_VAGAS }])).toEqual([])
    for (const ruim of [0, -1, 2.5, LIMITE_VAGAS + 1]) {
      const problemas = validarSlots([{ ...s(1, '08:00'), vagas: ruim }])
      expect(problemas, String(ruim)).toHaveLength(1)
      expect(problemas[0].mensagem).toBe(`As vagas devem ficar entre 1 e ${LIMITE_VAGAS}.`)
    }
  })
  it('slotsEfetivos mantém as vagas dos horários salvos', () => {
    const r = slotsEfetivos([{ ...s(2, '08:50', 40), vagas: 2 }])
    expect(r.find((x) => x.hora === '08:50')?.vagas).toBe(2)
  })
})
