export type TipoCampo = 'texto' | 'textarea' | 'data' | 'sim_nao' | 'escolha' | 'escala' | 'resumo' | 'aviso' | 'imc'

export type Campo = {
  id: string; rotulo: string
  tipo: TipoCampo
  opcoes?: string[]; secao: string
  // Só em tipo 'resumo' (conta feita sozinha sobre os itens 'escala' da mesma seção):
  minimo?: number // a partir de quantos itens "Bastante" ou "Demais" vale a referência do questionário
  nota?: string // texto de apoio mostrado junto do resumo (ou do IMC)
  // Só em tipo 'imc' (conta feita sozinha): os ids dos campos de texto com o peso e a altura.
  de?: { peso: string; altura: string }
}

// Tipos que não recebem resposta: só mostram algo na tela ('aviso') ou uma conta feita sozinha
// ('resumo' de escala, 'imc' de peso e altura). Nada disso é guardado: é refeito sempre que se mostra.
export const TIPOS_SEM_RESPOSTA: TipoCampo[] = ['resumo', 'aviso', 'imc']
export const ehPergunta = (c: Campo): boolean => !TIPOS_SEM_RESPOSTA.includes(c.tipo)

export function agruparPorSecao(campos: Campo[]) {
  const ordem: string[] = []
  const mapa = new Map<string, Campo[]>()
  for (const c of campos) {
    if (!mapa.has(c.secao)) { mapa.set(c.secao, []); ordem.push(c.secao) }
    mapa.get(c.secao)!.push(c)
  }
  return ordem.map((secao) => ({ secao, campos: mapa.get(secao)! }))
}

export function validarRespostas(campos: Campo[], respostas: Record<string, unknown>): string[] {
  const erros: string[] = []
  for (const c of campos) {
    if (!ehPergunta(c)) continue
    const v = respostas[c.id]
    if (v === undefined || v === null || v === '') continue
    if (c.tipo === 'sim_nao' && !['Sim', 'Não', 'Não informado'].includes(String(v))) {
      erros.push(`${c.rotulo}: responda Sim ou Não.`)
    }
    if (c.tipo === 'data' && Number.isNaN(new Date(String(v)).getTime())) {
      erros.push(`${c.rotulo}: data inválida.`)
    }
    if ((c.tipo === 'escolha' || c.tipo === 'escala') && c.opcoes && !c.opcoes.includes(String(v))) {
      erros.push(`${c.rotulo}: escolha uma das opções.`)
    }
  }
  return erros
}

export type ResumoDeEscala = {
  total: number // itens da seção
  respondidas: number
  soma: number // 0 a 3 por item
  somaMaxima: number
  media: number | null // soma / respondidas
  altos: number // itens "Bastante" (2) ou "Demais" (3)
  minimo: number | null
  referencia: 'atingida' | 'abaixo' | 'incompleta' | null
}

// A resposta de um item 'escala' vale a posição dela em `opcoes` (0 a 3). O resumo é refeito
// sempre que se mostra: nada disso é guardado.
export function resumirEscala(
  campos: Campo[], respostas: Record<string, unknown>, secao: string,
): ResumoDeEscala {
  const itens = campos.filter((c) => c.secao === secao && c.tipo === 'escala')
  const resumo = campos.find((c) => c.secao === secao && c.tipo === 'resumo')
  let respondidas = 0
  let soma = 0
  let altos = 0
  for (const c of itens) {
    const ponto = (c.opcoes ?? []).indexOf(String(respostas[c.id] ?? ''))
    if (ponto < 0) continue
    respondidas++
    soma += ponto
    if (ponto >= 2) altos++
  }
  const minimo = resumo?.minimo ?? null
  const referencia: ResumoDeEscala['referencia'] =
    minimo === null ? null : respondidas < itens.length ? 'incompleta' : altos >= minimo ? 'atingida' : 'abaixo'
  return {
    total: itens.length,
    respondidas,
    soma,
    somaMaxima: itens.length * 3,
    media: respondidas > 0 ? soma / respondidas : null,
    altos,
    minimo,
    referencia,
  }
}

// Um grupo do quadro de resultado (uma barra): tirado do `resumo` de cada seção de escala.
export type GrupoQuadro = {
  nome: string // "Desatenção" (o título da seção sem os parênteses)
  total: number
  respondidas: number
  altos: number // itens "Bastante" ou "Demais"
  soma: number
  somaMaxima: number
  media: number | null
  minimo: number | null // referência do questionário; null = o grupo não tem
  referencia: ResumoDeEscala['referencia']
}
export type QuadroDeResultado = { grupos: GrupoQuadro[]; sintese: string | null }

const nomeDoGrupo = (secao: string) => secao.replace(/\s*\(.*\)\s*$/, '').trim()

// O resultado da escala num golpe de vista: uma barra por grupo (quantos itens "Bastante" ou
// "Demais") com a marca da referência, e uma frase neutra que só descreve o que apareceu — nunca
// diagnóstico. Modelo sem nenhum `resumo` não tem quadro (null).
export function quadroDeResultado(campos: Campo[], respostas: Record<string, unknown>): QuadroDeResultado | null {
  const secoes = [...new Set(campos.filter((c) => c.tipo === 'resumo').map((c) => c.secao))]
  if (secoes.length === 0) return null
  const grupos: GrupoQuadro[] = secoes.map((secao) => {
    const r = resumirEscala(campos, respostas, secao)
    return {
      nome: nomeDoGrupo(secao), total: r.total, respondidas: r.respondidas, altos: r.altos,
      soma: r.soma, somaMaxima: r.somaMaxima, media: r.media, minimo: r.minimo, referencia: r.referencia,
    }
  })
  const comRegra = grupos.filter((g) => g.minimo !== null)
  let sintese: string | null = null
  if (comRegra.length > 0 && comRegra.every((g) => g.referencia !== 'incompleta')) {
    const atingidos = comRegra.filter((g) => g.referencia === 'atingida').map((g) => g.nome.toLowerCase())
    sintese = atingidos.length > 0 ? `Referência atingida em: ${atingidos.join(' · ')}.` : 'Nenhum grupo atingiu a referência.'
  }
  return { grupos, sintese }
}

export type ResultadoImc = { valor: number; texto: string }

// O primeiro número que aparece no texto, aceitando vírgula ("32,5 kg", "1,35 m").
const primeiroNumero = (texto: unknown): number | null => {
  const achado = String(texto ?? '').replace(',', '.').match(/\d+(\.\d+)?/)
  return achado ? Number(achado[0]) : null
}

// IMC = peso (kg) ÷ altura (m) ao quadrado. Altura acima de 3 vale como centímetros ("135").
// Valores fora do possível para uma pessoa não geram conta (provável erro de digitação).
export function calcularImc(peso: unknown, altura: unknown): ResultadoImc | null {
  const kg = primeiroNumero(peso)
  let metros = primeiroNumero(altura)
  if (kg === null || metros === null) return null
  if (metros > 3) metros /= 100
  if (kg < 2 || kg > 300 || metros < 0.4 || metros > 2.5) return null
  const valor = kg / (metros * metros)
  const texto = valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return { valor, texto: `${texto} kg/m²` }
}

// O IMC de um campo tipo 'imc', a partir das respostas de peso e altura que ele aponta.
export function imcDoCampo(campo: Campo, respostas: Record<string, unknown>): ResultadoImc | null {
  return campo.de ? calcularImc(respostas[campo.de.peso], respostas[campo.de.altura]) : null
}
