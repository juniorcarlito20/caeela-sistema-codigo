import { describe, it, expect } from 'vitest'
import { montarAnexoAnamnese } from '@/domain/anexoAnamnese'
import type { Campo } from '@/domain/anamnese'

const opcoes = ['Nem um pouco', 'Só um pouco', 'Bastante', 'Demais']
const campos: Campo[] = [
  { id: 'av', rotulo: 'Aviso do modelo', tipo: 'aviso', secao: 'Aplicação' },
  { id: 'dia', rotulo: 'Data da aplicação', tipo: 'data', secao: 'Aplicação' },
  { id: 'i1', rotulo: '1. Item um', tipo: 'escala', opcoes, secao: 'Grupo A' },
  { id: 'i2', rotulo: '2. Item dois', tipo: 'escala', opcoes, secao: 'Grupo A' },
  { id: 'rA', rotulo: 'Resumo A', tipo: 'resumo', secao: 'Grupo A', minimo: 2, nota: 'Instrumento de triagem, não faz diagnóstico.' },
  { id: 'obs', rotulo: 'Observações', tipo: 'textarea', secao: 'Final' },
]
const modelo = { nome: 'Modelo de Teste', campos }
const quando = new Date('2026-10-21T12:00:00Z')

describe('montarAnexoAnamnese', () => {
  it('leva só o que foi respondido, na ordem das seções, e nunca o aviso', () => {
    const a = montarAnexoAnamnese(modelo, { dia: '2026-10-20', i1: 'Bastante' }, 'Profissional Teste', quando)
    expect(a.modelo).toBe('Modelo de Teste')
    expect(a.autor).toBe('Profissional Teste')
    expect(a.secoes.map((s) => s.titulo)).toEqual(['Aplicação', 'Grupo A'])
    expect(a.secoes[0].linhas).toEqual([{ rotulo: 'Data da aplicação', resposta: '20/10/2026' }])
    expect(a.secoes[1].linhas).toEqual([{ rotulo: '1. Item um', resposta: 'Bastante' }])
  })
  it('seção sem nenhuma resposta não entra', () => {
    const a = montarAnexoAnamnese(modelo, { obs: 'Texto livre' }, 'Profissional Teste', quando)
    expect(a.secoes.map((s) => s.titulo)).toEqual(['Final'])
  })
  it('seção de escala leva o resumo com soma, itens altos e a referência', () => {
    const a = montarAnexoAnamnese(modelo, { i1: 'Bastante', i2: 'Demais' }, 'Profissional Teste', quando)
    const resumo = a.secoes[0].resumo.join(' | ')
    expect(resumo).toContain('Soma: 5 de 6')
    expect(resumo).toContain('Itens “Bastante” ou “Demais”: 2 de 2')
    expect(resumo).toContain('Atinge a referência')
  })
  it('o texto de apoio do grupo (triagem, não diagnóstico) acompanha o resumo no anexo', () => {
    const a = montarAnexoAnamnese(modelo, { i1: 'Bastante', i2: 'Demais' }, 'Profissional Teste', quando)
    expect(a.secoes[0].resumo.at(-1)).toBe('Instrumento de triagem, não faz diagnóstico.')
  })
  it('leva o quadro de resultado (barras) quando há resposta de escala', () => {
    const a = montarAnexoAnamnese(modelo, { i1: 'Bastante', i2: 'Demais' }, 'Profissional Teste', quando)
    expect(a.quadro?.grupos).toHaveLength(1)
    expect(a.quadro?.grupos[0]).toMatchObject({ nome: 'Grupo A', altos: 2, total: 2, referencia: 'atingida' })
    expect(a.quadro?.sintese).toBe('Referência atingida em: grupo a.')
  })
  it('sem nenhuma resposta de escala, ou modelo sem resumo, não há quadro', () => {
    expect(montarAnexoAnamnese(modelo, { obs: 'Texto livre' }, 'Profissional Teste', quando).quadro).toBeNull()
    const semResumo = { nome: 'Sem escala', campos: campos.filter((c) => c.tipo !== 'resumo') }
    expect(montarAnexoAnamnese(semResumo, { i1: 'Bastante' }, 'Profissional Teste', quando).quadro).toBeNull()
  })
  it('seção sem resumo no modelo não ganha resumo', () => {
    const a = montarAnexoAnamnese(modelo, { obs: 'Texto livre' }, 'Profissional Teste', quando)
    expect(a.secoes[0].resumo).toEqual([])
  })
})
