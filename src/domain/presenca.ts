export function resumoDoPeriodo(itens: { situacao: string }[]) {
  const considerados = itens.filter((i) => i.situacao !== 'AGENDADO' && i.situacao !== 'CANCELADO')
  return {
    total: considerados.length,
    realizados: considerados.filter((i) => i.situacao === 'REALIZADO').length,
    faltas: considerados.filter((i) => i.situacao === 'FALTOU').length,
    justificadas: considerados.filter((i) => i.situacao === 'JUSTIFICOU').length,
    cancelados: itens.filter((i) => i.situacao === 'CANCELADO').length,
  }
}

// Percentual de presença (realizados sobre o total considerado, arredondado).
export function percentualPresenca(itens: { situacao: string }[]): number {
  const { total, realizados } = resumoDoPeriodo(itens)
  if (total === 0) return 0
  return Math.round((realizados / total) * 100)
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Texto do período do relatório: por extenso quando cabe no mês ou no ano.
export function textoPeriodo(inicio: Date, fim: Date): string {
  const mesmoMes = inicio.getFullYear() === fim.getFullYear() && inicio.getMonth() === fim.getMonth()
  if (mesmoMes) return `${MESES[inicio.getMonth()]} de ${inicio.getFullYear()}`
  if (inicio.getFullYear() === fim.getFullYear()) {
    return `de ${MESES[inicio.getMonth()]} a ${MESES[fim.getMonth()]} de ${inicio.getFullYear()}`
  }
  const mes = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return `de ${mes(inicio)} a ${mes(fim)}`
}

// Até quantos dias para trás dá para lançar presença ou evolução (papel, queda de energia ou de internet).
export const DIAS_PARA_LANCAR = 30

export const AVISO_LIMITE_LANCAR = 'Só dá para lançar até 30 dias atrás. Fale com a direção.'

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

// Pode lançar neste dia? A direção sempre pode; os demais, até 30 dias antes de hoje (datas futuras passam).
export function podeLancarNoDia(perfil: string, diaISO: string, hojeISO: string): boolean {
  if (perfil === 'ADMIN') return true
  return diaISO >= somarDias(hojeISO, -DIAS_PARA_LANCAR)
}

// Dia mais antigo em que quem não é da direção ainda pode lançar.
export function primeiroDiaParaLancar(hojeISO: string): string {
  return somarDias(hojeISO, -DIAS_PARA_LANCAR)
}

// "Lançado em 04/11" quando o registro foi feito num dia (no fuso do centro) depois do dia do atendimento.
export function lancadoDepois(diaAtendimentoISO: string, registradoEm: Date | null): string | null {
  if (!registradoEm) return null
  const diaRegistro = registradoEm.toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' })
  if (diaRegistro <= diaAtendimentoISO) return null
  const [, m, d] = diaRegistro.split('-')
  return `Lançado em ${d}/${m}`
}

// Texto completo para a tela: "Lançado em 04/11 (referente a 03/11)".
export function textoLancadoDepois(diaAtendimentoISO: string, registradoEm: Date | null): string | null {
  const base = lancadoDepois(diaAtendimentoISO, registradoEm)
  if (!base) return null
  const [, m, d] = diaAtendimentoISO.split('-')
  return `${base} (referente a ${d}/${m})`
}
