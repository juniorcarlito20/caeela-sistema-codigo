import { carregarDuracoes, duracaoEfetiva } from '@/lib/slots'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoAluno, nomeDoAlunoDaEvolucao } from '@/lib/registro'
import { conflitosNovos } from '@/domain/conflitos'
import { horariosVigentes, descreverConflitoNovo, type HorarioVigente } from '@/lib/agendaVigente'

const esquema = z.object({
  tipo: z.enum(['aluno', 'documento', 'evolucao', 'horario', 'relatorio', 'profissional']),
  id: z.string().min(1),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção restaura itens.' },
      { status: 403 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie o item.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: 'Item inválido.' }, { status: 400 })
  }

  const { tipo, id } = validado.data

  // Restaurar aluno ou horário devolve horários pra agenda: recusa se baterem com os de hoje.
  if (tipo === 'aluno' || tipo === 'horario') {
    const volta = await prisma.horario.findMany({
      where:
        tipo === 'horario'
          ? { id, vinculo: { fim: null } }
          : { excluidoEm: null, vinculo: { alunoId: id, fim: null } },
      include: {
        vinculo: { include: { aluno: true, profissional: true, area: true } },
      },
    })
    const duracoes = await carregarDuracoes()
    const vigentes = await horariosVigentes()
    const idsVigentes = new Set(vigentes.map((h) => h.id))
    const voltando: HorarioVigente[] = volta
      .filter((h) => !idsVigentes.has(h.id))
      .map((h) => ({
        id: h.id,
        vinculoId: h.vinculoId,
        alunoNome: h.vinculo.aluno.nome,
        profissionalNome: h.vinculo.profissional.nome,
        areaNome: h.vinculo.area.nome,
        profissionalId: h.vinculo.profissionalId,
        alunoId: h.vinculo.alunoId,
        diaSemana: h.diaSemana,
        hora: h.hora,
        semanas: h.semanas,
        semanasNoCiclo: h.vinculo.profissional.semanasNoCiclo,
        cicloInicio: h.vinculo.profissional.cicloInicio,
        duracaoMin: duracaoEfetiva(duracoes, h.vinculo.profissionalId, h.diaSemana, h.hora, h.duracaoMin),
      }))
    const novos = conflitosNovos(vigentes, [...vigentes, ...voltando])
    if (novos.length > 0) {
      return NextResponse.json(
        { erro: `Não dá para restaurar agora: ${descreverConflitoNovo(novos[0])}. Resolva esse horário antes.` },
        { status: 409 },
      )
    }
  }

  if (tipo === 'aluno') {
    await prisma.aluno.update({ where: { id }, data: { excluidoEm: null, excluidoPor: null } })
  } else if (tipo === 'documento') {
    await prisma.documento.update({ where: { id }, data: { excluidoEm: null, excluidoPor: null } })
  } else if (tipo === 'evolucao') {
    await prisma.evolucao.update({ where: { id }, data: { excluidoEm: null, excluidoPor: null } })
  } else if (tipo === 'profissional') {
    // Volta para a lista, mas inativa: a direção reativa pelo botão de Profissionais, se quiser.
    await prisma.usuario.update({ where: { id }, data: { ativo: false, excluidoEm: null, excluidoPor: null } })
  } else if (tipo === 'relatorio') {
    const r = await prisma.relatorio.update({ where: { id }, data: { excluidoEm: null, excluidoPor: null } })
    // O relatório sem anamnese volta também para a pasta Documentos (mesmo arquivo).
    if (r.pdfChave) {
      await prisma.documento.updateMany({
        where: { alunoId: r.alunoId, chave: r.pdfChave, excluidoEm: { not: null } },
        data: { excluidoEm: null, excluidoPor: null },
      })
    }
  } else {
    await prisma.horario.update({ where: { id }, data: { excluidoEm: null, excluidoPor: null } })
  }
  let quem = ''
  if (tipo === 'aluno') quem = await nomeDoAluno(id)
  else if (tipo === 'evolucao') quem = await nomeDoAlunoDaEvolucao(id)
  else if (tipo === 'profissional') {
    const u = await prisma.usuario.findUnique({ where: { id }, select: { nome: true } })
    quem = u?.nome ?? ''
  }
  else if (tipo === 'relatorio') {
    const r = await prisma.relatorio.findUnique({ where: { id }, select: { alunoId: true } })
    quem = r ? await nomeDoAluno(r.alunoId) : ''
  }
  else if (tipo === 'documento') {
    const d = await prisma.documento.findUnique({ where: { id }, select: { alunoId: true } })
    quem = d ? await nomeDoAluno(d.alunoId) : ''
  } else {
    const h = await prisma.horario.findUnique({ where: { id }, select: { vinculo: { select: { alunoId: true } } } })
    quem = h ? await nomeDoAluno(h.vinculo.alunoId) : ''
  }
  await registrarAcesso(sessao.user.id, 'RESTAUROU_DA_LIXEIRA', `${tipo}${quem ? `: ${quem}` : ''}`)
  return NextResponse.json({ ok: true })
}
