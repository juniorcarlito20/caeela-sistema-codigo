// Arquivo recebido num formulário (FormData). Não usa `instanceof File` de propósito: o Node
// do servidor de produção não tem `File` como variável global, e isso derrubava todo envio.
export type ArquivoEnviado = {
  name: string
  size: number
  type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export function ehArquivo(valor: unknown): valor is ArquivoEnviado {
  if (typeof valor !== 'object' || valor === null) return false
  const v = valor as Partial<ArquivoEnviado>
  return (
    typeof v.name === 'string' &&
    typeof v.size === 'number' &&
    typeof v.type === 'string' &&
    typeof v.arrayBuffer === 'function'
  )
}
