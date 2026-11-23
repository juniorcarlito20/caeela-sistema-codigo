import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { resumoDoPeriodo } from '@/domain/presenca'
import { carregarLogos } from '@/lib/pdf/timbre'
import { gerarPresencaMensalPDF, type LinhaPresenca } from '@/lib/pdf/presencaMensal'
import { lerArquivo } from '@/lib/storage'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const esquema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  profissionalId: z.string().trim().nullish().transform((v) => (v ? v : null)),
})

const LIMITE_LINHAS = 200

export async function GET(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção gera a folha de presença.' },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const validado = esquema.safeParse({
    ano: url.searchParams.get('ano'),
    mes: url.searchParams.get('mes'),
    profissionalId: url.searchParams.get('profissionalId'),
  })
  if (!validado.success) {
    return NextResponse.json({ erro: 'Escolha um mês válido.' }, { status: 400 })
  }
  const { ano, mes, profissionalId } = validado.data

  const inicio = new Date(ano, mes - 1, 1, 12, 0, 0)
  const fim = new Date(ano, mes, 0, 12, 0, 0)

  const atendimentos = await prisma.atendimento.findMany({
    where: {
      data: { gte: inicio, lte: fim },
      situacao: { not: 'AGENDADO' },
      // Relatório do centro: pessoas de fora (consultas) não entram.
      vinculo: { aluno: { deFora: false }, ...(profissionalId ? { profissionalId } : {}) },
    },
    include: {
      vinculo: { include: { aluno: true, profissional: true } },
      registradoPor: { select: { nome: true } },
    },
    orderBy: [{ data: 'asc' }, { hora: 'asc' }],
  })

  if (atendimentos.length > LIMITE_LINHAS && !profissionalId) {
    return NextResponse.json(
      {
        erro: `Este mês tem ${atendimentos.length} registros. Escolha um profissional por vez.`,
        precisaFiltro: true,
      },
      { status: 400 },
    )
  }

  const linhas: LinhaPresenca[] = []
  for (const a of atendimentos) {
    let assinatura: string | null = null
    if (a.assinaturaId) {
      const arquivo = await lerArquivo(a.assinaturaId)
      if (arquivo) {
        assinatura = `data:${arquivo.tipo};base64,${arquivo.corpo.toString('base64')}`
      }
    }
    linhas.push({
      data: a.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      hora: a.hora,
      aluno: profissionalId
        ? a.vinculo.aluno.nome
        : `${a.vinculo.aluno.nome} · ${a.vinculo.profissional.nome}`,
      situacao: a.situacao,
      assinatura,
      registradoPor: assinatura ? null : (a.registradoPor?.nome ?? null),
    })
  }

  const nomeProf = profissionalId
    ? ((await prisma.usuario.findUnique({ where: { id: profissionalId } }))?.nome ??
      'Profissional')
    : 'Todos os profissionais'
  const pdf = await gerarPresencaMensalPDF({
    titulo: `FOLHA DE PRESENÇA — ${MESES[mes - 1]} de ${ano} · ${nomeProf}`,
    resumo: resumoDoPeriodo(atendimentos),
    linhas,
    geradoEm: new Date(),
    logos: await carregarLogos(),
  })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presenca-${ano}-${String(mes).padStart(2, '0')}.pdf"`,
    },
  })
}
