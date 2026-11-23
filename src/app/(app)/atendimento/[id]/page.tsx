import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/db/prisma'
import { auth } from '@/lib/auth'
import { ausenciaNoDia } from '@/lib/ausencias'
import { semAtendimentoNoDia } from '@/lib/diasSemAtendimento'
import { PREFIXO_SEM_ATENDIMENTO } from '@/domain/diaSemAtendimento'
import RegistroPresenca from '@/components/RegistroPresenca'
import { podeLancarNoDia, textoLancadoDepois, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { hojeNoFuso } from '@/lib/fuso'

function parseDataHora(
  data: string | undefined,
  hora: string | undefined,
): { data: Date; hora: string } | null {
  if (!data || !hora) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null
  const d = new Date(`${data}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return { data: d, hora }
}

function textoData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' })
}

export default async function PaginaAtendimento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ data?: string; hora?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')

  const { id } = await params
  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: { aluno: true, profissional: true, area: true },
  })
  if (!vinculo) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10 text-center">
        <p className="font-bold">Atendimento não encontrado.</p>
        <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
          ← Voltar para a agenda
        </Link>
      </main>
    )
  }
  if (
    sessao.user.perfil !== 'ADMIN' &&
    vinculo.profissionalId !== sessao.user.id
  ) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10 text-center">
        <p className="font-bold">Este atendimento não é seu.</p>
        <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
          ← Voltar para a agenda
        </Link>
      </main>
    )
  }

  const { data, hora } = await searchParams
  const dh = parseDataHora(data, hora)
  if (!dh) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10 text-center">
        <p className="font-bold">Faltou o dia e a hora do atendimento.</p>
        <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
          ← Voltar para a agenda
        </Link>
      </main>
    )
  }

  // Além de 30 dias só a direção cria e lança; os outros só veem o que já existe.
  const alemDoLimite = !podeLancarNoDia(sessao.user.perfil, data!, hojeNoFuso())
  if (alemDoLimite) {
    const existente = await prisma.atendimento.findUnique({
      where: { vinculoId_data_hora: { vinculoId: vinculo.id, data: dh.data, hora: dh.hora } },
      select: { id: true },
    })
    if (!existente) {
      return (
        <main className="mx-auto max-w-[480px] px-4 py-10 text-center">
          <p className="font-bold">{AVISO_LIMITE_LANCAR}</p>
          <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
            ← Voltar para a agenda
          </Link>
        </main>
      )
    }
  }

  const atendimento = await prisma.atendimento.upsert({
    where: {
      vinculoId_data_hora: { vinculoId: vinculo.id, data: dh.data, hora: dh.hora },
    },
    update: {},
    create: { vinculoId: vinculo.id, data: dh.data, hora: dh.hora },
    include: { registradoPor: { select: { nome: true } } },
  })

  const horario = await prisma.horario.findFirst({
    where: { vinculoId: vinculo.id, diaSemana: ((dh.data.getDay() + 6) % 7) + 1, hora: dh.hora },
    select: { local: true },
  })
  const local = horario?.local
  const foraDoCentro = local && local.trim().toUpperCase() !== 'CAEELA' ? local : null

  const falta = await ausenciaNoDia(vinculo.profissionalId, data!)
  if (falta && atendimento.situacao === 'AGENDADO') {
    await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        situacao: 'CANCELADO',
        observacao: `Profissional ausente: ${falta.tipo}`,
        ausenciaId: falta.id,
      },
    })
    atendimento.situacao = 'CANCELADO'
  }

  const motivoSemAtendimento = await semAtendimentoNoDia(data!)
  if (motivoSemAtendimento && atendimento.situacao === 'AGENDADO') {
    await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: { situacao: 'CANCELADO', observacao: `${PREFIXO_SEM_ATENDIMENTO}${motivoSemAtendimento}` },
    })
    atendimento.situacao = 'CANCELADO'
  }

  return (
    <main className="mx-auto w-full max-w-[480px] bg-white px-4 py-5 text-[#16243b]">
      <p className="text-lg font-extrabold">{vinculo.aluno.nome}</p>
      <p className="mb-4 text-[13px] text-slate-500">
        {textoData(dh.data)} · {dh.hora} · {vinculo.area.nome} · {vinculo.profissional.nome}
        {foraDoCentro && <span className="font-bold text-slate-600"> · 📍 {foraDoCentro}</span>}
      </p>
      {textoLancadoDepois(data!, atendimento.confirmadoEm) && (
        <p className="-mt-3 mb-4 text-[12px] text-slate-500">
          {textoLancadoDepois(data!, atendimento.confirmadoEm)}
        </p>
      )}
      {alemDoLimite && (
        <p role="status" className="mb-3 text-[12.5px] font-bold text-slate-600">
          {AVISO_LIMITE_LANCAR}
        </p>
      )}
      {atendimento.situacao === 'CANCELADO' ? (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
          {motivoSemAtendimento
            ? `Sem atendimento neste dia: ${motivoSemAtendimento}. A criança não recebe falta por isso.`
            : 'Cancelado — profissional ausente. A criança não recebe falta por isso.'}
        </p>
      ) : (
        <RegistroPresenca
          atendimentoId={atendimento.id}
          vinculoId={vinculo.id}
          data={data!}
          hora={hora!}
          situacaoAtual={atendimento.situacao}
          responsavel={vinculo.aluno.responsavel}
          assinadoEm={atendimento.assinadoEm?.toISOString() ?? null}
          dispositivo={atendimento.dispositivo}
          confirmadoEm={atendimento.confirmadoEm?.toISOString() ?? null}
          registradoPorNome={atendimento.registradoPor?.nome ?? null}
        />
      )}
    </main>
  )
}
