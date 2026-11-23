import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoUsuario } from '@/lib/registro'

const TIPOS = ['FALTA', 'ATESTADO', 'LICENCA', 'FERIAS', 'CAPACITACAO', 'OUTRO'] as const

const esquema = z.object({
  tipo: z.enum(TIPOS).nullable().optional(),
  justificativa: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim()
      return t === '' ? null : t
    }),
})

async function carregar(id: string) {
  return prisma.ausencia.findFirst({ where: { id, excluidoEm: null } })
}

function podeAlterar(perfil: string, usuarioId: string, profissionalId: string): boolean {
  return perfil === 'ADMIN' || profissionalId === usuarioId
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para continuar.' }, { status: 401 })
  }

  const { id } = await params
  const ausencia = await carregar(id)
  if (!ausencia) {
    return NextResponse.json({ erro: 'Ausência não encontrada.' }, { status: 404 })
  }
  if (!podeAlterar(sessao.user.perfil, sessao.user.id, ausencia.profissionalId)) {
    return NextResponse.json(
      { erro: 'Só a direção altera ausência de outra pessoa.' },
      { status: 403 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: 'Confira os dados e tente de novo.' }, { status: 400 })
  }

  const dados: { tipo?: (typeof TIPOS)[number]; justificativa?: string | null } = {}
  if (validado.data.tipo) dados.tipo = validado.data.tipo
  if (validado.data.justificativa !== undefined) dados.justificativa = validado.data.justificativa
  await prisma.ausencia.update({ where: { id }, data: dados })
  await registrarAcesso(sessao.user.id, 'EDITOU_AUSENCIA', await nomeDoUsuario(ausencia.profissionalId))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para continuar.' }, { status: 401 })
  }

  const { id } = await params
  const ausencia = await carregar(id)
  if (!ausencia) {
    return NextResponse.json({ erro: 'Ausência não encontrada.' }, { status: 404 })
  }
  if (!podeAlterar(sessao.user.perfil, sessao.user.id, ausencia.profissionalId)) {
    return NextResponse.json(
      { erro: 'Só a direção apaga ausência de outra pessoa.' },
      { status: 403 },
    )
  }

  // Os cancelados desta ausência voltam a agendados (só os que continuam cancelados).
  await prisma.atendimento.updateMany({
    where: { ausenciaId: id, situacao: 'CANCELADO' },
    data: { situacao: 'AGENDADO', observacao: null, ausenciaId: null },
  })
  await prisma.ausencia.update({
    where: { id },
    data: { excluidoEm: new Date() },
  })
  await registrarAcesso(sessao.user.id, 'APAGOU_AUSENCIA', await nomeDoUsuario(ausencia.profissionalId))
  return NextResponse.json({ ok: true })
}
