// tests/semanas.test.ts
import { describe, it, expect } from 'vitest'
import {
  semanaEmMonday, todasAsSemanas, estaNaSemana, listaDeSemanas, alternarSemana, deslocarSemanas,
  semanaDoCiclo, acontece, ritmosBatem, frequencia, rotuloSemanas,
  expandirSemanas, encolherSemanas, segundaDaSemanaN, inicioParaSemanaAtual,
  proximoTamanho, tamanhoAnterior, remocaoDeSemana, semanasCheias, vagasParaMaisUm, type Ritmo,
} from '@/domain/semanas'

const SEG_28_09 = new Date(2026, 8, 28) // segunda-feira = Semana 1 nos testes
const semana = (i: number) => {
  const d = new Date(SEG_28_09)
  d.setDate(d.getDate() + i * 7)
  return d
}

describe('máscara de semanas', () => {
  it('todas as semanas de um ciclo', () => {
    expect(todasAsSemanas(1)).toBe(0b1)
    expect(todasAsSemanas(2)).toBe(0b11)
    expect(todasAsSemanas(4)).toBe(0b1111)
  })
  it('lê, lista e alterna semanas', () => {
    expect(estaNaSemana(0b0101, 1)).toBe(true)
    expect(estaNaSemana(0b0101, 2)).toBe(false)
    expect(listaDeSemanas(0b0101, 4)).toEqual([1, 3])
    expect(alternarSemana(0b0101, 2)).toBe(0b0111)
    expect(alternarSemana(0b0111, 2)).toBe(0b0101)
  })
})

describe('semanaEmMonday', () => {
  it('uma quinta volta para a segunda da mesma semana', () => {
    expect(semanaEmMonday(new Date(2026, 9, 1)).toDateString()).toBe(SEG_28_09.toDateString())
  })
})

describe('semanaDoCiclo', () => {
  const ciclo4 = { semanasNoCiclo: 4, cicloInicio: SEG_28_09 }
  it('conta 1, 2, 3, 4 e volta para 1', () => {
    expect([0, 1, 2, 3, 4].map((i) => semanaDoCiclo(ciclo4, semana(i)))).toEqual([1, 2, 3, 4, 1])
  })
  it('funciona para trás da referência', () => {
    expect(semanaDoCiclo(ciclo4, semana(-1))).toBe(4)
  })
  it('quarta-feira conta como a semana da sua segunda', () => {
    expect(semanaDoCiclo(ciclo4, new Date(2026, 9, 7))).toBe(2)
  })
  it('profissional de 1 semana está sempre na Semana 1', () => {
    expect(semanaDoCiclo({ semanasNoCiclo: 1, cicloInicio: null }, semana(3))).toBe(1)
  })
})

describe('acontece', () => {
  it('profissional de 1 semana: acontece toda semana', () => {
    const r: Ritmo = { semanasNoCiclo: 1, cicloInicio: null, semanas: 1 }
    expect([0, 1, 2].every((i) => acontece(r, semana(i)))).toBe(true)
  })
  it('quinzenal nas Semanas 1 e 3 de um ciclo de 4', () => {
    const r: Ritmo = { semanasNoCiclo: 4, cicloInicio: SEG_28_09, semanas: 0b0101 }
    expect([0, 1, 2, 3, 4].map((i) => acontece(r, semana(i)))).toEqual([true, false, true, false, true])
  })
  it('mensal só na Semana 2', () => {
    const r: Ritmo = { semanasNoCiclo: 4, cicloInicio: SEG_28_09, semanas: 0b0010 }
    expect([0, 1, 2, 3, 4, 5].map((i) => acontece(r, semana(i)))).toEqual([false, true, false, false, false, true])
  })
})

describe('ritmosBatem', () => {
  const q1: Ritmo = { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: 0b01 }
  const q2: Ritmo = { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: 0b10 }
  it('quinzenais em semanas alternadas não batem', () => {
    expect(ritmosBatem(q1, q2)).toBe(false)
  })
  it('semanal bate com qualquer um', () => {
    expect(ritmosBatem({ semanasNoCiclo: 1, cicloInicio: null, semanas: 1 }, q2)).toBe(true)
  })
  it('compara por data quando as contagens são diferentes', () => {
    // outro profissional, ciclo de 4 começando uma semana depois: Semana 1 dele = Semana 2 do primeiro
    const outro: Ritmo = { semanasNoCiclo: 4, cicloInicio: semana(1), semanas: 0b0001 }
    expect(ritmosBatem(q2, outro)).toBe(true)
    expect(ritmosBatem(q1, outro)).toBe(false)
  })
})

describe('frequência e etiqueta', () => {
  it('reconhece semanal, quinzenal, mensal e outra', () => {
    expect(frequencia(1, 1)).toBe('SEMANAL')
    expect(frequencia(0b11, 2)).toBe('SEMANAL')
    expect(frequencia(0b10, 2)).toBe('QUINZENAL')
    expect(frequencia(0b1010, 4)).toBe('QUINZENAL')
    expect(frequencia(0b0100, 4)).toBe('MENSAL')
    expect(frequencia(0b1011, 4)).toBe('OUTRA')
    expect(frequencia(0b0011, 4)).toBe('OUTRA')
  })
  it('escreve a etiqueta', () => {
    expect(rotuloSemanas(1, 1)).toBe('')
    expect(rotuloSemanas(0b1111, 4)).toBe('Toda semana')
    expect(rotuloSemanas(0b0101, 4)).toBe('Quinzenal · Semanas 1 e 3')
    expect(rotuloSemanas(0b10, 2)).toBe('Quinzenal · Semana 2')
    expect(rotuloSemanas(0b0100, 4)).toBe('Mensal · Semana 3')
    expect(rotuloSemanas(0b1011, 4)).toBe('Semanas 1, 2 e 4')
  })
})

describe('nova semana e remover semana', () => {
  it('1 → 2 copia: todo mundo fica nas duas', () => {
    expect(expandirSemanas(0b1, 1, 2)).toBe(0b11)
  })
  it('2 → 4: Semana 3 = cópia da 1, Semana 4 = cópia da 2', () => {
    expect(expandirSemanas(0b01, 2, 4)).toBe(0b0101)
    expect(expandirSemanas(0b10, 2, 4)).toBe(0b1010)
    expect(expandirSemanas(0b11, 2, 4)).toBe(0b1111)
  })
  it('expandir não muda nenhuma data', () => {
    for (const m of [0b01, 0b10, 0b11]) {
      const antes: Ritmo = { semanasNoCiclo: 2, cicloInicio: SEG_28_09, semanas: m }
      const depois: Ritmo = { semanasNoCiclo: 4, cicloInicio: SEG_28_09, semanas: expandirSemanas(m, 2, 4) }
      for (let i = -4; i < 12; i++) expect(acontece(depois, semana(i))).toBe(acontece(antes, semana(i)))
    }
  })
  it('4 → 2 só quando ninguém depende das Semanas 3 e 4', () => {
    expect(encolherSemanas(0b0101, 4, 2)).toBe(0b01)
    expect(encolherSemanas(0b1111, 4, 2)).toBe(0b11)
    expect(encolherSemanas(0b0100, 4, 2)).toBeNull() // mensal na Semana 3
    expect(encolherSemanas(0b0001, 4, 2)).toBeNull() // mensal na Semana 1 viraria quinzenal
  })
  it('2 → 1 só quando está nas duas', () => {
    expect(encolherSemanas(0b11, 2, 1)).toBe(0b1)
    expect(encolherSemanas(0b10, 2, 1)).toBeNull()
  })
  it('tamanhos permitidos: 1, 2, 4', () => {
    expect(proximoTamanho(1)).toBe(2)
    expect(proximoTamanho(2)).toBe(4)
    expect(proximoTamanho(4)).toBeNull()
    expect(tamanhoAnterior(4)).toBe(2)
    expect(tamanhoAnterior(2)).toBe(1)
    expect(tamanhoAnterior(1)).toBeNull()
  })
})

describe('semana atual', () => {
  it('nova referência para a semana de hoje virar a Semana N', () => {
    const hoje = new Date(2026, 9, 8) // quinta, semana de 05/10
    expect(inicioParaSemanaAtual(2, hoje).toDateString()).toBe(SEG_28_09.toDateString())
    expect(semanaDoCiclo({ semanasNoCiclo: 4, cicloInicio: inicioParaSemanaAtual(3, hoje) }, hoje)).toBe(3)
  })
  it('segunda-feira da próxima vez que a Semana N acontece', () => {
    const ciclo = { semanasNoCiclo: 4, cicloInicio: SEG_28_09 }
    const hoje = new Date(2026, 9, 8) // Semana 2
    expect(segundaDaSemanaN(ciclo, 2, hoje).toDateString()).toBe(new Date(2026, 9, 5).toDateString())
    expect(segundaDaSemanaN(ciclo, 4, hoje).toDateString()).toBe(new Date(2026, 9, 19).toDateString())
    expect(segundaDaSemanaN(ciclo, 1, hoje).toDateString()).toBe(new Date(2026, 9, 26).toDateString())
  })
})

describe('remocaoDeSemana', () => {
  it('encolhe quem dá e lista quem bloqueia', () => {
    const horarios = [
      { id: 'semanal', semanas: 0b1111 },
      { id: 'quinzenal', semanas: 0b1010 },
      { id: 'mensal', semanas: 0b0100 },
    ]
    const r = remocaoDeSemana(horarios, 4, 2)
    expect(r.bloqueados.map((h) => h.id)).toEqual(['mensal'])
    expect(r.novas.get('semanal')).toBe(0b11)
    expect(r.novas.get('quinzenal')).toBe(0b10)
  })
  it('quem bloqueia ainda ganha uma máscara válida (usada só para horários já encerrados)', () => {
    const r = remocaoDeSemana([{ id: 'x', semanas: 0b0100 }], 4, 2)
    expect(r.novas.get('x')).toBe(0b11)
  })
})

describe('deslocarSemanas', () => {
  it('semanal não muda', () => {
    expect(deslocarSemanas(0b1111, 1, 4)).toBe(0b1111)
    expect(deslocarSemanas(0b11, 1, 2)).toBe(0b11)
    expect(deslocarSemanas(0b1, 3, 1)).toBe(0b1)
  })
  it('quinzenal anda junto (1 e 3 → 2 e 4) e continua quinzenal', () => {
    expect(deslocarSemanas(0b0101, 1, 4)).toBe(0b1010)
    expect(deslocarSemanas(0b1010, 1, 4)).toBe(0b0101)
    expect(deslocarSemanas(0b01, 1, 2)).toBe(0b10)
  })
  it('mensal continua mensal e dá a volta no ciclo', () => {
    expect(deslocarSemanas(0b0001, 2, 4)).toBe(0b0100)
    expect(deslocarSemanas(0b1000, 1, 4)).toBe(0b0001)
  })
  it('deslocamento negativo anda para trás', () => {
    expect(deslocarSemanas(0b0001, -1, 4)).toBe(0b1000)
    expect(deslocarSemanas(0b1010, -1, 4)).toBe(0b0101)
  })
  it('deslocamento zero devolve igual', () => {
    expect(deslocarSemanas(0b0110, 0, 4)).toBe(0b0110)
  })
})

describe('vagasParaMaisUm', () => {
  it('horário vazio nessas semanas pede 1 vaga', () => {
    expect(vagasParaMaisUm([], 0b1, 1)).toBe(1)
    expect(vagasParaMaisUm([0b01], 0b10, 2)).toBe(1)
  })
  it('conta quem já está na semana mais cheia entre as escolhidas, mais um', () => {
    expect(vagasParaMaisUm([0b1], 0b1, 1)).toBe(2)
    expect(vagasParaMaisUm([0b1, 0b1], 0b1, 1)).toBe(3)
    expect(vagasParaMaisUm([0b11, 0b01], 0b11, 2)).toBe(3)
  })
  it('só olha as semanas que a criança nova vai ocupar', () => {
    expect(vagasParaMaisUm([0b11, 0b01], 0b10, 2)).toBe(2)
  })
})

describe('semanasCheias', () => {
  it('com 1 vaga é o mesmo que juntar as semanas (como sempre foi)', () => {
    expect(semanasCheias([0b01, 0b10], 1, 2)).toBe(0b11)
    expect(semanasCheias([0b1111], 1, 4)).toBe(0b1111)
    expect(semanasCheias([], 1, 2)).toBe(0)
  })
  it('com 2 vagas, uma semana só fica cheia quando 2 alunos vêm nela', () => {
    expect(semanasCheias([0b01, 0b10], 2, 2)).toBe(0)
    expect(semanasCheias([0b11, 0b01], 2, 2)).toBe(0b01)
    expect(semanasCheias([0b11, 0b11], 2, 2)).toBe(0b11)
  })
  it('com 3 vagas e quatro semanas', () => {
    expect(semanasCheias([0b0101, 0b0101, 0b1111], 3, 4)).toBe(0b0101)
  })
  it('profissional de 1 semana', () => {
    expect(semanasCheias([0b1], 2, 1)).toBe(0)
    expect(semanasCheias([0b1, 0b1], 2, 1)).toBe(0b1)
  })
})
