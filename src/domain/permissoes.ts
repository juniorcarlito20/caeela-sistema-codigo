import type { Perfil } from './acesso'

export type Sessao = { id: string; perfil: Perfil }

export function podeVerProntuario(s: Sessao, registro: { autorId: string }): boolean {
  return s.perfil === 'ADMIN' || registro.autorId === s.id
}

export function podeVerAluno(
  s: Sessao,
  vinculos: { profissionalId: string; fim: Date | null }[],
): boolean {
  return s.perfil === 'ADMIN' || vinculos.some((v) => v.profissionalId === s.id)
}
