import { describe, it, expect } from 'vitest'
import { calcularImc, imcDoCampo, ehPergunta, validarRespostas, type Campo } from '@/domain/anamnese'
import { montarAnexoAnamnese } from '@/domain/anexoAnamnese'

describe('calcularImc', () => {
  it('peso ÷ altura ao quadrado, com uma casa decimal e vírgula', () => {
    expect(calcularImc('32', '1,35')?.texto).toBe('17,6 kg/m²')
    expect(calcularImc('70', '1.75')?.texto).toBe('22,9 kg/m²')
  })
  it('aceita unidades e vírgula no texto digitado', () => {
    expect(calcularImc('32,5 kg', '1,35 m')?.texto).toBe('17,8 kg/m²')
  })
  it('altura acima de 3 vale como centímetros', () => {
    expect(calcularImc('32', '135')?.texto).toBe('17,6 kg/m²')
    expect(calcularImc('32', '135 cm')?.texto).toBe('17,6 kg/m²')
  })
  it('sem peso ou sem altura, ou com valor impossível, não calcula', () => {
    expect(calcularImc('', '1,35')).toBeNull()
    expect(calcularImc('32', '')).toBeNull()
    expect(calcularImc(undefined, undefined)).toBeNull()
    expect(calcularImc('abc', '1,35')).toBeNull()
    expect(calcularImc('0', '1,35')).toBeNull()
    expect(calcularImc('900', '1,35')).toBeNull()
    expect(calcularImc('32', '0,1')).toBeNull()
    expect(calcularImc('32', '9')).toBeNull() // 9 vira 0,09 m
  })
})

const campos: Campo[] = [
  { id: 'peso', rotulo: 'Peso (kg)', tipo: 'texto', secao: 'Medidas' },
  { id: 'altura', rotulo: 'Altura (m)', tipo: 'texto', secao: 'Medidas' },
  { id: 'imc', rotulo: 'IMC (calculado)', tipo: 'imc', secao: 'Medidas', de: { peso: 'peso', altura: 'altura' }, nota: 'Em crianças, leia pelo percentil.' },
]

describe('campo tipo imc', () => {
  it('não é pergunta: não recebe resposta nem gera erro', () => {
    expect(ehPergunta(campos[2])).toBe(false)
    expect(validarRespostas(campos, { peso: '32', altura: '1,35', imc: 'qualquer coisa' })).toEqual([])
  })
  it('imcDoCampo usa os campos que ele aponta', () => {
    expect(imcDoCampo(campos[2], { peso: '32', altura: '1,35' })?.texto).toBe('17,6 kg/m²')
    expect(imcDoCampo(campos[2], { peso: '32' })).toBeNull()
    expect(imcDoCampo({ ...campos[2], de: undefined }, { peso: '32', altura: '1,35' })).toBeNull()
  })
  it('o anexo do relatório leva o IMC calculado e a nota de apoio', () => {
    const a = montarAnexoAnamnese({ nome: 'Modelo', campos }, { peso: '32', altura: '1,35' }, 'Profissional Teste', new Date())
    const linhas = a.secoes[0].linhas
    expect(linhas.map((l) => l.rotulo)).toEqual(['Peso (kg)', 'Altura (m)', 'IMC (calculado)'])
    expect(linhas[2].resposta).toBe('17,6 kg/m²')
    expect(a.secoes[0].resumo).toEqual(['Em crianças, leia pelo percentil.'])
  })
  it('sem peso e altura o anexo não inventa IMC', () => {
    const a = montarAnexoAnamnese({ nome: 'Modelo', campos }, { peso: '32' }, 'Profissional Teste', new Date())
    expect(a.secoes[0].linhas.map((l) => l.rotulo)).toEqual(['Peso (kg)'])
    expect(a.secoes[0].resumo).toEqual([])
  })
})
