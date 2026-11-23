// O servidor roda em UTC, 3 horas adiantado em relação a Licínio de Almeida (Bahia, UTC-3,
// sem horário de verão). Toda data e hora mostrada na tela passa por aqui.
export const FUSO = 'America/Bahia'

export function formatarDataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: FUSO })
}

export function formatarHora(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
}

// Dia de hoje (AAAA-MM-DD) no fuso do centro, e não no do servidor.
export function hojeNoFuso(agora = new Date()): string {
  return agora.toLocaleDateString('sv-SE', { timeZone: FUSO })
}

// "Hoje" do centro como data do servidor (meio-dia do dia de hoje em Licínio de Almeida). Use no
// lugar de `new Date()` para saber que dia é hoje ou amanhã: depois das 21h o servidor (UTC)
// já está no dia seguinte.
export function hojeDoCentro(agora = new Date()): Date {
  return new Date(`${hojeNoFuso(agora)}T12:00:00`)
}
