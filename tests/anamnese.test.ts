import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarRespostas, agruparPorSecao, resumirEscala, ehPergunta, quadroDeResultado, type Campo } from '@/domain/anamnese'

const campos: Campo[] = [
  { id: 'nome', rotulo: 'Nome', tipo: 'texto', secao: 'Identificação' },
  { id: 'nasc', rotulo: 'Data de nascimento', tipo: 'data', secao: 'Identificação' },
  { id: 'prenatal', rotulo: 'Realizou pré-natal?', tipo: 'sim_nao', secao: 'Gestação' },
]

describe('anamnese', () => {
  it('agrupa campos por seção preservando a ordem', () => {
    const g = agruparPorSecao(campos)
    expect(g.map((s) => s.secao)).toEqual(['Identificação', 'Gestação'])
    expect(g[0].campos).toHaveLength(2)
  })
  it('aceita respostas parciais (nada é obrigatório)', () => {
    expect(validarRespostas(campos, { nome: 'Fulano' })).toEqual([])
  })
  it('recusa valor fora do domínio de sim/não', () => {
    expect(validarRespostas(campos, { prenatal: 'talvez' }))
      .toEqual(['Realizou pré-natal?: responda Sim ou Não.'])
  })
  it('recusa data inválida', () => {
    expect(validarRespostas(campos, { nasc: '31/31/2020' }))
      .toEqual(['Data de nascimento: data inválida.'])
  })
  it('recusa escolha fora das opções', () => {
    const escolha: Campo[] = [
      { id: 'parto', rotulo: 'Tipo de parto', tipo: 'escolha', opcoes: ['Normal', 'Cesárea'], secao: 'Gestação' },
    ]
    expect(validarRespostas(escolha, { parto: 'De cócoras' }))
      .toEqual(['Tipo de parto: escolha uma das opções.'])
    expect(validarRespostas(escolha, { parto: 'Cesárea' })).toEqual([])
  })
  it('campo não preenchido nunca gera erro', () => {
    expect(validarRespostas(campos, {})).toEqual([])
    expect(validarRespostas(campos, { nome: '', nasc: '', prenatal: '' })).toEqual([])
  })
  it('os 8 modelos reais têm campos válidos e ids únicos', () => {
    const arquivos = readdirSync(join('src', 'db', 'modelos')).filter((a) => a.endsWith('.json'))
    expect(arquivos).toHaveLength(8)
    for (const arquivo of arquivos) {
      const modelo = JSON.parse(readFileSync(join('src', 'db', 'modelos', arquivo), 'utf-8')) as {
        nome: string
        campos: Campo[]
      }
      expect(modelo.nome, arquivo).toBeTruthy()
      expect(modelo.campos.length, arquivo).toBeGreaterThan(0)
      const ids = modelo.campos.map((c) => c.id)
      expect(new Set(ids).size, `${arquivo}: ids repetidos`).toBe(ids.length)
      for (const c of modelo.campos) {
        expect(c.id, arquivo).toBeTruthy()
        expect(c.rotulo, arquivo).toBeTruthy()
        expect(['texto', 'textarea', 'data', 'sim_nao', 'escolha', 'escala', 'resumo', 'aviso', 'imc'], `${arquivo}:${c.id}`).toContain(c.tipo)
        expect(c.secao, arquivo).toBeTruthy()
      }
    }
  })
})

describe('escala (SNAP-IV)', () => {
  const opcoes = ['Nem um pouco', 'Só um pouco', 'Bastante', 'Demais']
  const campos: Campo[] = [
    { id: 'i1', rotulo: '1. Item um', tipo: 'escala', opcoes, secao: 'Grupo A' },
    { id: 'i2', rotulo: '2. Item dois', tipo: 'escala', opcoes, secao: 'Grupo A' },
    { id: 'i3', rotulo: '3. Item três', tipo: 'escala', opcoes, secao: 'Grupo A' },
    { id: 'rA', rotulo: 'Resumo A', tipo: 'resumo', secao: 'Grupo A', minimo: 2 },
    { id: 'j1', rotulo: '4. Item quatro', tipo: 'escala', opcoes, secao: 'Grupo B' },
    { id: 'rB', rotulo: 'Resumo B', tipo: 'resumo', secao: 'Grupo B' },
    { id: 'av', rotulo: 'Aviso', tipo: 'aviso', secao: 'Grupo B' },
  ]

  it('valida a escala como uma escolha entre as opções', () => {
    expect(validarRespostas(campos, { i1: 'Bastante' })).toEqual([])
    expect(validarRespostas(campos, { i1: 'Mais ou menos' })).toEqual(['1. Item um: escolha uma das opções.'])
  })
  it('resumo e aviso não pedem resposta e nunca geram erro', () => {
    expect(validarRespostas(campos, { rA: 'qualquer coisa', av: 'x' })).toEqual([])
    expect(ehPergunta(campos[3])).toBe(false)
    expect(ehPergunta(campos[6])).toBe(false)
    expect(ehPergunta(campos[0])).toBe(true)
  })
  it('calcula soma, média e itens altos', () => {
    const r = resumirEscala(campos, { i1: 'Bastante', i2: 'Demais', i3: 'Nem um pouco' }, 'Grupo A')
    expect(r).toMatchObject({ total: 3, respondidas: 3, soma: 5, somaMaxima: 9, altos: 2, minimo: 2 })
    expect(r.media).toBeCloseTo(5 / 3)
  })
  it('referência atingida, abaixo e incompleta', () => {
    expect(resumirEscala(campos, { i1: 'Bastante', i2: 'Demais', i3: 'Nem um pouco' }, 'Grupo A').referencia).toBe('atingida')
    expect(resumirEscala(campos, { i1: 'Só um pouco', i2: 'Bastante', i3: 'Só um pouco' }, 'Grupo A').referencia).toBe('abaixo')
    expect(resumirEscala(campos, { i1: 'Demais' }, 'Grupo A').referencia).toBe('incompleta')
  })
  it('grupo sem minimo não tem referência, só os números', () => {
    const r = resumirEscala(campos, { j1: 'Demais' }, 'Grupo B')
    expect(r).toMatchObject({ total: 1, respondidas: 1, soma: 3, altos: 1, minimo: null, referencia: null })
  })
  it('resposta fora das opções ou em branco não conta', () => {
    const r = resumirEscala(campos, { i1: 'Talvez', i2: '' }, 'Grupo A')
    expect(r).toMatchObject({ respondidas: 0, soma: 0, altos: 0 })
    expect(r.media).toBeNull()
  })
})

describe('quadroDeResultado (visual da escala)', () => {
  const opcoes = ['Nem um pouco', 'Só um pouco', 'Bastante', 'Demais']
  const campos: Campo[] = [
    { id: 'a1', rotulo: '1. Item', tipo: 'escala', opcoes, secao: 'Desatenção (itens 1 a 2)' },
    { id: 'a2', rotulo: '2. Item', tipo: 'escala', opcoes, secao: 'Desatenção (itens 1 a 2)' },
    { id: 'ra', rotulo: 'Resumo', tipo: 'resumo', secao: 'Desatenção (itens 1 a 2)', minimo: 2 },
    { id: 'b1', rotulo: '3. Item', tipo: 'escala', opcoes, secao: 'Oposição e desafio (item 3)' },
    { id: 'rb', rotulo: 'Resumo', tipo: 'resumo', secao: 'Oposição e desafio (item 3)' },
    { id: 'obs', rotulo: 'Observações', tipo: 'textarea', secao: 'Observações' },
  ]
  it('modelo sem resumo não tem quadro', () => {
    expect(quadroDeResultado([{ id: 'x', rotulo: 'X', tipo: 'texto', secao: 'S' }], {})).toBeNull()
  })
  it('um grupo por resumo, com o nome sem os parênteses', () => {
    const q = quadroDeResultado(campos, {})!
    expect(q.grupos.map((g) => g.nome)).toEqual(['Desatenção', 'Oposição e desafio'])
  })
  it('traz os itens altos, a soma e a referência de cada grupo', () => {
    const q = quadroDeResultado(campos, { a1: 'Bastante', a2: 'Demais', b1: 'Só um pouco' })!
    expect(q.grupos[0]).toMatchObject({ total: 2, altos: 2, soma: 5, somaMaxima: 6, minimo: 2, referencia: 'atingida' })
    expect(q.grupos[1]).toMatchObject({ total: 1, altos: 0, soma: 1, minimo: null, referencia: null })
  })
  it('síntese neutra: atingida, nenhum grupo, ou nada enquanto faltar resposta', () => {
    expect(quadroDeResultado(campos, { a1: 'Bastante', a2: 'Demais' })!.sintese).toBe('Referência atingida em: desatenção.')
    expect(quadroDeResultado(campos, { a1: 'Nem um pouco', a2: 'Só um pouco' })!.sintese).toBe('Nenhum grupo atingiu a referência.')
    expect(quadroDeResultado(campos, { a1: 'Demais' })!.sintese).toBeNull()
  })
})
