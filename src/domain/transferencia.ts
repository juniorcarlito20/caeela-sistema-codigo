import type { Perfil } from './acesso'

export type SessaoClinica = { id: string; perfil: Perfil }
export type RegistroClinico = { autorId: string; criadoEm: Date }
export type TransferenciaVista = { paraProfissionalId: string; criadoEm: Date }

// Quem vê um registro clínico: quem escreveu, a direção, ou quem recebeu o
// aluno por transferência DEPOIS que o registro foi escrito. Sem transferência
// explícita, colega não vê — mesmo sendo da mesma área.
export function podeVerRegistroClinico(
  s: SessaoClinica,
  r: RegistroClinico,
  transferencias: TransferenciaVista[],
): boolean {
  if (s.perfil === 'ADMIN') return true
  if (r.autorId === s.id) return true
  return transferencias.some(
    (t) => t.paraProfissionalId === s.id && t.criadoEm >= r.criadoEm,
  )
}
