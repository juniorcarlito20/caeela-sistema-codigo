// src/domain/diaSemAtendimento.ts
// Dia em que o centro inteiro não atende (feriado, decreto do prefeito, feriado antecipado,
// reunião). Quem cuida da agenda marca o dia e escreve o motivo; vale só para aquela data.
import { acontece, type Ritmo } from './semanas'

// Observação gravada no atendimento que este aviso cancelou: é por ela que o sistema sabe
// devolver a "agendado" só o que ele mesmo cancelou.
export const PREFIXO_SEM_ATENDIMENTO = 'Sem atendimento: '

const doisDigitos = (n: number) => String(n).padStart(2, '0')

// AAAA-MM-DD da data, no relógio do servidor (mesmo padrão das telas).
export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}

// O dia como é guardado no banco: ao meio-dia (mesmo padrão de Atendimento.data).
export function dataDoDia(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

// 1 = segunda … 7 = domingo.
export function diaDaSemana(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1
}

// Por que este dia não pode ser marcado (ou desmarcado); null = pode.
export function motivoParaNaoMarcar(iso: string, hojeISO: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Dia inválido.'
  const data = dataDoDia(iso)
  if (Number.isNaN(data.getTime()) || isoDia(data) !== iso) return 'Dia inválido.'
  if (diaDaSemana(data) > 5) return 'O centro não atende no fim de semana.'
  if (iso < hojeISO) return 'Esse dia já passou.'
  return null
}

// Próxima data, depois de `depoisDe`, em que este horário acontece (mesmo dia da semana, na
// semana certa do rodízio) e o centro atende. Olha até 12 semanas à frente.
export function proximoAtendimento(ritmo: Ritmo, depoisDe: Date, semAtendimento: Set<string>): Date | null {
  for (let i = 1; i <= 12; i++) {
    const d = new Date(depoisDe)
    d.setDate(d.getDate() + i * 7)
    if (acontece(ritmo, d) && !semAtendimento.has(isoDia(d))) return d
  }
  return null
}

// Dias do mês em que o profissional deveria atender: segunda a sexta, nos dias da semana em
// que ele tem aluno, fora os dias sem atendimento do centro.
export function diasPrevistos(
  inicioMes: Date, fimMes: Date, diasComHorario: Set<number>, semAtendimento: Set<string>,
): number {
  let previstos = 0
  const cursor = new Date(inicioMes.getFullYear(), inicioMes.getMonth(), inicioMes.getDate())
  while (cursor <= fimMes) {
    const dow = diaDaSemana(cursor)
    if (dow <= 5 && diasComHorario.has(dow) && !semAtendimento.has(isoDia(cursor))) previstos++
    cursor.setDate(cursor.getDate() + 1)
  }
  return previstos
}

export type DiaDoCartao = {
  iso: string
  rotulo: string // "Seg 12"
  motivo: string | null // null = atendimento normal
  passado: boolean
  hoje: boolean
  sabado: boolean
}
export type SemanaDoCartao = { titulo: string; dias: DiaDoCartao[] }

const NOMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ddmm = (d: Date) => `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`

// As duas semanas do cartão, de segunda a sábado: esta e a que vem (no fim de semana, as duas
// seguintes). `marcados`: AAAA-MM-DD → motivo.
export function semanasDoCartao(hoje: Date, marcados: Map<string, string>): SemanaDoCartao[] {
  const hojeISO = isoDia(hoje)
  const fimDeSemana = diaDaSemana(hoje) > 5
  const base = new Date(hoje)
  base.setHours(12, 0, 0, 0)
  base.setDate(base.getDate() - (diaDaSemana(base) - 1) + (fimDeSemana ? 7 : 0))
  const titulos = fimDeSemana ? ['Semana que vem', 'Daqui a duas semanas'] : ['Esta semana', 'Semana que vem']
  return [0, 1].map((n) => {
    const segunda = new Date(base)
    segunda.setDate(base.getDate() + n * 7)
    const sexta = new Date(segunda)
    sexta.setDate(segunda.getDate() + 4)
    const dias = NOMES.map((nome, i) => {
      const d = new Date(segunda)
      d.setDate(segunda.getDate() + i)
      const iso = isoDia(d)
      return {
        iso,
        rotulo: `${nome} ${doisDigitos(d.getDate())}`,
        motivo: marcados.get(iso) ?? null,
        passado: iso < hojeISO,
        hoje: iso === hojeISO,
        sabado: i === 5,
      }
    })
    return { titulo: `${titulos[n]} · ${ddmm(segunda)} a ${ddmm(sexta)}`, dias }
  })
}

// Na tela de avisos: o que saiu para esta família vale como aviso? Só se saiu depois de o dia
// ser marcado. O que saiu antes era o lembrete normal ("tem atendimento…"), e essa família
// ainda precisa ser avisada — mesmo que já tenha confirmado presença.
export function avisoEnviado(enviadoEm: Date | null, marcadoEm: Date): boolean {
  return enviadoEm !== null && enviadoEm.getTime() >= marcadoEm.getTime()
}
