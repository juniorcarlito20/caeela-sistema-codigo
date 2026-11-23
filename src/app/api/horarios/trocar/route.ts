import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, quando } from '@/lib/registro'
import { camposDoHorario } from '@/domain/desfazer'
import { deslocarSemanas } from '@/domain/semanas'
import { carregarDuracoes, duracaoEfetiva } from '@/lib/slots'
import { conflitoDaMudanca, horariosVigentes, type HorarioVigente } from '@/lib/agendaVigente'

const esquema = z.object({
  idsOrigem: z.array(z.string().min(1)).min(1),
  idsDestino: z.array(z.string().min(1)).min(1),
  // Quantas semanas a criança "andou" ao trocar de aba (destino − origem). 0 = troca só o horário.
  deslocamento: z.number().int().min(-3).max(3).default(0),
})

// Troca dois atendimentos de lugar. Sem deslocamento, só o dia/horário (cada um com as suas
// semanas). Com deslocamento, as semanas também andam: a origem gira +d e o destino −d, então
// a frequência de ninguém muda. Rota própria porque mover um de cada vez trava.
export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode editar horários.' }, { status: 403 })
  }
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.issues[0]?.message ?? 'Confira os dados.' }, { status: 400 })
  }
  const { idsOrigem, idsDestino, deslocamento } = validado.data
  const todosIds = [...idsOrigem, ...idsDestino]
  if (new Set(todosIds).size !== todosIds.length) {
    return NextResponse.json({ erro: 'Horário repetido na troca.' }, { status: 400 })
  }

  const vigentes = await horariosVigentes()
  const porId = new Map(vigentes.map((h) => [h.id, h]))
  const o = idsOrigem.map((i) => porId.get(i)).filter((h): h is HorarioVigente => !!h)
  const d = idsDestino.map((i) => porId.get(i)).filter((h): h is HorarioVigente => !!h)
  if (o.length !== idsOrigem.length || d.length !== idsDestino.length) {
    return NextResponse.json({ erro: 'Algum horário não foi encontrado.' }, { status: 404 })
  }
  const mesmoSlot = (lista: HorarioVigente[]) =>
    lista.every((h) => h.diaSemana === lista[0].diaSemana && h.hora === lista[0].hora)
  if (!mesmoSlot(o) || !mesmoSlot(d)) {
    return NextResponse.json({ erro: 'Os horários selecionados não formam um único lugar na grade.' }, { status: 400 })
  }
  const [diaOrigem, horaOrigem] = [o[0].diaSemana, o[0].hora]
  const [diaDestino, horaDestino] = [d[0].diaSemana, d[0].hora]
  if (deslocamento === 0 && diaOrigem === diaDestino && horaOrigem === horaDestino) {
    return NextResponse.json({ erro: 'Os dois horários já são o mesmo.' }, { status: 400 })
  }
  if (deslocamento !== 0 && [...o, ...d].some((h) => h.profissionalId !== o[0].profissionalId)) {
    return NextResponse.json(
      { erro: 'Só dá para trocar de semana dentro da agenda do mesmo profissional.' },
      { status: 400 },
    )
  }

  const duracoes = await carregarDuracoes()
  const para = (h: HorarioVigente, diaSemana: number, hora: string, desloc: number): HorarioVigente => ({
    ...h,
    diaSemana,
    hora,
    semanas: deslocarSemanas(h.semanas, desloc, h.semanasNoCiclo),
    duracaoMin: duracaoEfetiva(duracoes, h.profissionalId, diaSemana, hora, h.duracaoMin),
  })
  const depois = vigentes.map((h) =>
    idsOrigem.includes(h.id) ? para(h, diaDestino, horaDestino, deslocamento)
      : idsDestino.includes(h.id) ? para(h, diaOrigem, horaOrigem, -deslocamento)
        : h,
  )
  const conflito = conflitoDaMudanca(vigentes, depois)
  if (conflito) return NextResponse.json({ erro: `Não dá para trocar: ${conflito}.` }, { status: 409 })

  const novos = new Map(depois.filter((h) => todosIds.includes(h.id)).map((h) => [h.id, h]))
  await prisma.$transaction(
    todosIds.map((id) => {
      const n = novos.get(id)!
      return prisma.horario.update({ where: { id }, data: { diaSemana: n.diaSemana, hora: n.hora, semanas: n.semanas } })
    }),
  )
  const onde = `${quando(diaOrigem, horaOrigem)} e ${quando(diaDestino, horaDestino)}`
  await registrarAcesso(
    sessao.user.id,
    'TROCOU_HORARIOS',
    deslocamento === 0
      ? `na agenda de ${o[0].profissionalNome}: ${onde} trocaram de lugar`
      : `na agenda de ${o[0].profissionalNome}: ${onde} trocaram de lugar e de semana`,
    {
      horarios: [...o, ...d].map((h) => ({ id: h.id, antes: camposDoHorario(h), depois: camposDoHorario(novos.get(h.id)!) })),
    },
  )
  return NextResponse.json({ ok: true })
}
