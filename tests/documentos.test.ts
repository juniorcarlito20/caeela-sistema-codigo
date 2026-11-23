import { describe, it, expect } from 'vitest'
import { validarDescricao, validarEnvio, TIPOS_DOCUMENTO } from '@/domain/documentos'

describe('envio de documento', () => {
  it('aceita imagem dentro do limite', () => {
    expect(validarEnvio({ tamanhoBytes: 400_000, mime: 'image/jpeg' })).toBeNull()
  })
  it('recusa arquivo grande demais', () => {
    expect(validarEnvio({ tamanhoBytes: 9_000_000, mime: 'image/jpeg' }))
      .toBe('O arquivo é muito grande. O limite é 5 MB.')
  })
  it('recusa tipo não suportado', () => {
    expect(validarEnvio({ tamanhoBytes: 1000, mime: 'application/zip' }))
      .toBe('Envie uma foto (JPG ou PNG) ou um PDF.')
  })
  it('tem o tipo relatório médico', () => {
    expect(TIPOS_DOCUMENTO).toContain('RELATORIO_MEDICO')
  })
  it('aceita arquivo exatamente no limite de 5 MB', () => {
    expect(validarEnvio({ tamanhoBytes: 5 * 1024 * 1024, mime: 'image/png' })).toBeNull()
  })
  it('aceita PDF de 2 MB', () => {
    expect(validarEnvio({ tamanhoBytes: 2 * 1024 * 1024, mime: 'application/pdf' })).toBeNull()
  })
})

describe('descrição do documento', () => {
  it('aceita descrição vazia', () => {
    expect(validarDescricao('')).toBeNull()
  })
  it('aceita descrição curta', () => {
    expect(validarDescricao('Dra. Ana — fonoaudiologia')).toBeNull()
  })
  it('recusa descrição maior que 200 caracteres', () => {
    expect(validarDescricao('a'.repeat(201)))
      .toBe('A descrição é muito longa. O limite é 200 caracteres.')
  })
  it('aceita descrição exatamente no limite de 200 caracteres', () => {
    expect(validarDescricao('a'.repeat(200))).toBeNull()
  })
})
