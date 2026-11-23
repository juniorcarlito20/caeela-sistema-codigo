import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { lerArquivo, listarArquivos } from '@/lib/storage'
import { registrarAcesso } from '@/lib/registro'
import { PASTA_BACKUPS } from '@/scripts/backup'
import { escolherBackup } from '@/scripts/backup'

// Baixa o dump mais recente. O nome nunca vem do usuário: a escolha é feita
// aqui dentro, só entre arquivos no padrão caeela-AAAA-MM-DD.sql.gz.
export async function GET() {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção baixa backups.' },
      { status: 403 },
    )
  }

  const nome = escolherBackup(await listarArquivos(`${PASTA_BACKUPS}/`))
  if (!nome) {
    return NextResponse.json({ erro: 'Nenhum backup guardado ainda.' }, { status: 404 })
  }

  const arquivo = await lerArquivo(`${PASTA_BACKUPS}/${nome}`)
  if (!arquivo) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  }

  await registrarAcesso(sessao.user.id, 'BAIXOU_BACKUP', `backup:${nome}`)
  return new NextResponse(new Uint8Array(arquivo.corpo), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
