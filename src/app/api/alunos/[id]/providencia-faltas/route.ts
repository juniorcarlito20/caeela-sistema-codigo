import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { diasDeFaltaSeguidos, FALTAS_PARA_AVISO } from '@/domain/faltas'

const esquema = z.object({
  tipo: z.enum(['CONTATO_FAMILIA', 'ASSISTENCIA_SOCIAL', 'OUTRA'], { message: 'Escolha o que foi feito.' }),
  observacao: z.string().trim().max(300, 'A observação pode ter até 300 letras.').optional(),
})

const ROTULO: Record<string, string> = {
  CONTATO_FAMILIA: 'Contato com a família',
  ASSISTENCIA_SOCIAL: 'Acionou a assistência social',
  OUTRA: 'Outra',
}

// A direção registra o que fez diante das faltas seguidas de um aluno. A providência cobre até o
// dia da última falta da sequência atual: o aviso sai e só volta com novas faltas depois dele.
// No Histórico vai só o tipo; a observação nunca.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode registrar a providência.' }, { status: 403 })
  }

  const { id } = await params
  const aluno = await prisma.aluno.findFirst({ where: { id, excluidoEm: null } })
  if (!aluno) return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })

  let corpo: unknown = {}
  try {
    corpo = await req.json()
  } catch {
    corpo = {}
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { tipo } = validado.data
  const observacao = validado.data.observacao ? validado.data.observacao : null

  // Mesma janela do Painel: atendimentos dos últimos 120 dias.
  const corte = new Date()
  corte.setDate(corte.getDate() - 120)
  const [atendimentos, ultima] = await Promise.all([
    prisma.atendimento.findMany({
      where: { vinculo: { alunoId: id }, data: { gte: corte }, situacao: { not: 'AGENDADO' }, avulso: false },
      select: { situacao: true, data: true },
    }),
    prisma.providenciaFalta.findFirst({ where: { alunoId: id }, orderBy: { cobreAte: 'desc' } }),
  ])
  const { dias, ultimaFalta } = diasDeFaltaSeguidos(atendimentos, ultima?.cobreAte ?? null)
  if (dias < FALTAS_PARA_AVISO || !ultimaFalta) {
    return NextResponse.json({ erro: 'Este aluno não está com faltas seguidas para tratar.' }, { status: 400 })
  }

  await prisma.providenciaFalta.create({
    data: { alunoId: id, tipo, observacao, cobreAte: ultimaFalta, autorId: sessao.user.id },
  })
  await registrarAcesso(sessao.user.id, 'REGISTROU_PROVIDENCIA_FALTAS', `${aluno.nome} (${ROTULO[tipo]})`)
  return NextResponse.json({ ok: true })
}
