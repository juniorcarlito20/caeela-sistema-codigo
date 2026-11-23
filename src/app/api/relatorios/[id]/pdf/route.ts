import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerRegistroClinico } from '@/domain/transferencia'
import { lerArquivo } from '@/lib/storage'
import { registrarAcesso } from '@/lib/registro'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para baixar o relatório.' }, { status: 401 })
  }

  const { id } = await params
  const relatorio = await prisma.relatorio.findUnique({ where: { id } })
  if (!relatorio || !relatorio.pdfChave || relatorio.excluidoEm) {
    return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  }
  const transferencias = await prisma.transferencia.findMany({
    where: { alunoId: relatorio.alunoId },
    select: { paraProfissionalId: true, criadoEm: true },
  })
  if (
    !podeVerRegistroClinico(
      { id: sessao.user.id, perfil: sessao.user.perfil },
      { autorId: relatorio.autorId, criadoEm: relatorio.criadoEm },
      transferencias,
    )
  ) {
    return NextResponse.json({ erro: 'Este relatório não é seu.' }, { status: 403 })
  }

  const arquivo = await lerArquivo(relatorio.pdfChave)
  if (!arquivo) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  }
  // Quem abriu, qual relatório. Nunca o conteúdo (o PDF pode levar anamnese em anexo).
  await registrarAcesso(
    sessao.user.id,
    'ABRIU_RELATORIO',
    `relatorio:${id}${relatorio.comAnamnese ? ' · com anamnese' : ''}`,
  )
  return new NextResponse(new Uint8Array(arquivo.corpo), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-${relatorio.tipo.toLowerCase()}.pdf"`,
    },
  })
}
