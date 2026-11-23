import { carregarDuracoes, duracaoEfetiva } from '@/lib/slots'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { conflitosNovos } from '@/domain/conflitos'
import { horariosVigentes, descreverConflitoNovo, type HorarioVigente } from '@/lib/agendaVigente'

const ROTULO_SITUACAO: Record<string, string> = {
  PAUSA: 'pausa',
  ALTA: 'alta',
  DESLIGADO: 'desligamento',
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para continuar.' }, { status: 401 })
  }

  const { id } = await params
  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: { aluno: true, profissional: true, area: true, horarios: { where: { excluidoEm: null } } },
  })
  if (!vinculo || !vinculo.fim) {
    return NextResponse.json({ erro: 'Este atendimento não está encerrado.' }, { status: 404 })
  }
  if (sessao.user.perfil !== 'ADMIN' && sessao.user.id !== vinculo.profissionalId) {
    return NextResponse.json(
      { erro: 'Você só pode desfazer atendimentos dos seus próprios alunos.' },
      { status: 403 },
    )
  }

  // Reabrir devolve os horários antigos pra agenda: não deixa se eles baterem com
  // o que a criança ou o profissional já têm hoje.
  const duracoes = await carregarDuracoes()
  const vigentes = await horariosVigentes()
  const reabertos: HorarioVigente[] = vinculo.horarios.map((h) => ({
    id: h.id,
    vinculoId: vinculo.id,
    alunoNome: vinculo.aluno.nome,
    profissionalNome: vinculo.profissional.nome,
    areaNome: vinculo.area.nome,
    profissionalId: vinculo.profissionalId,
    alunoId: vinculo.alunoId,
    diaSemana: h.diaSemana,
    hora: h.hora,
    semanas: h.semanas,
    semanasNoCiclo: vinculo.profissional.semanasNoCiclo,
    cicloInicio: vinculo.profissional.cicloInicio,
    duracaoMin: duracaoEfetiva(duracoes, vinculo.profissionalId, h.diaSemana, h.hora, h.duracaoMin),
  }))
  const novos = conflitosNovos(vigentes, [...vigentes, ...reabertos])
  if (novos.length > 0) {
    return NextResponse.json(
      { erro: `Não dá para desfazer agora: ${descreverConflitoNovo(novos[0])}. Resolva esse horário antes.` },
      { status: 409 },
    )
  }

  await prisma.vinculo.update({
    where: { id },
    data: {
      fim: null,
      motivoFim: null,
      situacaoAlunoAntes: null,
      situacaoDesdeAntes: null,
      pausaRetomarEmAntes: null,
    },
  })

  // Só devolve a situação geral do aluno se nada mudou desde então — se
  // alguém já alterou a situação por outro caminho, não sobrescreve.
  if (vinculo.situacaoAlunoAntes && vinculo.aluno.situacao === vinculo.motivoFim) {
    await prisma.aluno.update({
      where: { id: vinculo.alunoId },
      data: {
        situacao: vinculo.situacaoAlunoAntes,
        situacaoDesde: vinculo.situacaoDesdeAntes ?? new Date(),
        pausaRetomarEm: vinculo.pausaRetomarEmAntes,
      },
    })
  }

  const motivoRotulo = vinculo.motivoFim ? ROTULO_SITUACAO[vinculo.motivoFim] : 'encerramento'
  await registrarAcesso(
    sessao.user.id,
    'DESFEZ_ENCERRAMENTO',
    `${vinculo.aluno.nome} (estava em ${motivoRotulo})`,
  )

  return NextResponse.json({ ok: true })
}
