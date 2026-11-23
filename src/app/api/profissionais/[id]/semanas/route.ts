// src/app/api/profissionais/[id]/semanas/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, quando } from '@/lib/registro'
import {
  expandirSemanas, proximoTamanho, remocaoDeSemana, rotuloSemanas, semanaEmMonday, tamanhoAnterior,
} from '@/domain/semanas'

const esquema = z.object({ acao: z.enum(['adicionar', 'remover']) })

// "+ Nova semana" (1 → 2 → 4): as semanas novas nascem cópia das que existem, então nenhuma
// data muda. "Remover semana" (4 → 2 → 1): só se ninguém depender das semanas que saem.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção muda as semanas da agenda.' }, { status: 403 })
  }
  const { id } = await params
  const profissional = await prisma.usuario.findFirst({ where: { id, perfil: 'PROFISSIONAL' } })
  if (!profissional) return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 404 })
  const validado = esquema.safeParse(await req.json().catch(() => null))
  if (!validado.success) return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  const { acao } = validado.data

  const de = profissional.semanasNoCiclo
  const para = acao === 'adicionar' ? proximoTamanho(de) : tamanhoAnterior(de)
  if (!para) {
    return NextResponse.json(
      { erro: acao === 'adicionar' ? 'A agenda já tem 4 semanas, o máximo.' : 'A agenda já tem uma semana só.' },
      { status: 400 },
    )
  }

  // Todos os horários do profissional, inclusive encerrados e na lixeira: se um dia voltarem,
  // precisam estar na contagem nova.
  const horarios = await prisma.horario.findMany({
    where: { vinculo: { profissionalId: id } },
    select: {
      id: true, semanas: true, diaSemana: true, hora: true, excluidoEm: true,
      vinculo: { select: { fim: true, aluno: { select: { nome: true, excluidoEm: true } } } },
    },
  })

  let novas: Map<string, number>
  if (acao === 'adicionar') {
    novas = new Map(horarios.map((h) => [h.id, expandirSemanas(h.semanas, de, para)]))
  } else {
    const vigentes = horarios.filter((h) => !h.excluidoEm && !h.vinculo.fim && !h.vinculo.aluno.excluidoEm)
    const { bloqueados } = remocaoDeSemana(vigentes, de, para)
    if (bloqueados.length > 0) {
      return NextResponse.json(
        {
          erro: 'Antes de remover, ajuste quem depende das semanas que sairiam (deixe igual nas semanas que ficam, ou encerre):',
          bloqueados: bloqueados.map(
            (h) => `${h.vinculo.aluno.nome} · ${quando(h.diaSemana, h.hora)} · ${rotuloSemanas(h.semanas, de)}`,
          ),
        },
        { status: 409 },
      )
    }
    novas = remocaoDeSemana(horarios, de, para).novas
  }

  // Ao sair de 1 semana, a semana de hoje vira a Semana 1. Voltando a 1, não há mais início.
  const cicloInicio = para === 1 ? null : de === 1 ? semanaEmMonday(new Date()) : profissional.cicloInicio
  const porMascara = new Map<number, string[]>()
  for (const [hid, m] of novas) porMascara.set(m, [...(porMascara.get(m) ?? []), hid])
  await prisma.$transaction([
    prisma.usuario.update({ where: { id }, data: { semanasNoCiclo: para, cicloInicio } }),
    ...[...porMascara].map(([semanas, ids]) => prisma.horario.updateMany({ where: { id: { in: ids } }, data: { semanas } })),
  ])
  await registrarAcesso(
    sessao.user.id,
    acao === 'adicionar' ? 'NOVA_SEMANA' : 'REMOVEU_SEMANA',
    `${profissional.nome} (agenda agora com ${para} semana${para > 1 ? 's' : ''})`,
  )
  return NextResponse.json({ ok: true, semanasNoCiclo: para })
}
