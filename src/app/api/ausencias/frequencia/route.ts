import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { diasDaAusencia, resumoFrequencia } from '@/domain/ausencia'
import { diasPrevistos, isoDia } from '@/domain/diaSemAtendimento'
import { diasSemAtendimentoEntre } from '@/lib/diasSemAtendimento'
import { carregarLogos } from '@/lib/pdf/timbre'
import { gerarFrequenciaPDF } from '@/lib/pdf/frequenciaProfissional'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const ROTULOS: Record<string, string> = {
  FALTA: 'Falta',
  ATESTADO: 'Atestado',
  LICENCA: 'Licença',
  FERIAS: 'Férias',
  CAPACITACAO: 'Capacitação',
  OUTRO: 'Outro',
}

const esquema = z.object({
  profissionalId: z.string().min(1),
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Escolha um mês válido.'),
})

export async function GET(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para baixar.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const validado = esquema.safeParse({
    profissionalId: url.searchParams.get('profissionalId'),
    mes: url.searchParams.get('mes'),
  })
  if (!validado.success) {
    return NextResponse.json({ erro: 'Escolha o profissional e o mês.' }, { status: 400 })
  }
  const { profissionalId, mes } = validado.data

  if (sessao.user.perfil !== 'ADMIN' && profissionalId !== sessao.user.id) {
    return NextResponse.json({ erro: 'Esta frequência não é sua.' }, { status: 403 })
  }

  const profissional = await prisma.usuario.findUnique({
    where: { id: profissionalId },
    include: { area: true },
  })
  if (!profissional || profissional.perfil !== 'PROFISSIONAL') {
    return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 404 })
  }

  const [ano, mm] = mes.split('-').map(Number)
  const inicioMes = new Date(ano, mm - 1, 1)
  const fimMes = new Date(ano, mm, 0, 23, 59, 59)

  // Dia sem atendimento do centro não é dia previsto nem conta como ausência.
  const semAtendimento = new Set((await diasSemAtendimentoEntre(inicioMes, fimMes)).keys())

  const ausencias = await prisma.ausencia.findMany({
    where: { profissionalId, excluidoEm: null, inicio: { lte: fimMes }, fim: { gte: inicioMes } },
    orderBy: { inicio: 'asc' },
  })

  const diasPorTipo = new Map<string, number>()
  const datas: { dia: string; tipo: string }[] = []
  for (const a of ausencias) {
    const dias = diasDaAusencia(
      a.inicio < inicioMes ? inicioMes : a.inicio,
      a.fim > fimMes ? fimMes : a.fim,
    ).filter((d) => !semAtendimento.has(isoDia(d)))
    diasPorTipo.set(a.tipo, (diasPorTipo.get(a.tipo) ?? 0) + dias.length)
    for (const d of dias) {
      datas.push({ dia: d.toLocaleDateString('pt-BR'), tipo: ROTULOS[a.tipo] ?? a.tipo })
    }
  }

  const horarios = await prisma.horario.findMany({
    where: { vinculo: { profissionalId, fim: null }, excluidoEm: null },
    select: { diaSemana: true },
  })
  const diasComHorario = new Set(horarios.map((h) => h.diaSemana))
  const previstos = diasPrevistos(inicioMes, fimMes, diasComHorario, semAtendimento)

  const resumo = resumoFrequencia(
    [...diasPorTipo.entries()].map(([tipo, dias]) => ({ tipo, dias })),
    previstos,
  )
  const pdf = await gerarFrequenciaPDF({
    profissional: profissional.nome,
    area: profissional.area?.nome ?? '—',
    mes: `${MESES[mm - 1]} de ${ano}`,
    previstos: resumo.previstos,
    ausentes: resumo.ausentes,
    justificados: resumo.justificados,
    naoJustificados: resumo.naoJustificados,
    percentual: resumo.percentual,
    porTipo: [...diasPorTipo.entries()].map(([tipo, dias]) => ({
      tipo: ROTULOS[tipo] ?? tipo,
      dias,
    })),
    datas,
    geradoEm: new Date(),
    logos: await carregarLogos(),
  })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="frequencia-${mes}.pdf"`,
    },
  })
}
