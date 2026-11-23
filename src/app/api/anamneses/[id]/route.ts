import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno } from '@/lib/registro'
import { validarRespostas, type Campo } from '@/domain/anamnese'

const esquema = z.object({
  respostas: z.record(z.string(), z.string()),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para salvar a anamnese.' }, { status: 401 })
  }

  const { id } = await params
  const anamnese = await prisma.anamnese.findUnique({
    where: { id },
    include: { modelo: { select: { campos: true, ativo: true } } },
  })
  if (!anamnese) {
    return NextResponse.json({ erro: 'Anamnese não encontrada.' }, { status: 404 })
  }
  if (anamnese.autorId !== sessao.user.id) {
    return NextResponse.json(
      { erro: 'Só quem escreveu pode editar esta anamnese.' },
      { status: 403 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie as respostas.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }

  const erros = validarRespostas(
    anamnese.modelo.campos as unknown as Campo[],
    validado.data.respostas,
  )
  if (erros.length > 0) {
    return NextResponse.json({ erro: erros[0] }, { status: 400 })
  }

  await prisma.anamnese.update({
    where: { id },
    data: { respostas: validado.data.respostas },
  })
  await registrarAcesso(sessao.user.id, 'EDITOU_ANAMNESE', await nomeDoAluno(anamnese.alunoId))
  return NextResponse.json({ ok: true })
}
