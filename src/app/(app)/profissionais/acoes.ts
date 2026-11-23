'use server'

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { motivoParaNaoExcluir } from '@/domain/acesso'

async function exigirAdmin() {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') throw new Error('Só a direção pode fazer isso.')
  return sessao
}

export async function alternarSituacao(id: string, ativo: boolean) {
  const sessao = await exigirAdmin()
  const alvo = await prisma.usuario.update({ where: { id }, data: { ativo }, select: { nome: true } })
  await registrarAcesso(sessao.user.id, ativo ? 'ATIVOU_PROFISSIONAL' : 'DESATIVOU_PROFISSIONAL', alvo.nome)
}

export async function gerarSenhaProvisoria(id: string): Promise<{ senha?: string; erro?: string }> {
  try {
    const sessao = await exigirAdmin()
    const senha = randomBytes(6).toString('base64url')
    const alvo = await prisma.usuario.update({
      where: { id },
      data: { senhaHash: await bcrypt.hash(senha, 10), precisaTrocarSenha: true },
      select: { nome: true },
    })
    await registrarAcesso(sessao.user.id, 'GEROU_SENHA_PROVISORIA', alvo.nome)
    return { senha }
  } catch {
    return { erro: 'Não foi possível gerar a senha. Tente de novo.' }
  }
}

// Exclusão lógica: some das listas e não entra mais, mas o histórico (evoluções, relatórios,
// presenças) continua com o nome. Vai para a Lixeira; restaurar devolve a pessoa inativa.
export async function excluirProfissional(id: string): Promise<{ ok?: true; erro?: string }> {
  try {
    const sessao = await exigirAdmin()
    const alvo = await prisma.usuario.findUnique({
      where: { id },
      select: { nome: true, perfil: true, excluidoEm: true },
    })
    if (!alvo || alvo.excluidoEm) return { erro: 'Essa pessoa não foi encontrada.' }
    const [alunosVigentes, contasDeDirecaoAtivas] = await Promise.all([
      prisma.vinculo.count({ where: { profissionalId: id, fim: null } }),
      prisma.usuario.count({ where: { perfil: 'ADMIN', ativo: true, excluidoEm: null } }),
    ])
    const motivo = motivoParaNaoExcluir({
      quemExcluiId: sessao.user.id,
      alvoId: id,
      perfilAlvo: alvo.perfil,
      alunosVigentes,
      contasDeDirecaoAtivas,
    })
    if (motivo) return { erro: motivo }
    await prisma.usuario.update({
      where: { id },
      data: { ativo: false, excluidoEm: new Date(), excluidoPor: sessao.user.name ?? '—' },
    })
    await registrarAcesso(sessao.user.id, 'EXCLUIU_PROFISSIONAL', alvo.nome)
    return { ok: true }
  } catch {
    return { erro: 'Não foi possível excluir. Tente de novo.' }
  }
}
