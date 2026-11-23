import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { inicioParaSemanaAtual } from '@/domain/semanas'
import { conflitosNovos } from '@/domain/conflitos'
import { horariosVigentes } from '@/lib/agendaVigente'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({ semana: z.number().int().min(1).max(4) })

// "Esta é a semana atual": a direção reconhece a lista de alunos e diz em qual Semana do
// ciclo do profissional estamos hoje. Só muda o início do ciclo; as semanas de cada aluno
// ficam como estão (as listas é que giram).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode acertar a semana atual.' }, { status: 403 })
  }
  const { id } = await params
  const profissional = await prisma.usuario.findFirst({ where: { id, perfil: 'PROFISSIONAL' } })
  if (!profissional) return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 404 })
  if (profissional.semanasNoCiclo <= 1) {
    return NextResponse.json({ erro: 'A agenda deste profissional tem uma semana só.' }, { status: 400 })
  }
  const validado = esquema.safeParse(await req.json().catch(() => null))
  if (!validado.success || validado.data.semana > profissional.semanasNoCiclo) {
    return NextResponse.json({ erro: `Escolha uma semana de 1 a ${profissional.semanasNoCiclo}.` }, { status: 400 })
  }

  const cicloInicio = inicioParaSemanaAtual(validado.data.semana, new Date())
  // A semana real é a que manda, então não recusa — mas avisa se isso faz horários de outros
  // profissionais (ex.: a mesma criança) passarem a bater.
  const antes = await horariosVigentes()
  const depois = antes.map((h) => (h.profissionalId === id ? { ...h, cicloInicio } : h))
  const conflitosCriados = conflitosNovos(antes, depois).length

  await prisma.usuario.update({ where: { id }, data: { cicloInicio } })
  await registrarAcesso(sessao.user.id, 'AJUSTOU_SEMANA', `${profissional.nome} (esta semana = Semana ${validado.data.semana})`)
  return NextResponse.json({ ok: true, conflitosCriados })
}
