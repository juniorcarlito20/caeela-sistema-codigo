import type { Prisma } from '@prisma/client'
import { prisma } from '@/db/prisma'
import type { SugestaoTela } from '@/domain/sugestoes'

// O que a tela precisa de cada sugestão (aluno, área e autor).
export const incluirSugestao = {
  aluno: { select: { nome: true } },
  area: { select: { nome: true } },
  autor: { select: { nome: true } },
} as const

type Linha = Prisma.SugestaoGetPayload<{ include: typeof incluirSugestao }>

// Aluno enviado para a lixeira: a ficha dele dá 404, então a sugestão dele também não aparece
// (nem no Painel, nem na página da direção, nem no contador do menu).
export const filtroAlunoAtivo = { aluno: { excluidoEm: null } } as const

export function paraTela(s: Linha): SugestaoTela {
  return {
    id: s.id,
    alunoId: s.alunoId,
    alunoNome: s.aluno.nome,
    tipo: s.tipo,
    areaNome: s.area?.nome ?? null,
    texto: s.texto,
    situacao: s.situacao,
    observacaoDirecao: s.observacaoDirecao,
    autorNome: s.autor.nome,
    criadoEm: s.criadoEm.toISOString(),
    fechadaEm: s.fechadaEm ? s.fechadaEm.toISOString() : null,
  }
}

// Sugestões de um aluno: a direção vê todas; o profissional, só as que ele mesmo escreveu.
export async function sugestoesDoAluno(alunoId: string, perfil: string, usuarioId: string): Promise<SugestaoTela[]> {
  const linhas = await prisma.sugestao.findMany({
    where: {
      alunoId,
      ...(perfil === 'ADMIN' ? {} : { autorId: usuarioId }),
      ...filtroAlunoAtivo,
    },
    include: incluirSugestao,
    orderBy: { criadoEm: 'desc' },
  })
  return linhas.map(paraTela)
}
