import { prisma } from '@/db/prisma'
import type { MudancaHorarios } from '@/domain/desfazer'

// Registra quem abriu qual prontuário e quando (exigência prática da LGPD).
// Nunca deixa a leitura quebrar por causa do registro.
export async function registrarAcesso(
  usuarioId: string,
  acao: string,
  alvo: string,
  // Só nas mudanças de agenda: guarda o antes/depois para o botão Desfazer do Histórico.
  mudanca?: MudancaHorarios,
): Promise<void> {
  try {
    await prisma.registroAcesso.create({ data: { usuarioId, acao, alvo, ...(mudanca ? { mudanca } : {}) } })
  } catch (e) {
    console.error('Não consegui registrar o acesso:', e)
  }
}

const DIAS_POR_EXTENSO = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta']

// "terça 09:30" — jeito curto de escrever um horário nas linhas do histórico.
export function quando(diaSemana: number, hora: string): string {
  return `${DIAS_POR_EXTENSO[diaSemana] ?? diaSemana} ${hora}`
}

export async function nomeDoAluno(id: string): Promise<string> {
  const a = await prisma.aluno.findUnique({ where: { id }, select: { nome: true } })
  return a?.nome ?? 'aluno'
}

export async function nomeDoUsuario(id: string): Promise<string> {
  const u = await prisma.usuario.findUnique({ where: { id }, select: { nome: true } })
  return u?.nome ?? 'profissional'
}

// Nome do aluno dono de uma evolução (evolução -> atendimento -> vínculo -> aluno).
export async function nomeDoAlunoDaEvolucao(evolucaoId: string): Promise<string> {
  const e = await prisma.evolucao.findUnique({
    where: { id: evolucaoId },
    select: { atendimento: { select: { vinculo: { select: { aluno: { select: { nome: true } } } } } } },
  })
  return e?.atendimento.vinculo.aluno.nome ?? 'aluno'
}
