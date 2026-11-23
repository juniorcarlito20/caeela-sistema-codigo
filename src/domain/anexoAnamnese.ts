import { agruparPorSecao, imcDoCampo, quadroDeResultado, resumirEscala, type Campo, type QuadroDeResultado } from './anamnese'

export type LinhaAnexo = { rotulo: string; resposta: string }
export type SecaoAnexo = { titulo: string; linhas: LinhaAnexo[]; resumo: string[] }
// `quadro`: o resultado da escala em barras (só nas anamneses de escala que têm alguma resposta).
export type AnexoAnamnese = { modelo: string; autor: string; data: Date; secoes: SecaoAnexo[]; quadro?: QuadroDeResultado | null }

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// 2026-10-20 → 20/10/2026 (as datas respondidas na anamnese ficam guardadas como AAAA-MM-DD).
const dataBR = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v)

// As linhas de texto do resumo de uma escala, para o anexo em PDF (a mesma conta da tela).
export function linhasDoResumo(campos: Campo[], respostas: Record<string, unknown>, secao: string): string[] {
  const r = resumirEscala(campos, respostas, secao)
  const linhas = [
    `Respondidas: ${r.respondidas} de ${r.total} · Soma: ${r.soma} de ${r.somaMaxima} · Média por item: ${r.media === null ? '—' : num(r.media)}`,
    `Itens “Bastante” ou “Demais”: ${r.altos} de ${r.total}`,
  ]
  if (r.referencia === 'atingida') linhas.push(`Atinge a referência do questionário (${r.minimo} ou mais itens “Bastante” ou “Demais”).`)
  if (r.referencia === 'abaixo') linhas.push(`Abaixo da referência do questionário (${r.minimo} itens).`)
  if (r.referencia === 'incompleta') linhas.push(`Referência de ${r.minimo} itens não calculada: faltam respostas neste grupo.`)
  return linhas
}

// Monta o anexo de uma anamnese: só as seções com resposta, só o que foi respondido.
export function montarAnexoAnamnese(
  modelo: { nome: string; campos: Campo[] },
  respostas: Record<string, unknown>,
  autor: string,
  data: Date,
): AnexoAnamnese {
  const secoes: SecaoAnexo[] = []
  for (const s of agruparPorSecao(modelo.campos)) {
    const linhas: LinhaAnexo[] = []
    const notasImc: string[] = []
    for (const c of s.campos) {
      if (c.tipo === 'imc') {
        // Conta feita sozinha: só entra no anexo se peso e altura deram um resultado.
        const imc = imcDoCampo(c, respostas)
        if (imc) {
          linhas.push({ rotulo: c.rotulo, resposta: imc.texto })
          if (c.nota) notasImc.push(c.nota)
        }
        continue
      }
      if (c.tipo === 'aviso' || c.tipo === 'resumo') continue
      const v = String(respostas[c.id] ?? '').trim()
      if (v === '') continue
      linhas.push({ rotulo: c.rotulo, resposta: c.tipo === 'data' ? dataBR(v) : v })
    }
    if (linhas.length === 0) continue
    const campoResumo = s.campos.find((c) => c.tipo === 'resumo')
    secoes.push({
      titulo: s.secao,
      linhas,
      // O texto de apoio do grupo (ex.: "é triagem, não diagnóstico") vai junto: quem lê o anexo fora do centro precisa dele.
      resumo: [
        ...(campoResumo
          ? [...linhasDoResumo(modelo.campos, respostas, s.secao), ...(campoResumo.nota ? [campoResumo.nota] : [])]
          : []),
        ...notasImc,
      ],
    })
  }
  const quadro = quadroDeResultado(modelo.campos, respostas)
  return { modelo: modelo.nome, autor, data, secoes, quadro: quadro && quadro.grupos.some((g) => g.respondidas > 0) ? quadro : null }
}
