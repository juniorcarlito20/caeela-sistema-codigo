import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { rotuloTipo, validarObservacao } from '@/domain/sugestoes'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({
  acao: z.enum(['resolver', 'descartar'], { message: 'Escolha resolver ou descartar.' }),
  observacao: z.string().nullable().optional(),
})

// A direção fecha uma sugestão pendente: resolvida (providência tomada) ou descartada.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para fechar a sugestão.' }, { status: 401 })
  }
  if (sessao.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção resolve ou descarta sugestões.' }, { status: 403 })
  }
  const { id } = await params

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { acao, observacao } = validado.data
  const recusa = validarObservacao(observacao)
  if (recusa) return NextResponse.json({ erro: recusa }, { status: 400 })

  const sugestao = await prisma.sugestao.findUnique({
    where: { id },
    include: { aluno: { select: { nome: true } }, area: { select: { nome: true } } },
  })
  if (!sugestao) return NextResponse.json({ erro: 'Sugestão não encontrada.' }, { status: 404 })

  const resolvida = acao === 'resolver'
  // Só fecha se ainda estiver pendente (duas pessoas da direção ao mesmo tempo: só a primeira vale).
  const fechou = await prisma.sugestao.updateMany({
    where: { id, situacao: 'PENDENTE' },
    data: {
      situacao: resolvida ? 'RESOLVIDA' : 'DESCARTADA',
      observacaoDirecao: (observacao ?? '').trim() || null,
      fechadaPorId: sessao.user.id,
      fechadaEm: new Date(),
    },
  })
  if (fechou.count === 0) {
    return NextResponse.json({ erro: 'Esta sugestão já foi encerrada.' }, { status: 409 })
  }
  await registrarAcesso(
    sessao.user.id,
    resolvida ? 'RESOLVEU_SUGESTAO' : 'DESCARTOU_SUGESTAO',
    `${sugestao.aluno.nome}: ${rotuloTipo(sugestao.tipo, sugestao.area?.nome)}`,
  )
  return NextResponse.json({ ok: true })
}
