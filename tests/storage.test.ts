import { describe, it, expect } from 'vitest'
import { chaveDeAssinatura, chaveDeDocumento } from '@/lib/storage'
import { resumoDispositivo } from '@/domain/dispositivo'

describe('chaves do bucket', () => {
  it('organiza assinatura por atendimento', () => {
    expect(chaveDeAssinatura('at123')).toBe('assinaturas/at123.png')
  })
  it('organiza documento por aluno', () => {
    expect(chaveDeDocumento('al9', 'laudo.jpg')).toMatch(/^alunos\/al9\/\d+-laudo\.jpg$/)
  })
  it('troca caracteres perigosos no nome do arquivo', () => {
    const chave = chaveDeDocumento('al9', 'laudo do joão (1).jpg')
    expect(chave).not.toMatch(/[ \(\)]/)
    expect(chave).toMatch(/^alunos\/al9\/\d+-[A-Za-z0-9_.-]+\.jpg$/)
  })
})

describe('resumo do dispositivo', () => {
  it('reconhece celular Android', () => {
    expect(
      resumoDispositivo(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      ),
    ).toBe('Celular Android')
  })
  it('reconhece computador Windows', () => {
    expect(
      resumoDispositivo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ),
    ).toBe('Computador Windows')
  })
  it('reconhece iPhone', () => {
    expect(
      resumoDispositivo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('iPhone')
  })
  it('não inventa quando não sabe', () => {
    expect(resumoDispositivo('')).toBe('Dispositivo não identificado')
    expect(resumoDispositivo('Etch-A-Sketch/1.0')).toBe('Dispositivo não identificado')
  })
})
