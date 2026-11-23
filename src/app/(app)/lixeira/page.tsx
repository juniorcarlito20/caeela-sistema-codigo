import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'
import BotaoRestaurar, { type ItemLixeira } from '@/components/BotaoRestaurar'

const ROTULOS: Record<ItemLixeira['tipo'], string> = {
  aluno: 'Aluno',
  documento: 'Documento',
  evolucao: 'Evolução',
  horario: 'Horário',
  relatorio: 'Relatório',
  profissional: 'Profissional',
}

export default async function PaginaLixeira() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const [alunos, documentos, evolucoes, horarios, relatorios, profissionais] = await Promise.all([
    prisma.aluno.findMany({
      where: { excluidoEm: { not: null } },
      orderBy: { excluidoEm: 'desc' },
    }),
    prisma.documento.findMany({
      where: { excluidoEm: { not: null } },
      include: { aluno: { select: { nome: true } } },
      orderBy: { excluidoEm: 'desc' },
    }),
    prisma.evolucao.findMany({
      where: { excluidoEm: { not: null } },
      include: { atendimento: { include: { vinculo: { include: { aluno: true } } } } },
      orderBy: { excluidoEm: 'desc' },
    }),
    prisma.horario.findMany({
      where: { excluidoEm: { not: null } },
      include: { vinculo: { include: { aluno: true, profissional: true } } },
      orderBy: { excluidoEm: 'desc' },
    }),
    prisma.relatorio.findMany({
      where: { excluidoEm: { not: null } },
      include: { aluno: { select: { nome: true } }, autor: { select: { nome: true } } },
      orderBy: { excluidoEm: 'desc' },
    }),
    prisma.usuario.findMany({
      where: { excluidoEm: { not: null } },
      include: { area: { select: { nome: true } } },
      orderBy: { excluidoEm: 'desc' },
    }),
  ])

  const itens: ItemLixeira[] = [
    ...alunos.map((a) => ({
      tipo: 'aluno' as const,
      id: a.id,
      titulo: a.nome,
      detalhe: `matrícula ${a.matricula}`,
      excluidoPor: a.excluidoPor ?? '—',
      excluidoEm: a.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
    ...documentos.map((d) => ({
      tipo: 'documento' as const,
      id: d.id,
      titulo: d.nomeArquivo,
      detalhe: d.aluno.nome,
      excluidoPor: d.excluidoPor ?? '—',
      excluidoEm: d.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
    ...evolucoes.map((e) => ({
      tipo: 'evolucao' as const,
      id: e.id,
      titulo: `Evolução de ${e.atendimento.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
      detalhe: e.atendimento.vinculo.aluno.nome,
      excluidoPor: e.excluidoPor ?? '—',
      excluidoEm: e.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
    ...horarios.map((h) => ({
      tipo: 'horario' as const,
      id: h.id,
      titulo: `Horário: ${['', 'seg', 'ter', 'qua', 'qui', 'sex'][h.diaSemana]} ${h.hora}`,
      detalhe: `${h.vinculo.aluno.nome} · ${h.vinculo.profissional.nome}`,
      excluidoPor: h.excluidoPor ?? '—',
      excluidoEm: h.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
    ...relatorios.map((r) => ({
      tipo: 'relatorio' as const,
      id: r.id,
      titulo: `Relatório de ${r.criadoEm.toLocaleDateString('pt-BR')}${r.comAnamnese ? ' (com anamnese)' : ''}`,
      detalhe: `${r.aluno.nome} · emitido por ${r.autor.nome}`,
      excluidoPor: r.excluidoPor ?? '—',
      excluidoEm: r.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
    ...profissionais.map((u) => ({
      tipo: 'profissional' as const,
      id: u.id,
      titulo: u.nome,
      detalhe: `usuário ${u.usuario} · ${u.area?.nome ?? 'sem área'}`,
      excluidoPor: u.excluidoPor ?? '—',
      excluidoEm: u.excluidoEm!.toLocaleDateString('pt-BR'),
    })),
  ]

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Lixeira" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Lixeira</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Tudo o que foi excluído fica aqui até alguém restaurar
        </p>
        {itens.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Lixeira vazia.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Excluído por</th>
                  <th className="px-3 py-2">Excluído em</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={`${item.tipo}-${item.id}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <strong>{item.titulo}</strong>
                      <br />
                      <span className="text-[11.5px] text-slate-500">{item.detalhe}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{ROTULOS[item.tipo]}</td>
                    <td className="px-3 py-2 text-slate-600">{item.excluidoPor}</td>
                    <td className="px-3 py-2 text-slate-600">{item.excluidoEm}</td>
                    <td className="px-3 py-2">
                      <BotaoRestaurar item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-600">
          <strong>Por que existe a lixeira?</strong>
          <p className="mt-1">
            Porque excluir por engano acontece. Aqui a direção desfaz sozinha, sem depender de
            ninguém.
          </p>
        </div>
      </main>
    </div>
  )
}
