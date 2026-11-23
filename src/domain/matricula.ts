export function proximaMatricula(ano: number, ultima?: string): string {
  const seq = ultima?.startsWith(`${ano}-`) ? Number(ultima.split('-')[1]) + 1 : 1
  return `${ano}-${String(seq).padStart(4, '0')}`
}

export const MENSAGEM_MATRICULA = 'Não consegui gerar a matrícula. Tente de novo.'

function erroMatriculaDuplicada(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const obj = e as { code?: unknown; meta?: unknown }
  if (obj.code !== 'P2002') return false
  const alvo = (obj.meta as { target?: unknown } | undefined)?.target
  if (Array.isArray(alvo)) return alvo.includes('matricula')
  if (typeof alvo === 'string') return alvo.includes('matricula')
  return false
}

// Cria com a próxima matrícula do ano; se dois cadastros simultâneos calcularem
// o mesmo número, o banco recusa o segundo (P2002) e tentamos de novo com o
// número recalculado, até 5 vezes.
export async function gerarMatriculaUnica<T>(
  ano: number,
  buscarUltima: () => Promise<string | null | undefined>,
  criar: (matricula: string) => Promise<T>,
  tentativas = 5,
  // Como montar o número seguinte; as pessoas de fora usam outro prefixo (EXT-).
  proxima: (ano: number, ultima?: string) => string = proximaMatricula,
): Promise<T> {
  let ultima = await buscarUltima()
  for (let t = 1; t <= tentativas; t++) {
    const matricula = proxima(ano, ultima ?? undefined)
    try {
      return await criar(matricula)
    } catch (e) {
      if (!erroMatriculaDuplicada(e)) throw e
      if (t < tentativas) {
        ultima = await buscarUltima()
        continue
      }
      throw new Error(MENSAGEM_MATRICULA)
    }
  }
  throw new Error(MENSAGEM_MATRICULA)
}

export function pendenciasDoAluno(a: {
  cpf?: string | null; responsavel?: string | null; whatsapp?: string | null
}): string[] {
  const p: string[] = []
  if (!a.cpf) p.push('sem CPF')
  if (!a.responsavel) p.push('sem responsável')
  if (!a.whatsapp) p.push('sem WhatsApp')
  return p
}

const ROTULOS: Record<string, string> = {
  ESPERA: 'Lista de espera',
  ATENDIMENTO: 'Em atendimento',
  PAUSA: 'Em pausa',
  ALTA: 'Alta',
  DESLIGADO: 'Desligado',
}

export function rotuloSituacao(situacao: string): string {
  return ROTULOS[situacao] ?? situacao
}
