export type TipoAusencia = 'FALTA' | 'ATESTADO' | 'LICENCA' | 'FERIAS' | 'CAPACITACAO' | 'OUTRO'

const JUSTIFICADAS: TipoAusencia[] = ['ATESTADO', 'LICENCA', 'FERIAS', 'CAPACITACAO']

// Lista os dias entre início e fim, inclusive, sem depender de fuso.
export function diasDaAusencia(inicio: Date, fim: Date): Date[] {
  const dias: Date[] = []
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  const ultimo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
  while (d <= ultimo) {
    dias.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return dias
}

// Só FALTOU conta como falta do aluno. Cancelado pelo centro, não.
export function contaComoFaltaDoAluno(situacao: string): boolean {
  return situacao === 'FALTOU'
}

// A ausência do profissional só cancela o atendimento que ainda estava agendado. Falta,
// justificativa e presença já registradas ficam como estão (antes a ausência apagava a falta).
export function ausenciaCancela(situacao: string): boolean {
  return situacao === 'AGENDADO'
}

export function resumoFrequencia(
  ausencias: { tipo: string; dias: number }[],
  diasUteis: number,
): { previstos: number; ausentes: number; justificados: number; naoJustificados: number; percentual: number } {
  const justificados = ausencias
    .filter((a) => (JUSTIFICADAS as string[]).includes(a.tipo))
    .reduce((n, a) => n + a.dias, 0)
  const ausentes = ausencias.reduce((n, a) => n + a.dias, 0)
  const naoJustificados = ausentes - justificados
  const presentes = Math.max(0, diasUteis - ausentes)
  return {
    previstos: diasUteis,
    ausentes,
    justificados,
    naoJustificados,
    percentual: diasUteis === 0 ? 100 : Math.round((presentes / diasUteis) * 100),
  }
}
