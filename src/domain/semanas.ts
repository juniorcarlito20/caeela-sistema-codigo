// src/domain/semanas.ts
// Agenda em semanas: cada profissional tem 1, 2 ou 4 semanas que se repetem (Semana 1, 2…,
// 1, 2…) a partir da segunda-feira da Semana 1 (`cicloInicio`). Cada horário de aluno guarda
// em quais semanas acontece numa máscara de bits (bit 0 = Semana 1, bit 1 = Semana 2…).
// A frequência (semanal, quinzenal, mensal) é consequência das semanas, ninguém a escolhe.

export type Ciclo = { semanasNoCiclo: number; cicloInicio: Date | null }
export type Ritmo = Ciclo & { semanas: number }
export type Frequencia = 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'OUTRA'

const TAMANHOS = [1, 2, 4]
const MS_SEMANA = 7 * 24 * 3600 * 1000

export function semanaEmMonday(data: Date): Date {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function semanasEntre(a: Date, b: Date): number {
  return Math.round((semanaEmMonday(b).getTime() - semanaEmMonday(a).getTime()) / MS_SEMANA)
}

export function todasAsSemanas(semanasNoCiclo: number): number {
  return (1 << Math.max(1, semanasNoCiclo)) - 1
}

export function estaNaSemana(semanas: number, n: number): boolean {
  return (semanas & (1 << (n - 1))) !== 0
}

export function listaDeSemanas(semanas: number, semanasNoCiclo: number): number[] {
  return Array.from({ length: Math.max(1, semanasNoCiclo) }, (_, i) => i + 1).filter((n) => estaNaSemana(semanas, n))
}

export function alternarSemana(semanas: number, n: number): number {
  return semanas ^ (1 << (n - 1))
}

// Semanas do ciclo em que um horário já está cheio: onde pelo menos `vagas` alunos vêm.
// Com 1 vaga dá o mesmo que juntar todas as semanas (o comportamento de sempre).
export function semanasCheias(masks: number[], vagas: number, semanasNoCiclo: number): number {
  const n = Math.max(1, semanasNoCiclo)
  const minimo = Math.max(1, vagas)
  let cheias = 0
  for (let semana = 1; semana <= n; semana++) {
    if (masks.filter((m) => estaNaSemana(m, semana)).length >= minimo) cheias |= 1 << (semana - 1)
  }
  return cheias
}

// Quantas vagas o horário precisa ter para mais uma criança entrar nas semanas `semanas`: a
// semana mais cheia entre elas (contando só quem já está) mais um. Horário vazio nessas semanas: 1.
export function vagasParaMaisUm(masks: number[], semanas: number, semanasNoCiclo: number): number {
  const n = Math.max(1, semanasNoCiclo)
  let maior = 0
  for (let semana = 1; semana <= n; semana++) {
    if (!estaNaSemana(semanas, semana)) continue
    maior = Math.max(maior, masks.filter((m) => estaNaSemana(m, semana)).length)
  }
  return maior + 1
}

// Mover para outra semana: o padrão do aluno "anda" d semanas dentro do ciclo (quinzenal 1 e 3
// com d = 1 vira 2 e 4; mensal continua mensal). A frequência nunca muda.
export function deslocarSemanas(semanas: number, d: number, semanasNoCiclo: number): number {
  const n = Math.max(1, semanasNoCiclo)
  const k = ((d % n) + n) % n
  const m = semanas & todasAsSemanas(n)
  return ((m << k) | (m >> (n - k))) & todasAsSemanas(n)
}

// Em qual semana do ciclo (1..semanasNoCiclo) cai a data. Quem tem 1 semana está sempre na 1.
export function semanaDoCiclo(ciclo: Ciclo, data: Date): number {
  const n = ciclo.semanasNoCiclo
  if (n <= 1 || !ciclo.cicloInicio) return 1
  const diff = semanasEntre(ciclo.cicloInicio, data)
  return (((diff % n) + n) % n) + 1
}

export function acontece(r: Ritmo, data: Date): boolean {
  if (r.semanasNoCiclo <= 1) return true
  return estaNaSemana(r.semanas, semanaDoCiclo(r, data))
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b))

// Dois horários batem se existe alguma semana real em que os dois acontecem. Como cada
// profissional tem a sua contagem, compara por data, numa janela que cobre os dois ciclos.
export function ritmosBatem(a: Ritmo, b: Ritmo): boolean {
  const la = Math.max(1, a.semanasNoCiclo)
  const lb = Math.max(1, b.semanasNoCiclo)
  const janela = (la * lb) / mdc(la, lb)
  const ancora = semanaEmMonday(a.cicloInicio ?? b.cicloInicio ?? new Date(2026, 0, 5))
  for (let i = 0; i < janela; i++) {
    const data = new Date(ancora)
    data.setDate(data.getDate() + i * 7)
    if (acontece(a, data) && acontece(b, data)) return true
  }
  return false
}

export function frequencia(semanas: number, semanasNoCiclo: number): Frequencia {
  const todas = todasAsSemanas(semanasNoCiclo)
  const m = semanas & todas
  if (semanasNoCiclo <= 1 || m === todas) return 'SEMANAL'
  const qtd = listaDeSemanas(m, semanasNoCiclo).length
  if (semanasNoCiclo === 2 && qtd === 1) return 'QUINZENAL'
  if (semanasNoCiclo === 4 && (m === 0b0101 || m === 0b1010)) return 'QUINZENAL'
  if (semanasNoCiclo === 4 && qtd === 1) return 'MENSAL'
  return 'OUTRA'
}

function juntar(lista: number[]): string {
  if (lista.length <= 1) return lista.join('')
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
}

// "Quinzenal · Semanas 1 e 3". Profissional de 1 semana não tem etiqueta.
export function rotuloSemanas(semanas: number, semanasNoCiclo: number): string {
  if (semanasNoCiclo <= 1) return ''
  const lista = listaDeSemanas(semanas, semanasNoCiclo)
  const quais = lista.length === 1 ? `Semana ${lista[0]}` : `Semanas ${juntar(lista)}`
  const f = frequencia(semanas, semanasNoCiclo)
  if (f === 'SEMANAL') return 'Toda semana'
  if (f === 'QUINZENAL') return `Quinzenal · ${quais}`
  if (f === 'MENSAL') return `Mensal · ${quais}`
  return quais
}

// "+ Nova semana": as semanas novas nascem cópia das que existem, então nenhuma data muda.
export function expandirSemanas(semanas: number, de: number, para: number): number {
  const base = semanas & todasAsSemanas(de)
  let m = 0
  for (let desloc = 0; desloc < para; desloc += de) m |= base << desloc
  return m & todasAsSemanas(para)
}

// "Remover semana": só vale se as semanas que saem forem cópia das que ficam; senão o aluno
// mudaria de frequência sem ninguém ver — devolve null.
export function encolherSemanas(semanas: number, de: number, para: number): number | null {
  const base = semanas & todasAsSemanas(para)
  return expandirSemanas(base, para, de) === (semanas & todasAsSemanas(de)) ? base : null
}

// Remover semana: calcula a máscara nova de cada horário e quem impede (alguém que só existe
// nas semanas que sairiam, ou que mudaria de frequência). Para quem impede, a máscara nova é
// só uma reserva válida — a rota recusa se houver bloqueado entre os horários vigentes.
export function remocaoDeSemana<T extends { id: string; semanas: number }>(
  horarios: T[], de: number, para: number,
): { novas: Map<string, number>; bloqueados: T[] } {
  const novas = new Map<string, number>()
  const bloqueados: T[] = []
  for (const h of horarios) {
    const encolhida = encolherSemanas(h.semanas, de, para)
    if (encolhida === null) bloqueados.push(h)
    novas.set(h.id, encolhida ?? ((h.semanas & todasAsSemanas(para)) || todasAsSemanas(para)))
  }
  return { novas, bloqueados }
}

export function proximoTamanho(semanasNoCiclo: number): number | null {
  const i = TAMANHOS.indexOf(semanasNoCiclo)
  return i >= 0 && i < TAMANHOS.length - 1 ? TAMANHOS[i + 1] : null
}

export function tamanhoAnterior(semanasNoCiclo: number): number | null {
  const i = TAMANHOS.indexOf(semanasNoCiclo)
  return i > 0 ? TAMANHOS[i - 1] : null
}

// Segunda-feira da próxima vez (a partir da semana de hoje) em que a Semana N acontece.
export function segundaDaSemanaN(ciclo: Ciclo, n: number, hoje: Date): Date {
  const total = Math.max(1, ciclo.semanasNoCiclo)
  const adiante = (((n - semanaDoCiclo(ciclo, hoje)) % total) + total) % total
  const segunda = semanaEmMonday(hoje)
  segunda.setDate(segunda.getDate() + adiante * 7)
  return segunda
}

// Nova segunda da Semana 1 para que a semana de hoje passe a ser a Semana N.
export function inicioParaSemanaAtual(n: number, hoje: Date): Date {
  const segunda = semanaEmMonday(hoje)
  segunda.setDate(segunda.getDate() - (n - 1) * 7)
  return segunda
}
