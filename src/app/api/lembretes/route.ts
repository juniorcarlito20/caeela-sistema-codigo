import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import {
  montarMensagem,
  montarAvisoSemAtendimento,
  linkWhatsApp,
  normalizarTelefone,
  gerarToken,
  primeiroNome,
} from '@/domain/lembrete'
import { diaDaSemana, isoDia, proximoAtendimento } from '@/domain/diaSemAtendimento'
import { diasSemAtendimentoEntre, semAtendimentoNoDia } from '@/lib/diasSemAtendimento'
import { hojeNoFuso } from '@/lib/fuso'

const esquema = z.object({
  atendimentoId: z.string().min(1, 'Atendimento inválido.'),
})

function baseUrl(req: Request): string {
  // Em produção usa sempre o domínio público da Railway — depender dos
  // cabeçalhos da requisição já mandou link com "localhost" pra família.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para enviar lembretes.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Informe o atendimento.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: 'Informe o atendimento.' }, { status: 400 })
  }

  const atendimento = await prisma.atendimento.findUnique({
    where: { id: validado.data.atendimentoId },
    include: {
      vinculo: { include: { aluno: true, profissional: true, area: true } },
      lembrete: true,
    },
  })
  if (!atendimento) {
    return NextResponse.json({ erro: 'Atendimento não encontrado.' }, { status: 404 })
  }
  if (
    sessao.user.perfil !== 'ADMIN' &&
    sessao.user.perfil !== 'SECRETARIA' &&
    atendimento.vinculo.profissionalId !== sessao.user.id
  ) {
    return NextResponse.json({ erro: 'Este atendimento não é seu.' }, { status: 403 })
  }

  const telefone = atendimento.vinculo.aluno.whatsapp
    ? normalizarTelefone(atendimento.vinculo.aluno.whatsapp)
    : null
  if (!telefone) {
    return NextResponse.json(
      { erro: 'Cadastre o WhatsApp do responsável na ficha do aluno.' },
      { status: 400 },
    )
  }

  const lembrete =
    atendimento.lembrete ??
    (await prisma.lembrete.create({
      data: { atendimentoId: atendimento.id, token: gerarToken() },
    }))
  await prisma.lembrete.update({
    where: { id: lembrete.id },
    data: { enviadoEm: new Date() },
  })

  const responsavel = primeiroNome(atendimento.vinculo.aluno.responsavel) || null
  const aluno = primeiroNome(atendimento.vinculo.aluno.nome)
  const profissional = primeiroNome(atendimento.vinculo.profissional.nome)
  const motivo = await semAtendimentoNoDia(isoDia(atendimento.data))

  let mensagem: string
  if (motivo) {
    // Dia sem atendimento: aviso (sem link), com a próxima data deste mesmo horário.
    const horario = await prisma.horario.findFirst({
      where: {
        vinculoId: atendimento.vinculoId,
        diaSemana: diaDaSemana(atendimento.data),
        hora: atendimento.hora,
        excluidoEm: null,
      },
      select: { semanas: true },
    })
    const limite = new Date(atendimento.data)
    limite.setDate(limite.getDate() + 12 * 7)
    const outros = await diasSemAtendimentoEntre(atendimento.data, limite)
    const prof = atendimento.vinculo.profissional
    const data = horario
      ? proximoAtendimento(
          { semanas: horario.semanas, semanasNoCiclo: prof.semanasNoCiclo, cicloInicio: prof.cicloInicio },
          atendimento.data,
          new Set(outros.keys()),
        )
      : null
    mensagem = montarAvisoSemAtendimento({
      responsavel, aluno, data: atendimento.data, motivo, profissional,
      proximo: data ? { data, hora: atendimento.hora } : null,
    })
  } else {
    mensagem = montarMensagem({
      responsavel, aluno, data: atendimento.data, hora: atendimento.hora, profissional,
      area: atendimento.vinculo.area.nome,
      url: `${baseUrl(req)}/confirmar/${lembrete.token}`,
      hojeISO: hojeNoFuso(),
    })
  }
  await registrarAcesso(
    sessao.user.id,
    motivo ? 'PREPAROU_AVISO_SEM_ATENDIMENTO' : 'PREPAROU_LEMBRETE',
    `${atendimento.vinculo.aluno.nome} (${atendimento.data.toISOString().slice(8, 10)}/${atendimento.data.toISOString().slice(5, 7)} ${atendimento.hora})`,
  )
  return NextResponse.json({ link: linkWhatsApp(telefone, mensagem) })
}
