// Como a agenda de cada profissional funciona: semanal fixa (padrão) ou por consultas avulsas
// (psiquiatra: a direção marca; assistente social: ela mesma programa).
export const TIPOS_AGENDA = ['FIXA', 'AVULSA_DIRECAO', 'AVULSA_PROPRIA'] as const
export type TipoAgenda = (typeof TIPOS_AGENDA)[number]

export const ROTULO_TIPO_AGENDA: Record<TipoAgenda, string> = {
  FIXA: 'Agenda fixa (semanal)',
  AVULSA_DIRECAO: 'Agenda própria, com lembrete (ex.: psiquiatra)',
  AVULSA_PROPRIA: 'Agenda própria, sem lembrete (ex.: assistente social)',
}

// Explicação de cada tipo, para a direção escolher ao cadastrar ou editar o profissional.
export const DESCRICAO_TIPO_AGENDA: Record<TipoAgenda, string> = {
  FIXA: 'Atende os mesmos alunos toda semana, em horários fixos (terapias). A direção monta a grade em Agendas.',
  AVULSA_DIRECAO:
    'Atende por dia e hora, sem horário fixo; o próprio profissional ou a direção marcam. As consultas saem nos Lembretes (WhatsApp). Atende alunos e pessoas de fora do centro.',
  AVULSA_PROPRIA:
    'Atende por dia e hora, sem horário fixo (atendimentos e visitas); o próprio profissional ou a direção marcam. Não gera lembrete; no registro, marca encaminhamentos à rede (CRAS, CREAS…). Atende alunos e pessoas de fora do centro.',
}

// Selo curto da lista de Profissionais; a agenda fixa não leva selo.
export function seloTipoAgenda(tipo: string): string | null {
  if (tipo === 'AVULSA_DIRECAO' || tipo === 'AVULSA_PROPRIA') return 'Agenda própria'
  return null
}

// Selo ao lado do nome na lista de Profissionais, para diferenciar dos profissionais de agenda
// fixa: Direção, Secretaria ou Agenda própria.
export function seloDoNome(perfil: string, tipo: string): string | null {
  if (perfil === 'ADMIN') return 'Direção'
  if (perfil === 'SECRETARIA') return 'Secretaria'
  return seloTipoAgenda(tipo)
}

// Só profissional tem tipo de agenda; direção e secretaria ficam sempre em FIXA.
export function motivoParaNaoTrocarTipoAgenda(perfilFinal: string, tipoNovo: TipoAgenda): string | null {
  if (perfilFinal !== 'PROFISSIONAL' && tipoNovo !== 'FIXA') {
    return 'O tipo de agenda só vale para profissionais.'
  }
  return null
}
