// src/domain/sugestoes.ts
// Sugestão de um profissional à direção: outro profissional do centro, exame ou consulta fora
// do centro, ou outra coisa. A direção resolve ou descarta.

export type TipoSugestao = 'PROFISSIONAL_DO_CENTRO' | 'EXAME_OU_CONSULTA' | 'OUTRA'
export type SituacaoSugestao = 'PENDENTE' | 'RESOLVIDA' | 'DESCARTADA'

export const TIPOS_SUGESTAO: { id: TipoSugestao; rotulo: string; ajuda: string }[] = [
  { id: 'PROFISSIONAL_DO_CENTRO', rotulo: 'Outro profissional do centro', ajuda: 'Psicólogo, fono, psicomotricista…' },
  { id: 'EXAME_OU_CONSULTA', rotulo: 'Exame ou consulta fora do centro', ajuda: 'Exame de sangue, neuropediatra…' },
  { id: 'OUTRA', rotulo: 'Outra sugestão', ajuda: 'Qualquer outro caso' },
]

export const ROTULO_SITUACAO: Record<SituacaoSugestao, string> = {
  PENDENTE: 'Aguardando a direção',
  RESOLVIDA: 'Resolvida',
  DESCARTADA: 'Descartada',
}

export const MINIMO_TEXTO = 5
export const LIMITE_TEXTO = 1000
export const LIMITE_OBSERVACAO = 500

// A mesma frase na tela e na rota (que recusa antes de chegar no banco).
export const MSG_TIPO_INVALIDO = 'Escolha o tipo da sugestão.'

// O que as telas recebem de cada sugestão (datas como texto ISO, para passar ao navegador).
export type SugestaoTela = {
  id: string
  alunoId: string
  alunoNome: string
  tipo: TipoSugestao
  areaNome: string | null
  texto: string
  situacao: SituacaoSugestao
  observacaoDirecao: string | null
  autorNome: string
  criadoEm: string
  fechadaEm: string | null
}

export function rotuloTipo(tipo: TipoSugestao, areaNome?: string | null): string {
  const base = TIPOS_SUGESTAO.find((t) => t.id === tipo)?.rotulo ?? tipo
  return tipo === 'PROFISSIONAL_DO_CENTRO' && areaNome ? `${base} · ${areaNome}` : base
}

// Por que o formulário não pode ser enviado; null = pode.
export function validarNovaSugestao(d: { tipo: string; areaId?: string | null; texto: string }): string | null {
  if (!TIPOS_SUGESTAO.some((t) => t.id === d.tipo)) return MSG_TIPO_INVALIDO
  if (d.tipo === 'PROFISSIONAL_DO_CENTRO' && !d.areaId) return 'Escolha a área do profissional sugerido.'
  const texto = d.texto.trim()
  if (texto.length < MINIMO_TEXTO) return `Explique a sugestão em pelo menos ${MINIMO_TEXTO} letras.`
  if (texto.length > LIMITE_TEXTO) return `O texto é muito longo. O limite é ${LIMITE_TEXTO} letras.`
  return null
}

export function validarObservacao(observacao: string | null | undefined): string | null {
  if ((observacao ?? '').trim().length > LIMITE_OBSERVACAO) {
    return `A observação é muito longa. O limite é ${LIMITE_OBSERVACAO} letras.`
  }
  return null
}

// Linha curta para o Painel: "Fonoaudiologia · por Maria".
export function resumoDaSugestao(s: { tipo: TipoSugestao; areaNome: string | null; autorNome: string }): string {
  const quem = s.autorNome.trim().split(/\s+/)[0] ?? ''
  const oQue =
    s.tipo === 'PROFISSIONAL_DO_CENTRO'
      ? (s.areaNome ?? 'Outro profissional do centro')
      : s.tipo === 'EXAME_OU_CONSULTA'
        ? 'Exame ou consulta fora do centro'
        : 'Outra sugestão'
  return `${oQue} · por ${quem}`
}
