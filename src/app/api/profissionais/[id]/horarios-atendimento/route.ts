import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { horariosVigentes, descreverConflitoNovo } from '@/lib/agendaVigente'
import { registrarAcesso } from '@/lib/registro'
import { slotsDoProfissional } from '@/lib/slots'
import { conflitosNovos } from '@/domain/conflitos'
import { validarSlots, type Slot } from '@/domain/grade'

const esquema = z.object({
  slots: z
    .array(
      z.object({
        diaSemana: z.number().int(),
        hora: z.string(),
        duracaoMin: z.number().int(),
        // Quantas crianças cabem no horário (1 = individual; 2 ou mais = grupo). Sem informar: 1.
        vagas: z.number().int().optional(),
        // Hora que esse horário tinha antes de ser editado (para o aluno acompanhar a mudança).
        horaAntiga: z.string().optional(),
      }),
    )
    .max(200),
})

const DIAS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta']

// Salva todos os horários de atendimento de um profissional de uma vez.
// - Horário com aluno não pode ser removido (a direção move o aluno antes).
// - Mudar a hora ou a duração de um horário leva junto os alunos que estão nele.
// - Recusa a mudança se ela fizer uma criança ficar em dois lugares ao mesmo tempo, ou se baixar
//   as vagas de um horário abaixo de quantas crianças já estão nele numa mesma semana.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode editar os horários de atendimento.' }, { status: 403 })
  }
  const { id } = await params
  const profissional = await prisma.usuario.findFirst({ where: { id, perfil: 'PROFISSIONAL' }, select: { id: true, nome: true } })
  if (!profissional) return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 404 })

  const corpo = await req.json().catch(() => null)
  const validado = esquema.safeParse(corpo)
  if (!validado.success) return NextResponse.json({ erro: 'Confira os horários e tente de novo.' }, { status: 400 })
  const pedidos = validado.data.slots
  if (pedidos.length === 0) {
    return NextResponse.json(
      { erro: 'O profissional precisa ter pelo menos um horário. Para tirá-lo da agenda, desative o acesso dele.' },
      { status: 400 },
    )
  }

  const novos: Slot[] = pedidos.map((p) => ({ diaSemana: p.diaSemana, hora: p.hora, duracaoMin: p.duracaoMin, vagas: p.vagas ?? 1 }))
  const problemas = validarSlots(novos)
  if (problemas.length > 0) {
    return NextResponse.json({ erro: problemas[0].mensagem, problemas }, { status: 400 })
  }

  const vigentes = await horariosVigentes()
  const doProfissional = vigentes.filter((h) => h.profissionalId === id)
  const slotsAtuais = await slotsDoProfissional(id)
  const chave = (dia: number, hora: string) => `${dia}-${hora}`

  // Cada horário pedido sabe de onde veio; o que já existia e não veio de ninguém foi removido.
  const origens = new Set(pedidos.map((p) => chave(p.diaSemana, p.horaAntiga ?? p.hora)))
  const removidos = slotsAtuais.filter((s) => !origens.has(chave(s.diaSemana, s.hora)))
  const comAluno = removidos.filter((s) => doProfissional.some((h) => h.diaSemana === s.diaSemana && h.hora === s.hora))
  if (comAluno.length > 0) {
    const lista = comAluno.map((s) => `${DIAS[s.diaSemana]} ${s.hora}`).join(', ')
    return NextResponse.json(
      { erro: `Há aluno em: ${lista}. Mova os alunos para outro horário antes de remover.` },
      { status: 409 },
    )
  }

  // O que muda para os horários (atendimentos) que já estão marcados.
  type Mudanca = { ids: string[]; diaSemana: number; de: string; para: string; duracaoMin: number }
  const mudancas: Mudanca[] = []
  for (const p of pedidos) {
    const de = p.horaAntiga ?? p.hora
    const ids = doProfissional.filter((h) => h.diaSemana === p.diaSemana && h.hora === de).map((h) => h.id)
    if (ids.length === 0) continue
    const duracaoAtual = doProfissional.find((h) => ids.includes(h.id))?.duracaoMin
    if (de !== p.hora || duracaoAtual !== p.duracaoMin) {
      mudancas.push({ ids, diaSemana: p.diaSemana, de, para: p.hora, duracaoMin: p.duracaoMin })
    }
  }

  // Horários cujas vagas mudaram: se baixarem demais, a checagem de choque acusa.
  const vagasAtuais = new Map(slotsAtuais.map((s) => [chave(s.diaSemana, s.hora), s.vagas ?? 1]))
  const mudouVagas = pedidos.filter(
    (p) => (vagasAtuais.get(chave(p.diaSemana, p.horaAntiga ?? p.hora)) ?? 1) !== (p.vagas ?? 1),
  )

  if (mudancas.length > 0 || mudouVagas.length > 0) {
    const porId = new Map(mudancas.flatMap((m) => m.ids.map((i) => [i, m] as const)))
    const vagasPorId = new Map<string, number>()
    for (const p of pedidos) {
      const de = p.horaAntiga ?? p.hora
      for (const h of doProfissional) {
        if (h.diaSemana === p.diaSemana && h.hora === de) vagasPorId.set(h.id, p.vagas ?? 1)
      }
    }
    const depois = vigentes.map((h) => {
      const m = porId.get(h.id)
      const vagas = vagasPorId.get(h.id)
      if (!m && vagas === undefined) return h
      return {
        ...h,
        ...(m ? { hora: m.para, duracaoMin: m.duracaoMin } : {}),
        ...(vagas !== undefined ? { vagas } : {}),
      }
    })
    const batidas = conflitosNovos(vigentes, depois)
    if (batidas.length > 0) {
      return NextResponse.json({ erro: `Não dá para salvar: ${descreverConflitoNovo(batidas[0])}.` }, { status: 409 })
    }
  }

  const vinculoPorHorario = new Map(
    (await prisma.horario.findMany({ where: { id: { in: [...new Set(mudancas.flatMap((m) => m.ids))] } }, select: { id: true, vinculoId: true } }))
      .map((h) => [h.id, h.vinculoId]),
  )
  const agora = new Date()
  const atendimentosParaMover: { id: string; hora: string }[] = []
  for (const m of mudancas.filter((x) => x.de !== x.para)) {
    const vinculoIds = [...new Set(m.ids.map((i) => vinculoPorHorario.get(i)).filter((v): v is string => !!v))]
    const futuros = await prisma.atendimento.findMany({
      where: { vinculoId: { in: vinculoIds }, hora: m.de, data: { gte: agora }, situacao: 'AGENDADO' },
      select: { id: true, data: true },
    })
    for (const a of futuros) {
      if (((a.data.getDay() + 6) % 7) + 1 === m.diaSemana) atendimentosParaMover.push({ id: a.id, hora: m.para })
    }
  }

  await prisma.$transaction([
    prisma.slotProfissional.deleteMany({ where: { profissionalId: id } }),
    prisma.slotProfissional.createMany({
      data: novos.map((s) => ({
        profissionalId: id, diaSemana: s.diaSemana, hora: s.hora, duracaoMin: s.duracaoMin, vagas: s.vagas ?? 1,
      })),
    }),
    ...mudancas.map((m) =>
      prisma.horario.updateMany({ where: { id: { in: m.ids } }, data: { hora: m.para, duracaoMin: m.duracaoMin } }),
    ),
    ...atendimentosParaMover.map((a) => prisma.atendimento.update({ where: { id: a.id }, data: { hora: a.hora } })),
  ])

  const antes = new Map(slotsAtuais.map((s) => [chave(s.diaSemana, s.hora), s.duracaoMin]))
  const adicionados = novos.filter((s) => !antes.has(chave(s.diaSemana, s.hora)) && !pedidos.some((p) => p.diaSemana === s.diaSemana && p.hora === s.hora && p.horaAntiga && p.horaAntiga !== p.hora)).length
  await registrarAcesso(
    sessao.user.id,
    'EDITOU_HORARIOS_ATENDIMENTO',
    `${profissional.nome}: ${novos.length} horários na semana (${adicionados} novos, ${removidos.length} removidos, ${mudancas.length} com alunos ajustados${mudouVagas.length > 0 ? `, ${mudouVagas.length} com vagas alteradas` : ''})`,
  )
  return NextResponse.json({ ok: true, total: novos.length })
}
