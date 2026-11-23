import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/db/prisma'
import { respostaDaFamilia } from '@/domain/lembrete'

const HORAS_48 = 48 * 3600 * 1000

const esquema = z.object({
  resposta: z.enum(['sim', 'nao'], { message: 'Resposta inválida.' }),
})

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const lembrete = await prisma.lembrete.findUnique({
    where: { token },
    include: { atendimento: true },
  })
  if (!lembrete) {
    return NextResponse.json({ erro: 'Link não encontrado.' }, { status: 404 })
  }
  if (lembrete.criadoEm.getTime() + HORAS_48 < Date.now()) {
    return NextResponse.json(
      { erro: 'Este link expirou. Fale com o CAEELA.' },
      { status: 410 },
    )
  }
  if (lembrete.confirmadoEm) {
    return NextResponse.json(
      { erro: 'Esta confirmação já foi respondida.' },
      { status: 400 },
    )
  }

  const texto = await req.text().catch(() => '')
  let resposta: unknown = null
  try {
    const json = JSON.parse(texto) as { resposta?: unknown }
    resposta = json?.resposta ?? null
  } catch {
    resposta = new URLSearchParams(texto).get('resposta')
  }
  const validado = esquema.safeParse({ resposta })
  if (!validado.success) {
    return NextResponse.json({ erro: 'Escolha uma das duas opções.' }, { status: 400 })
  }

  // A resposta da família é só um aviso: grava o que ela disse e nunca
  // toca na situação do atendimento. Quem decide é sempre a equipe, na tela.
  await prisma.lembrete.update({
    where: { id: lembrete.id },
    data: {
      confirmadoEm: new Date(),
      resposta: respostaDaFamilia(validado.data.resposta),
    },
  })
  const url = new URL(`/confirmar/${token}`, req.url)
  return NextResponse.redirect(url, { status: 303 })
}
