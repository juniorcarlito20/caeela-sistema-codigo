import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'

// Ação rápida do aviso "pausas com previsão de retorno" no painel: volta o
// aluno pra fila de espera. A data de retorno fica guardada — é o que
// diferencia esse aluno de quem está chegando agora na fila.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção pode fazer isso.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const aluno = await prisma.aluno.findFirst({ where: { id, excluidoEm: null } })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }
  if (aluno.situacao !== 'PAUSA') {
    return NextResponse.json({ erro: 'Este aluno não está em pausa.' }, { status: 400 })
  }

  await prisma.aluno.update({
    where: { id },
    data: { situacao: 'ESPERA', situacaoDesde: new Date() },
  })
  await registrarAcesso(sessao.user.id, 'MOVEU_PARA_ESPERA', aluno.nome)
  return NextResponse.json({ ok: true })
}
