import { NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno } from '@/lib/registro'
import { resumoDispositivo } from '@/domain/dispositivo'
import { chaveDeAssinatura, enviarArquivo } from '@/lib/storage'
import { semAtendimentoNoDia } from '@/lib/diasSemAtendimento'
import { isoDia } from '@/domain/diaSemAtendimento'
import { podeLancarNoDia, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { hojeNoFuso } from '@/lib/fuso'

const esquema = z.object({
  situacao: z.enum(['REALIZADO', 'FALTOU', 'JUSTIFICOU'], {
    message: 'Escolha realizado, faltou ou justificou.',
  }),
  assinatura: z.string().nullable().optional(),
  responsavelAusente: z.boolean().nullable().optional(),
})

function pngDaAssinatura(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  const corpo = Buffer.from(m[1], 'base64')
  if (corpo.length === 0 || corpo.length > 500_000) return null
  return corpo
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para registrar presença.' }, { status: 401 })
  }

  const { id } = await params
  const atendimento = await prisma.atendimento.findUnique({
    where: { id },
    include: { vinculo: true },
  })
  if (!atendimento) {
    return NextResponse.json({ erro: 'Atendimento não encontrado.' }, { status: 404 })
  }
  if (
    sessao.user.perfil !== 'ADMIN' &&
    atendimento.vinculo.profissionalId !== sessao.user.id
  ) {
    return NextResponse.json({ erro: 'Este atendimento não é seu.' }, { status: 403 })
  }

  if (!podeLancarNoDia(sessao.user.perfil, isoDia(atendimento.data), hojeNoFuso())) {
    return NextResponse.json({ erro: AVISO_LIMITE_LANCAR }, { status: 403 })
  }

  const semAtendimento = await semAtendimentoNoDia(isoDia(atendimento.data))
  if (semAtendimento) {
    return NextResponse.json(
      { erro: `Dia sem atendimento (${semAtendimento}). Não dá para registrar presença nem falta neste dia.` },
      { status: 409 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie a situação do atendimento.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const { situacao, assinatura, responsavelAusente } = validado.data

  // A assinatura é sempre opcional: o registro oficial é o papel assinado à
  // mão. Se vier desenhada, salva; se não vier, só registra quem confirmou.
  let assinaturaId: string | null = atendimento.assinaturaId
  if (assinatura) {
    const png = pngDaAssinatura(assinatura)
    if (!png) {
      return NextResponse.json(
        { erro: 'A assinatura não chegou direito. Assine de novo.' },
        { status: 400 },
      )
    }
    assinaturaId = await enviarArquivo(chaveDeAssinatura(atendimento.id), png, 'image/png')
  }
  if (responsavelAusente) {
    assinaturaId = null
  }

  const userAgent = (await headers()).get('user-agent') ?? ''
  const atualizado = await prisma.atendimento.update({
    where: { id },
    data: {
      situacao,
      assinaturaId,
      assinadoEm: assinaturaId ? new Date() : atendimento.assinadoEm,
      dispositivo: resumoDispositivo(userAgent),
      confirmadoEm: new Date(),
      registradoPorId: sessao.user.id,
    },
  })
  const rotulo = { REALIZADO: 'presença', FALTOU: 'falta', JUSTIFICOU: 'falta justificada' }[situacao]
  await registrarAcesso(
    sessao.user.id,
    'REGISTROU_PRESENCA',
    `${await nomeDoAluno(atendimento.vinculo.alunoId)} (${rotulo}, ${atendimento.data.toISOString().slice(8, 10)}/${atendimento.data.toISOString().slice(5, 7)} ${atendimento.hora})`,
  )
  return NextResponse.json({
    ok: true,
    situacao: atualizado.situacao,
    assinadoEm: atualizado.assinadoEm,
    dispositivo: atualizado.dispositivo,
    confirmadoEm: atualizado.confirmadoEm,
    registradoPorId: atualizado.registradoPorId,
  })
}
