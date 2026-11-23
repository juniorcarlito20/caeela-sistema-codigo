// src/domain/migracaoSemanas.ts
// Conversão única do modelo antigo (grupo + cicloSemanas/cicloOffset + semanaReferencia em cada
// horário) para o novo (ciclo no profissional + máscara de semanas no horário). Só o script
// src/scripts/migrar-semanas.ts usa isto.
import { acontece, ritmosBatem, semanaEmMonday, semanasEntre, todasAsSemanas, type Ciclo, type Ritmo } from './semanas'

export type RotacaoAntiga = { cicloSemanas: number; cicloOffset: number; semanaReferencia: Date | null }

// Cópia fiel de como o sistema decidia antes (src/domain/rotacao.ts, que sai).
export function semanaAtivaAntiga(r: RotacaoAntiga, semanaAlvo: Date): boolean {
  if (r.cicloSemanas <= 1) return true
  if (!r.semanaReferencia) return true
  const diff = semanasEntre(r.semanaReferencia, semanaAlvo)
  const posicao = ((diff % r.cicloSemanas) + r.cicloSemanas) % r.cicloSemanas
  return posicao === r.cicloOffset
}

// Quantas semanas o profissional passa a ter e onde começa a Semana 1: o maior ciclo dos
// horários dele, contado a partir da referência mais antiga.
export function cicloDoProfissional(horarios: RotacaoAntiga[]): Ciclo | { erro: string } {
  const emRodizio = horarios.filter((h) => h.cicloSemanas > 1 && h.semanaReferencia)
  if (horarios.some((h) => h.cicloSemanas !== 1 && h.cicloSemanas !== 2 && h.cicloSemanas !== 4)) {
    return { erro: `ciclo de ${horarios.find((h) => ![1, 2, 4].includes(h.cicloSemanas))!.cicloSemanas} semanas` }
  }
  if (emRodizio.length === 0) return { semanasNoCiclo: 1, cicloInicio: null }
  const maior = Math.max(...emRodizio.map((h) => h.cicloSemanas))
  const inicio = emRodizio
    .map((h) => semanaEmMonday(h.semanaReferencia!))
    .sort((a, b) => a.getTime() - b.getTime())[0]
  return { semanasNoCiclo: maior, cicloInicio: inicio }
}

// Em quais semanas do profissional o horário antigo acontece. Se a referência do horário
// for outra, reposiciona: posição nova ≡ offset + (semanas entre o início e a referência).
export function semanasDoHorarioAntigo(h: RotacaoAntiga, ciclo: Ciclo): number {
  const total = Math.max(1, ciclo.semanasNoCiclo)
  if (h.cicloSemanas <= 1 || !h.semanaReferencia || total <= 1 || !ciclo.cicloInicio) return todasAsSemanas(total)
  const c = h.cicloSemanas
  const k = semanasEntre(ciclo.cicloInicio, h.semanaReferencia)
  const alvo = (((h.cicloOffset + k) % c) + c) % c
  let m = 0
  for (let p = 0; p < total; p++) if (p % c === alvo) m |= 1 << p
  return m
}

// A prova: nas próximas `semanas` semanas a partir de `inicio`, o horário acontece exatamente
// nas mesmas datas antes e depois da conversão.
export function datasIguais(antigo: RotacaoAntiga, novo: Ritmo, inicio: Date, semanas = 13): boolean {
  const segunda = semanaEmMonday(inicio)
  for (let i = 0; i < semanas; i++) {
    const data = new Date(segunda)
    data.setDate(data.getDate() + i * 7)
    if (semanaAtivaAntiga(antigo, data) !== acontece(novo, data)) return false
  }
  return true
}

// O modelo novo não tem atendimento simultâneo: lista os pares que passariam a ser choque
// (mesmo profissional, mesmo dia e hora, alguma semana em comum).
export function alunosNaMesmaSemana<T extends { profissionalId: string; diaSemana: number; hora: string; ritmo: Ritmo }>(
  lista: T[],
): [T, T][] {
  const pares: [T, T][] = []
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i]
      const b = lista[j]
      if (a.profissionalId === b.profissionalId && a.diaSemana === b.diaSemana && a.hora === b.hora && ritmosBatem(a.ritmo, b.ritmo)) {
        pares.push([a, b])
      }
    }
  }
  return pares
}
