import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { podeVerAluno } from '@/domain/permissoes'

const esquema = z.object({
  pausaRetomarEm: z.string().trim().min(1).nullable(),
})

// Previsão de retorno da pausa: o profissional vinculado sugere a data, mas
// a direção sempre pode entrar e mudar por cima — ninguém trava o campo.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para editar.' }, { status: 401 })
  }

  const { id } = await params
  const aluno = await prisma.aluno.findFirst({ where: { id, excluidoEm: null } })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }

  if (sessao.user.perfil !== 'ADMIN') {
    const vinculos = await prisma.vinculo.findMany({
      where: { alunoId: id },
      select: { profissionalId: true, fim: true },
    })
    if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
      return NextResponse.json(
        { erro: 'Você não tem vínculo com este aluno.' },
        { status: 403 },
      )
    }
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie a data.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: 'Confira a data.' }, { status: 400 })
  }

  const pausaRetomarEm = validado.data.pausaRetomarEm
    ? new Date(`${validado.data.pausaRetomarEm}T12:00:00`)
    : null
  await prisma.aluno.update({ where: { id }, data: { pausaRetomarEm } })
  await registrarAcesso(sessao.user.id, 'AJUSTOU_RETORNO_PAUSA', aluno.nome)
  return NextResponse.json({ ok: true })
}
