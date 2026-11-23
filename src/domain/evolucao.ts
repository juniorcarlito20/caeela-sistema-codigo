import { podeVerProntuario, type Sessao } from './permissoes'
import { podeVerRegistroClinico, type SessaoClinica, type TransferenciaVista } from './transferencia'

export function filtrarEvolucoesVisiveis<T extends { autorId: string }>(s: Sessao, itens: T[]): T[] {
  return itens.filter((i) => podeVerProntuario(s, i))
}

export type EvolucaoAnterior = {
  id: string
  autorId: string
  autorNome: string
  criadoEm: Date
  data: Date // dia do atendimento
  hora: string
  atividade: string
  objetivo: string
  observacoes: string | null
}

// As últimas evoluções da criança para mostrar na tela de escrever a nova (só as anteriores ao
// atendimento aberto). O profissional vê as que já pode ver no prontuário (as dele e as recebidas por
// transferência); a direção vê as do profissional daquele atendimento, que é o contexto da terapia.
export function ultimasEvolucoes(
  itens: EvolucaoAnterior[],
  p: {
    sessao: SessaoClinica
    transferencias: TransferenciaVista[]
    profissionalDoAtendimento: string
    antesDe: { data: Date; hora: string }
    limite?: number
  },
): EvolucaoAnterior[] {
  const chave = (d: Date, h: string) => `${d.toISOString().slice(0, 10)} ${h}`
  const limiteChave = chave(p.antesDe.data, p.antesDe.hora)
  return itens
    .filter((e) => chave(e.data, e.hora) < limiteChave)
    .filter((e) =>
      p.sessao.perfil === 'ADMIN'
        ? e.autorId === p.profissionalDoAtendimento
        : podeVerRegistroClinico(p.sessao, { autorId: e.autorId, criadoEm: e.criadoEm }, p.transferencias),
    )
    .sort((a, b) => (chave(a.data, a.hora) < chave(b.data, b.hora) ? 1 : -1))
    .slice(0, p.limite ?? 3)
}
