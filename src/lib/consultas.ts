// Gravação de consultas avulsas, usada ao marcar (POST /api/consultas) e ao agendar o retorno
// de um registro (PUT /api/consultas/[id]/registro).
import type { Prisma } from '@prisma/client'
import { prisma } from '@/db/prisma'
import { agendaAvulsa } from '@/domain/consultas'

// Profissional que só trabalha com consultas (psiquiatra, assistente social) e não tem nenhum
// horário fixo: para ele, "Minha agenda" é a tela Consultas.
export async function soConsultas(profissionalId: string): Promise<boolean> {
  const eu = await prisma.usuario.findUnique({ where: { id: profissionalId }, select: { tipoAgenda: true } })
  if (!agendaAvulsa(eu?.tipoAgenda)) return false
  const horariosFixos = await prisma.horario.count({
    where: { excluidoEm: null, vinculo: { profissionalId, fim: null } },
  })
  return horariosFixos === 0
}

type Db = Pick<Prisma.TransactionClient, 'atendimento'>

// Dia de uma consulta guardado ao meio-dia, como os demais atendimentos.
export function dataDaConsulta(diaISO: string): Date {
  return new Date(`${diaISO}T12:00:00`)
}

// O profissional já tem consulta marcada ou feita nesse dia e hora? (cancelada não conta)
export async function consultaEmConflito(db: Db, profissionalId: string, data: Date, hora: string): Promise<boolean> {
  const conflito = await db.atendimento.findFirst({
    where: {
      data,
      hora,
      situacao: { in: ['AGENDADO', 'REALIZADO'] },
      vinculo: { profissionalId },
    },
    select: { id: true },
  })
  return conflito !== null
}

// Cria a consulta avulsa AGENDADO. Se já houve uma desmarcada nesse mesmo dia e hora, ela volta a
// valer (a chave vínculo + dia + hora é única).
export async function gravarConsultaAvulsa(db: Db, vinculoId: string, data: Date, hora: string): Promise<{ id: string }> {
  const cancelada = await db.atendimento.findFirst({
    where: { vinculoId, data, hora, situacao: 'CANCELADO' },
    select: { id: true },
  })
  return cancelada
    ? db.atendimento.update({
        where: { id: cancelada.id },
        data: { avulso: true, situacao: 'AGENDADO', observacao: null },
        select: { id: true },
      })
    : db.atendimento.create({
        data: { vinculoId, data, hora, situacao: 'AGENDADO', avulso: true },
        select: { id: true },
      })
}
