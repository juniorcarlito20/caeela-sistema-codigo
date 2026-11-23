// Grade de atendimento de cada profissional: um conjunto de horários (slots) por dia da
// semana, cada um com a sua hora de início e a sua duração. Dois horários do mesmo dia
// nunca podem se sobrepor.

export type Slot = { diaSemana: number; hora: string; duracaoMin: number; vagas?: number }

export const LIMITE_VAGAS = 20

// Quantas crianças cabem no horário: 1 = individual (o padrão); 2 ou mais = horário de grupo.
export function vagasDoSlot(slots: Slot[], diaSemana: number, hora: string): number {
  return slots.find((s) => s.diaSemana === diaSemana && s.hora === hora)?.vagas ?? 1
}

export const DURACAO_PADRAO = 40
export const DURACAO_MINIMA = 5
export const DURACAO_MAXIMA = 240
export const LIMITE_SLOTS_POR_DIA = 30

// Horários da grade padrão do centro: valem para quem ainda não tem horários próprios.
export const HORAS_PADRAO = [
  '07:30', '08:10', '08:50', '09:30', '10:10', '10:50', '11:30',
  '13:00', '13:40', '14:20', '15:00', '15:40',
]

export function gradePadrao(): Slot[] {
  const slots: Slot[] = []
  for (let dia = 1; dia <= 5; dia++) {
    for (const hora of HORAS_PADRAO) slots.push({ diaSemana: dia, hora, duracaoMin: DURACAO_PADRAO })
  }
  return slots
}

export const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/

export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function deMinutos(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function fimDoSlot(hora: string, duracaoMin: number): string {
  return deMinutos(paraMinutos(hora) + duracaoMin)
}

// Dois atendimentos do mesmo dia se sobrepõem quando um começa antes de o outro terminar.
export function intervalosSeSobrepoem(
  horaA: string, duracaoA: number, horaB: string, duracaoB: number,
): boolean {
  const a = paraMinutos(horaA)
  const b = paraMinutos(horaB)
  return a < b + duracaoB && b < a + duracaoA
}

const ordem = (x: Slot, y: Slot) => x.diaSemana - y.diaSemana || x.hora.localeCompare(y.hora)

// O que vale de verdade para o profissional: os horários salvos (ou a grade padrão, se ele
// ainda não tem nenhum) mais qualquer atendimento que já exista fora deles. Assim nenhum
// atendimento fica escondido, mesmo vindo de antes de a grade ser personalizada.
export function slotsEfetivos(
  salvos: Slot[],
  horarios: { diaSemana: number; hora: string; duracaoMin?: number | null }[] = [],
): Slot[] {
  const base = salvos.length > 0 ? salvos : gradePadrao()
  const mapa = new Map<string, Slot>(base.map((s) => [`${s.diaSemana}-${s.hora}`, { ...s }]))
  for (const h of horarios) {
    const chave = `${h.diaSemana}-${h.hora}`
    if (!mapa.has(chave)) {
      mapa.set(chave, { diaSemana: h.diaSemana, hora: h.hora, duracaoMin: h.duracaoMin ?? DURACAO_PADRAO })
    }
  }
  return [...mapa.values()].sort(ordem)
}

// Linhas da tabela: todas as horas de início usadas em algum dia, em ordem.
export function horasDaGrade(slots: Slot[]): string[] {
  return [...new Set(slots.map((s) => s.hora))].sort()
}

export function horasDoDia(slots: Slot[], diaSemana: number): string[] {
  return slots.filter((s) => s.diaSemana === diaSemana).map((s) => s.hora).sort()
}

export function temSlot(slots: Slot[], diaSemana: number, hora: string): boolean {
  return slots.some((s) => s.diaSemana === diaSemana && s.hora === hora)
}

export function duracaoDoSlot(slots: Slot[], diaSemana: number, hora: string): number | undefined {
  return slots.find((s) => s.diaSemana === diaSemana && s.hora === hora)?.duracaoMin
}

export type ProblemaSlot = { diaSemana: number; hora: string; mensagem: string }

// Confere a lista inteira que a secretária quer salvar. Devolve um problema por linha
// errada, com a mensagem pronta para mostrar na tela.
export function validarSlots(slots: Slot[]): ProblemaSlot[] {
  const problemas: ProblemaSlot[] = []
  const vistos = new Set<string>()
  const validos: Slot[] = []
  for (const s of slots) {
    const chave = `${s.diaSemana}-${s.hora}`
    if (!Number.isInteger(s.diaSemana) || s.diaSemana < 1 || s.diaSemana > 5) {
      problemas.push({ ...s, mensagem: 'Dia inválido.' })
    } else if (!HORA_VALIDA.test(s.hora)) {
      problemas.push({ ...s, mensagem: 'Escreva a hora no formato 07:30.' })
    } else if (
      !Number.isInteger(s.duracaoMin) || s.duracaoMin < DURACAO_MINIMA || s.duracaoMin > DURACAO_MAXIMA
    ) {
      problemas.push({ ...s, mensagem: `A duração deve ficar entre ${DURACAO_MINIMA} e ${DURACAO_MAXIMA} minutos.` })
    } else if (s.vagas !== undefined && (!Number.isInteger(s.vagas) || s.vagas < 1 || s.vagas > LIMITE_VAGAS)) {
      problemas.push({ ...s, mensagem: `As vagas devem ficar entre 1 e ${LIMITE_VAGAS}.` })
    } else if (vistos.has(chave)) {
      problemas.push({ ...s, mensagem: `${s.hora} aparece duas vezes no mesmo dia.` })
    } else {
      vistos.add(chave)
      validos.push(s)
    }
  }
  for (let dia = 1; dia <= 5; dia++) {
    const doDia = validos.filter((s) => s.diaSemana === dia).sort(ordem)
    if (doDia.length > LIMITE_SLOTS_POR_DIA) {
      problemas.push({ diaSemana: dia, hora: doDia[0].hora, mensagem: `No máximo ${LIMITE_SLOTS_POR_DIA} horários por dia.` })
    }
    for (let i = 1; i < doDia.length; i++) {
      const anterior = doDia[i - 1]
      const atual = doDia[i]
      if (intervalosSeSobrepoem(anterior.hora, anterior.duracaoMin, atual.hora, atual.duracaoMin)) {
        problemas.push({
          diaSemana: dia,
          hora: atual.hora,
          mensagem: `${atual.hora} bate com ${anterior.hora} (${anterior.duracaoMin} min, até ${fimDoSlot(anterior.hora, anterior.duracaoMin)}). Ajuste um dos dois.`,
        })
      }
    }
  }
  return problemas
}

// Atalho do editor: cria vários horários seguidos, cada um com a duração do passo.
export function gerarHorarios(de: string, ate: string, passoMin: number): { hora: string; duracaoMin: number }[] {
  if (!HORA_VALIDA.test(de) || !HORA_VALIDA.test(ate)) return []
  if (!Number.isInteger(passoMin) || passoMin < DURACAO_MINIMA || passoMin > DURACAO_MAXIMA) return []
  const lista: { hora: string; duracaoMin: number }[] = []
  for (let t = paraMinutos(de); t + passoMin <= paraMinutos(ate); t += passoMin) {
    lista.push({ hora: deMinutos(t), duracaoMin: passoMin })
  }
  return lista
}

export type SlotsPorProfissional = Record<string, Slot[]>

// Horários de um profissional num mapa; quem não está no mapa usa a grade padrão.
export function slotsDe(mapa: SlotsPorProfissional, profissionalId: string): Slot[] {
  return mapa[profissionalId] ?? gradePadrao()
}
