export const TIPOS_DOCUMENTO = [
  'LAUDO', 'ANAMNESE', 'PESSOAL', 'AUTORIZACAO', 'RELATORIO_MEDICO', 'RELATORIO_CENTRO',
  'OUTRO',
] as const

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const ROTULOS_TIPO: Record<TipoDocumento, string> = {
  LAUDO: 'Laudo médico',
  ANAMNESE: 'Anamnese em papel',
  PESSOAL: 'Documento pessoal',
  AUTORIZACAO: 'Autorização',
  RELATORIO_MEDICO: 'Relatório médico',
  RELATORIO_CENTRO: 'Relatório do centro',
  OUTRO: 'Outro',
}

const LIMITE = 5 * 1024 * 1024
const ACEITOS = ['image/jpeg', 'image/png', 'application/pdf']
export const LIMITE_DESCRICAO = 200

export function validarEnvio(a: { tamanhoBytes: number; mime: string }): string | null {
  if (!ACEITOS.includes(a.mime)) return 'Envie uma foto (JPG ou PNG) ou um PDF.'
  if (a.tamanhoBytes > LIMITE) return 'O arquivo é muito grande. O limite é 5 MB.'
  return null
}

export function validarDescricao(descricao: string): string | null {
  if (descricao.length > LIMITE_DESCRICAO) {
    return `A descrição é muito longa. O limite é ${LIMITE_DESCRICAO} caracteres.`
  }
  return null
}
