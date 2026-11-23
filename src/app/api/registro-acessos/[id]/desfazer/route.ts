import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { conflitosNovos } from '@/domain/conflitos'
import { camposDoHorario, comCampos, conferirDesfazer, lerMudanca } from '@/domain/desfazer'
import { horariosVigentes, descreverConflitoNovo } from '@/lib/agendaVigente'
import { carregarDuracoes, duracaoEfetiva } from '@/lib/slots'

// Volta uma mudança de agenda registrada no Histórico (mover, trocar, grupo, semana do
// rodízio). Só vale se os horários ainda estão como a mudança deixou, e recusa se voltar
// fizesse algum horário bater com outro.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json({ erro: 'Só a direção pode desfazer alterações.' }, { status: 403 })
  }

  const { id } = await params
  const registro = await prisma.registroAcesso.findUnique({ where: { id } })
  if (!registro) return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 })
  if (registro.desfeitoEm) {
    return NextResponse.json({ erro: 'Essa alteração já foi desfeita.' }, { status: 409 })
  }
  const mudanca = lerMudanca(registro.mudanca)
  if (!mudanca) {
    return NextResponse.json(
      { erro: 'Essa alteração é de antes da agenda em semanas (ou não guarda o antes/depois) e não pode ser desfeita automaticamente.' },
      { status: 400 },
    )
  }

  const ids = mudanca.horarios.map((h) => h.id)
  const atuais = await prisma.horario.findMany({
    where: { id: { in: ids }, excluidoEm: null, vinculo: { fim: null } },
  })
  const conferido = conferirDesfazer(
    mudanca,
    new Map(atuais.map((h) => [h.id, camposDoHorario(h)])),
  )
  if (!conferido.ok) return NextResponse.json({ erro: conferido.motivo }, { status: 409 })

  const antesDeTudo = await horariosVigentes()
  const volta = new Map(mudanca.horarios.map((h) => [h.id, h.antes]))
  const duracoes = await carregarDuracoes()
  const depoisDeTudo = antesDeTudo.map((h) => {
    const c = volta.get(h.id)
    return c
      ? { ...comCampos(h, c), duracaoMin: duracaoEfetiva(duracoes, h.profissionalId, c.diaSemana, c.hora, h.duracaoMin) }
      : h
  })
  const batidas = conflitosNovos(antesDeTudo, depoisDeTudo)
  if (batidas.length > 0) {
    return NextResponse.json(
      { erro: `Não dá para desfazer: ${descreverConflitoNovo(batidas[0])}.` },
      { status: 409 },
    )
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const marcou = await tx.registroAcesso.updateMany({
      where: { id, desfeitoEm: null },
      data: { desfeitoEm: new Date(), desfeitoPorId: sessao.user.id },
    })
    if (marcou.count === 0) return false
    for (const h of mudanca.horarios) {
      await tx.horario.update({
        where: { id: h.id },
        data: { diaSemana: h.antes.diaSemana, hora: h.antes.hora, semanas: h.antes.semanas },
      })
    }
    return true
  })
  if (!resultado) return NextResponse.json({ erro: 'Essa alteração já foi desfeita.' }, { status: 409 })

  await registrarAcesso(sessao.user.id, 'DESFEZ_ALTERACAO', `${registro.acao} · ${registro.alvo}`)
  return NextResponse.json({ ok: true })
}
