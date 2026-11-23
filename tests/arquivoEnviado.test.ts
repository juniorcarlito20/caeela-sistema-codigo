// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ehArquivo } from '@/lib/arquivoEnviado'

describe('ehArquivo', () => {
  it('reconhece um arquivo de formulário', async () => {
    const dados = new FormData()
    dados.set('arquivo', new Blob(['abc'], { type: 'image/jpeg' }), 'foto.jpg')
    const valor = dados.get('arquivo')
    expect(ehArquivo(valor)).toBe(true)
    if (ehArquivo(valor)) {
      expect(valor.name).toBe('foto.jpg')
      expect(valor.size).toBe(3)
      expect(Buffer.from(await valor.arrayBuffer()).toString()).toBe('abc')
    }
  })
  it('reconhece um objeto parecido com arquivo (servidor sem File global)', () => {
    expect(ehArquivo({ name: 'a.pdf', size: 10, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(10) })).toBe(true)
  })
  it('recusa texto, vazio e objetos incompletos', () => {
    expect(ehArquivo('texto')).toBe(false)
    expect(ehArquivo(null)).toBe(false)
    expect(ehArquivo(undefined)).toBe(false)
    expect(ehArquivo({ name: 'a', size: 1 })).toBe(false)
  })
})
