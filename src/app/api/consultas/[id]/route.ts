import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { diaIso, podeDesmarcarConsulta, textoDaConsulta } from '@/domain/consultas'

// Desmarca uma consulta avulsa que ainda não foi registrada (a direção ou o próprio profissional).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) return NextResponse.json({ erro: 'Entre no sistema para continuar.' }, { status: 401 })
  const { id: usuarioId, perfil } = sessao.user
  if (perfil !== 'ADMIN' && perfil !== 'PROFISSIONAL') {
    return NextResponse.json({ erro: 'Seu acesso não permite desmarcar consultas.' }, { status: 403 })
  }

  const { id } = await params
  const consulta = await prisma.atendimento.findFirst({
    where: { id, avulso: true },
    select: {
      id: true,
      data: true,
      hora: true,
      situacao: true,
      registroConsulta: { select: { id: true } },
      vinculo: {
        select: {
          profissionalId: true,
          profissional: { select: { nome: true } },
          aluno: { select: { nome: true } },
        },
      },
    },
  })
  if (!consulta) return NextResponse.json({ erro: 'Consulta não encontrada.' }, { status: 404 })
  if (!podeDesmarcarConsulta({ id: usuarioId, perfil }, consulta.vinculo.profissionalId)) {
    return NextResponse.json({ erro: 'Você não pode desmarcar esta consulta.' }, { status: 403 })
  }
  if (consulta.situacao !== 'AGENDADO' || consulta.registroConsulta) {
    return NextResponse.json(
      { erro: 'Só dá para desmarcar consulta que ainda não foi registrada.' },
      { status: 409 },
    )
  }

  await prisma.atendimento.update({
    where: { id },
    data: { situacao: 'CANCELADO', observacao: 'Consulta desmarcada' },
  })
  await registrarAcesso(
    usuarioId,
    'DESMARCOU_CONSULTA',
    textoDaConsulta(consulta.vinculo.aluno.nome, consulta.vinculo.profissional.nome, diaIso(consulta.data), consulta.hora),
  )
  return NextResponse.json({ ok: true })
}
