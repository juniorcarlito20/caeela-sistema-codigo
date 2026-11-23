import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/db/prisma'
import { auth } from '@/lib/auth'
import { registrarAcesso } from '@/lib/registro'
import FormularioEvolucao from '@/components/FormularioEvolucao'
import UltimasEvolucoes from '@/components/UltimasEvolucoes'
import { ultimasEvolucoes } from '@/domain/evolucao'
import { podeLancarNoDia, textoLancadoDepois, AVISO_LIMITE_LANCAR } from '@/domain/presenca'
import { hojeNoFuso } from '@/lib/fuso'

function telaErro(mensagem: string) {
  return (
    <main className="mx-auto max-w-[560px] px-4 py-10 text-center text-[#16243b]">
      <p className="font-bold">{mensagem}</p>
      <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
        ← Voltar para a agenda
      </Link>
    </main>
  )
}

export default async function PaginaEvolucao({
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
    include: { aluno: true, area: true },
  })
  if (!vinculo) return telaErro('Atendimento não encontrado.')
  if (
    sessao.user.perfil !== 'ADMIN' &&
    vinculo.profissionalId !== sessao.user.id
  ) {
    return telaErro('Este atendimento não é seu.')
  }

  const { data, hora } = await searchParams
  if (!data || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return telaErro('Faltou o dia e a hora do atendimento.')
  }
  const dia = new Date(`${data}T12:00:00`)
  if (Number.isNaN(dia.getTime())) return telaErro('Confira o dia do atendimento.')

  // Além de 30 dias só a direção cria; os outros só abrem o que já existe.
  const alemDoLimite = !podeLancarNoDia(sessao.user.perfil, data, hojeNoFuso())
  if (alemDoLimite) {
    const existente = await prisma.atendimento.findUnique({
      where: { vinculoId_data_hora: { vinculoId: vinculo.id, data: dia, hora } },
      select: { id: true },
    })
    if (!existente) return telaErro(AVISO_LIMITE_LANCAR)
  }

  const atendimento = await prisma.atendimento.upsert({
    where: { vinculoId_data_hora: { vinculoId: vinculo.id, data: dia, hora } },
    update: {},
    create: { vinculoId: vinculo.id, data: dia, hora },
    include: { evolucao: true },
  })

  // As últimas evoluções da criança, para lembrar o que foi feito antes (só as que quem abriu pode ver).
  const [anteriores, transferencias] = await Promise.all([
    prisma.evolucao.findMany({
      where: { excluidoEm: null, atendimentoId: { not: atendimento.id }, atendimento: { vinculo: { alunoId: vinculo.alunoId } } },
      include: { atendimento: { select: { data: true, hora: true } }, autor: { select: { nome: true } } },
      orderBy: { atendimento: { data: 'desc' } },
      take: 40,
    }),
    prisma.transferencia.findMany({
      where: { alunoId: vinculo.alunoId },
      select: { paraProfissionalId: true, criadoEm: true },
    }),
  ])
  const ultimas = ultimasEvolucoes(
    anteriores.map((e) => ({
      id: e.id, autorId: e.autorId, autorNome: e.autor.nome, criadoEm: e.criadoEm,
      data: e.atendimento.data, hora: e.atendimento.hora,
      atividade: e.atividade, objetivo: e.objetivo, observacoes: e.observacoes,
    })),
    {
      sessao: { id: sessao.user.id, perfil: sessao.user.perfil },
      transferencias,
      profissionalDoAtendimento: vinculo.profissionalId,
      antesDe: { data: dia, hora },
    },
  )

  // Registro de acesso: a direção lendo evolução escrita por outro profissional.
  if (sessao.user.perfil === 'ADMIN' && atendimento.evolucao) {
    await registrarAcesso(sessao.user.id, 'ABRIU_EVOLUCAO', `atendimento:${atendimento.id}`)
  }
  if (sessao.user.perfil === 'ADMIN' && ultimas.length > 0) {
    await registrarAcesso(sessao.user.id, 'ABRIU_EVOLUCAO', `aluno:${vinculo.alunoId} (últimas evoluções)`)
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5 text-[#16243b]">
      <p className="text-lg font-extrabold">{vinculo.aluno.nome}</p>
      <p className="mb-4 text-[13px] text-slate-500">
        {dia.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às {hora} ·{' '}
        {vinculo.area.nome}
      </p>
      {atendimento.evolucao && textoLancadoDepois(data, atendimento.evolucao.criadoEm) && (
        <p className="-mt-3 mb-4 text-[12px] text-slate-500">
          {textoLancadoDepois(data, atendimento.evolucao.criadoEm)}
        </p>
      )}
      {alemDoLimite && (
        <p role="status" className="mb-3 text-[12.5px] font-bold text-slate-600">
          {AVISO_LIMITE_LANCAR}
        </p>
      )}
      <UltimasEvolucoes itens={ultimas} euId={sessao.user.id} />
      <FormularioEvolucao
        atendimentoId={atendimento.id}
        alunoId={vinculo.alunoId}
        inicial={
          atendimento.evolucao
            ? {
                id: atendimento.evolucao.id,
                atividade: atendimento.evolucao.atividade,
                objetivo: atendimento.evolucao.objetivo,
                observacoes: atendimento.evolucao.observacoes,
              }
            : null
        }
      />
    </main>
  )
}
