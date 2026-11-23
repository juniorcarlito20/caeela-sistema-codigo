import { describe, it, expect } from 'vitest'
import {
  rotuloTipo, validarNovaSugestao, validarObservacao, resumoDaSugestao, ROTULO_SITUACAO, LIMITE_TEXTO, LIMITE_OBSERVACAO,
} from '@/domain/sugestoes'

describe('rótulos', () => {
  it('o tipo do centro mostra a área; os outros não', () => {
    expect(rotuloTipo('PROFISSIONAL_DO_CENTRO', 'Fonoaudiologia')).toBe('Outro profissional do centro · Fonoaudiologia')
    expect(rotuloTipo('PROFISSIONAL_DO_CENTRO')).toBe('Outro profissional do centro')
    expect(rotuloTipo('EXAME_OU_CONSULTA', 'Fonoaudiologia')).toBe('Exame ou consulta fora do centro')
    expect(rotuloTipo('OUTRA')).toBe('Outra sugestão')
  })
  it('as três situações têm rótulo', () => {
    expect(ROTULO_SITUACAO).toEqual({ PENDENTE: 'Aguardando a direção', RESOLVIDA: 'Resolvida', DESCARTADA: 'Descartada' })
  })
})

describe('validarNovaSugestao', () => {
  const texto = 'Sugiro avaliação com a fonoaudióloga.'
  it('aceita cada tipo com os dados certos', () => {
    expect(validarNovaSugestao({ tipo: 'PROFISSIONAL_DO_CENTRO', areaId: 'a1', texto })).toBeNull()
    expect(validarNovaSugestao({ tipo: 'EXAME_OU_CONSULTA', texto })).toBeNull()
    expect(validarNovaSugestao({ tipo: 'OUTRA', areaId: null, texto })).toBeNull()
  })
  it('o tipo do centro exige a área', () => {
    expect(validarNovaSugestao({ tipo: 'PROFISSIONAL_DO_CENTRO', texto })).toBe('Escolha a área do profissional sugerido.')
  })
  it('recusa tipo desconhecido', () => {
    expect(validarNovaSugestao({ tipo: 'QUALQUER', texto })).toBe('Escolha o tipo da sugestão.')
  })
  it('recusa texto curto demais ou longo demais', () => {
    expect(validarNovaSugestao({ tipo: 'OUTRA', texto: '  ab  ' })).toBe('Explique a sugestão em pelo menos 5 letras.')
    expect(validarNovaSugestao({ tipo: 'OUTRA', texto: 'x'.repeat(LIMITE_TEXTO + 1) })).toContain('muito longo')
  })
})

describe('validarObservacao', () => {
  it('é opcional e tem limite', () => {
    expect(validarObservacao(undefined)).toBeNull()
    expect(validarObservacao(null)).toBeNull()
    expect(validarObservacao('Aluno encaminhado.')).toBeNull()
    expect(validarObservacao('x'.repeat(LIMITE_OBSERVACAO + 1))).toContain('muito longa')
  })
})

describe('resumoDaSugestao (linha do Painel)', () => {
  it('diz o que foi sugerido e por quem, só com o primeiro nome', () => {
    expect(resumoDaSugestao({ tipo: 'PROFISSIONAL_DO_CENTRO', areaNome: 'Fonoaudiologia', autorNome: 'Maria da Silva' }))
      .toBe('Fonoaudiologia · por Maria')
    expect(resumoDaSugestao({ tipo: 'PROFISSIONAL_DO_CENTRO', areaNome: null, autorNome: 'Maria da Silva' }))
      .toBe('Outro profissional do centro · por Maria')
    expect(resumoDaSugestao({ tipo: 'EXAME_OU_CONSULTA', areaNome: null, autorNome: 'João Souza' }))
      .toBe('Exame ou consulta fora do centro · por João')
    expect(resumoDaSugestao({ tipo: 'OUTRA', areaNome: null, autorNome: 'João Souza' })).toBe('Outra sugestão · por João')
  })
})
