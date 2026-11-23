import { prisma } from '@/db/prisma'
import { excluirArquivo } from './storage'

export const DIAS_LIXEIRA = 30

// Devolve os ids com mais de `dias` dias de excluído.
export function itensExpirados<T extends { id: string; excluidoEm: Date | null }>(
  itens: T[],
  agora: Date,
  dias = DIAS_LIXEIRA,
): string[] {
  const limite = agora.getTime() - dias * 86400000
  return itens
    .filter((i) => i.excluidoEm && i.excluidoEm.getTime() < limite)
    .map((i) => i.id)
}

export type ResultadoLimpeza = {
  alunos: number
  documentos: number
  evolucoes: number
  horarios: number
  relatorios: number
}

// Apaga de verdade o que passou de 30 dias na lixeira, inclusive os arquivos.
// Chamada pela rota protegida por segredo (futura rotina diária).
export async function limparLixeira(
  agora = new Date(),
  dias = DIAS_LIXEIRA,
): Promise<ResultadoLimpeza> {
  const limite = new Date(agora.getTime() - dias * 86400000)
  const expirado = { excluidoEm: { not: null, lt: limite } }

  const [docs, relatoriosVencidos] = await Promise.all([
    prisma.documento.findMany({ where: expirado, select: { id: true, chave: true } }),
    prisma.relatorio.findMany({ where: expirado, select: { id: true, pdfChave: true } }),
  ])

  const [alunos, documentos, evolucoes, horarios, relatorios] = await Promise.all([
    prisma.aluno.deleteMany({ where: expirado }),
    prisma.documento.deleteMany({ where: expirado }),
    prisma.evolucao.deleteMany({ where: expirado }),
    prisma.horario.deleteMany({ where: expirado }),
    prisma.relatorio.deleteMany({ where: expirado }),
  ])

  // O relatório sem anamnese e o documento dele dividem o mesmo arquivo: só se apaga o arquivo
  // quando nenhum dos dois que sobrou ainda aponta para ele.
  const chaves = new Set([
    ...docs.map((d) => d.chave),
    ...relatoriosVencidos.flatMap((r) => (r.pdfChave ? [r.pdfChave] : [])),
  ])
  for (const chave of chaves) {
    const usos =
      (await prisma.documento.count({ where: { chave } })) + (await prisma.relatorio.count({ where: { pdfChave: chave } }))
    if (usos === 0) await excluirArquivo(chave)
  }
  return {
    alunos: alunos.count,
    documentos: documentos.count,
    evolucoes: evolucoes.count,
    horarios: horarios.count,
    relatorios: relatorios.count,
  }
}
