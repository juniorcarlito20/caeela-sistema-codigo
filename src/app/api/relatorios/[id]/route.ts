import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno } from '@/lib/registro'

// Quem emitiu o relatório (ou a direção) pode excluí-lo. Exclusão lógica: vai para a lixeira da
// direção por 30 dias e dá para restaurar, como os documentos.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para excluir relatórios.' }, { status: 401 })
  }

  const { id } = await params
  const relatorio = await prisma.relatorio.findUnique({ where: { id } })
  if (!relatorio || relatorio.excluidoEm) {
    return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  }
  if (sessao.user.perfil !== 'ADMIN' && relatorio.autorId !== sessao.user.id) {
    return NextResponse.json({ erro: 'Só quem emitiu o relatório (ou a direção) pode excluí-lo.' }, { status: 403 })
  }

  const quando = new Date()
  const quem = sessao.user.name ?? sessao.user.id
  await prisma.relatorio.update({ where: { id }, data: { excluidoEm: quando, excluidoPor: quem } })
  // O relatório sem anamnese também está na pasta Documentos (mesmo arquivo): sai de lá junto.
  if (relatorio.pdfChave) {
    await prisma.documento.updateMany({
      where: { alunoId: relatorio.alunoId, chave: relatorio.pdfChave, excluidoEm: null },
      data: { excluidoEm: quando, excluidoPor: quem },
    })
  }
  // Só quem e sobre quem; nunca o conteúdo (o relatório pode ter anamnese em anexo).
  await registrarAcesso(
    sessao.user.id,
    'EXCLUIU_RELATORIO',
    `${await nomeDoAluno(relatorio.alunoId)} (relatorio:${id}${relatorio.comAnamnese ? ' · com anamnese' : ''})`,
  )
  return NextResponse.json({ ok: true })
}
