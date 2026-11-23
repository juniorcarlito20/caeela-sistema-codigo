import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno } from '@/lib/registro'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para excluir documentos.' }, { status: 401 })
  }
  if (sessao.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção exclui documentos.' }, { status: 403 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({ where: { id } })
  if (!documento || documento.excluidoEm) {
    return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 })
  }

  // Exclusão lógica: vai para a lixeira, o arquivo fica guardado.
  await prisma.documento.update({
    where: { id },
    data: { excluidoEm: new Date(), excluidoPor: sessao.user.name ?? sessao.user.id },
  })
  await registrarAcesso(
    sessao.user.id,
    'EXCLUIU_DOCUMENTO',
    `${await nomeDoAluno(documento.alunoId)} (${documento.nomeArquivo})`,
  )
  return NextResponse.json({ ok: true })
}
