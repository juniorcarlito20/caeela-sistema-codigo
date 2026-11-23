// Faltas seguidas contadas por DIA: o dia só conta como falta se todos os atendimentos que
// valem (tirando AGENDADO e CANCELADO) ficaram FALTOU. REALIZADO ou JUSTIFICOU no dia quebra
// a sequência; dia só com AGENDADO/CANCELADO não conta nem quebra.
export const FALTAS_PARA_AVISO = 2

const chaveDoDia = (d: Date): string => d.toISOString().slice(0, 10)

export function diasDeFaltaSeguidos(
  itens: { situacao: string; data: Date }[],
  desde?: Date | null,
): { dias: number; ultimaFalta: Date | null; diasDaSequencia: string[] } {
  const limite = desde ? chaveDoDia(desde) : null
  // dia -> (houve falta?, houve algo que não é falta?) e a data usada para mostrar
  const porDia = new Map<string, { falta: boolean; quebra: boolean; data: Date }>()
  for (const i of itens) {
    if (i.situacao === 'AGENDADO' || i.situacao === 'CANCELADO') continue
    const chave = chaveDoDia(i.data)
    if (limite !== null && chave <= limite) continue
    const dia = porDia.get(chave) ?? { falta: false, quebra: false, data: i.data }
    if (i.situacao === 'FALTOU') dia.falta = true
    else dia.quebra = true
    porDia.set(chave, dia)
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // do mais recente para trás
  let ultimaFalta: Date | null = null
  const diasDaSequencia: string[] = []
  for (const [chave, dia] of dias) {
    if (!dia.falta || dia.quebra) break
    if (ultimaFalta === null) ultimaFalta = dia.data
    diasDaSequencia.push(chave)
  }
  return { dias: diasDaSequencia.length, ultimaFalta, diasDaSequencia }
}

// AVISO: faltas seguidas ainda sem providência. PROVIDENCIA: já tem sequência, mas a direção já tratou.
export function situacaoDasFaltas(
  itens: { situacao: string; data: Date }[],
  cobreAte?: Date | null,
): 'AVISO' | 'PROVIDENCIA' | null {
  if (diasDeFaltaSeguidos(itens, cobreAte).dias >= FALTAS_PARA_AVISO) return 'AVISO'
  if (cobreAte && diasDeFaltaSeguidos(itens).dias >= FALTAS_PARA_AVISO) return 'PROVIDENCIA'
  return null
}
