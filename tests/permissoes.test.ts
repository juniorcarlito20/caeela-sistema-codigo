import { describe, it, expect } from 'vitest'
import { podeVerProntuario, podeVerAluno } from '@/domain/permissoes'

const admin = { id: 'a1', perfil: 'ADMIN' as const }
const bruna = { id: 'p1', perfil: 'PROFISSIONAL' as const }
const carla = { id: 'p2', perfil: 'PROFISSIONAL' as const }

describe('permissões', () => {
  it('admin vê qualquer prontuário', () => {
    expect(podeVerProntuario(admin, { autorId: 'p1' })).toBe(true)
  })
  it('profissional vê apenas o que ele escreveu', () => {
    expect(podeVerProntuario(bruna, { autorId: 'p1' })).toBe(true)
    expect(podeVerProntuario(carla, { autorId: 'p1' })).toBe(false)
  })
  it('profissional vê aluno com vínculo vigente seu', () => {
    const vinculos = [{ profissionalId: 'p1', fim: null }]
    expect(podeVerAluno(bruna, vinculos)).toBe(true)
    expect(podeVerAluno(carla, vinculos)).toBe(false)
  })
  it('vínculo encerrado ainda dá acesso ao histórico do próprio profissional', () => {
    const vinculos = [{ profissionalId: 'p1', fim: new Date('2026-03-01') }]
    expect(podeVerAluno(bruna, vinculos)).toBe(true)
  })
})
