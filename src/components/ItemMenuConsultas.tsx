import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { agendaAvulsa } from '@/domain/consultas'
import { soConsultas } from '@/lib/consultas'

const ATIVO = 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
const INATIVO = 'rounded-lg px-3 py-2 text-slate-600'

// "Minha agenda" do profissional. Para quem só trabalha com consultas (psiquiatra, assistente
// social, sem horário fixo), leva direto às consultas: um botão só, sem "Consultas" repetido.
export async function ItemMenuAgenda({ itemAtivo }: { itemAtivo: string }) {
  let destino = '/agenda'
  try {
    const sessao = await auth()
    if (sessao?.user?.perfil === 'PROFISSIONAL' && (await soConsultas(sessao.user.id))) destino = '/consultas'
  } catch {
    // nunca quebra o cabeçalho
  }
  const ativo = itemAtivo === 'Agenda' || (destino === '/consultas' && itemAtivo === 'Consultas')
  return (
    <Link href={destino} className={ativo ? ATIVO : INATIVO}>
      Minha agenda
    </Link>
  )
}

// "Consultas" no menu do profissional: só para quem tem agenda avulsa E também horários fixos
// (aí "Minha agenda" é a semana fixa e as consultas ficam neste item). Nunca quebra o cabeçalho.
export default async function ItemMenuConsultas({ ativo }: { ativo: boolean }) {
  try {
    const sessao = await auth()
    if (sessao?.user?.perfil !== 'PROFISSIONAL') return null
    const eu = await prisma.usuario.findUnique({ where: { id: sessao.user.id }, select: { tipoAgenda: true } })
    if (!agendaAvulsa(eu?.tipoAgenda)) return null
    if (await soConsultas(sessao.user.id)) return null
  } catch {
    return null
  }
  return (
    <Link href="/consultas" className={ativo ? ATIVO : INATIVO}>
      Consultas
    </Link>
  )
}
