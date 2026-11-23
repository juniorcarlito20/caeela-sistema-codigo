import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import FormularioProfissional from '@/components/FormularioProfissional'
import AcoesProfissional from '@/components/AcoesProfissional'
import Cabecalho from '@/components/Cabecalho'
import { seloDoNome } from '@/domain/tipoAgenda'

export default async function PaginaProfissionais() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const [usuarios, areas, vinculosPorProfissional] = await Promise.all([
    prisma.usuario.findMany({
      where: { excluidoEm: null },
      orderBy: { nome: 'asc' },
      include: { area: true },
    }),
    prisma.area.findMany({ orderBy: { nome: 'asc' } }),
    prisma.vinculo.groupBy({ by: ['profissionalId'], where: { fim: null }, _count: true }), // conta também os de fora: é a trava de desativar
  ])
  const vinculosAtivosPorId = new Map(
    vinculosPorProfissional.map((v) => [v.profissionalId, v._count]),
  )

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Profissionais" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Profissionais</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {usuarios.length} acessos · quem sai do centro é desativado, nunca apagado
        </p>
        <div className="mb-5">
          <FormularioProfissional
            areas={areas}
            usuariosEmUso={usuarios.map((u) => u.usuario)}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">
                    {u.perfil === 'PROFISSIONAL' ? (
                      <Link href={`/profissionais/${u.id}`} className="text-[#0A63C9] hover:underline">
                        {u.nome}
                      </Link>
                    ) : (
                      u.nome
                    )}
                    {seloDoNome(u.perfil, u.tipoAgenda) && (
                      <span
                        className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          u.perfil === 'ADMIN'
                            ? 'bg-[#e6f0ff] text-[#0A63C9]'
                            : u.perfil === 'SECRETARIA'
                              ? 'bg-[#efe7fb] text-[#6b3fb8]'
                              : 'bg-[#fff6d6] text-[#8a6100]'
                        }`}
                      >
                        {seloDoNome(u.perfil, u.tipoAgenda)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{u.usuario}</td>
                  <td className="px-3 py-2 text-slate-600">{u.area?.nome ?? '—'}</td>
                  <td className="px-3 py-2">
                    {u.perfil === 'ADMIN' ? (
                      <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">Direção</span>
                    ) : u.perfil === 'SECRETARIA' ? (
                      <span className="inline-block rounded-full bg-[#efe7fb] px-2.5 py-0.5 text-[11.5px] font-bold text-[#6b3fb8]">Secretaria</span>
                    ) : (
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-bold text-slate-600">Profissional</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.ativo ? (
                      <span className="inline-block rounded-full bg-[#e4f6e8] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1c7a33]">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-[#fde7e7] px-2.5 py-0.5 text-[11.5px] font-bold text-[#B3261E]">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <AcoesProfissional
                      id={u.id}
                      nome={u.nome}
                      ativo={u.ativo}
                      perfilAtual={u.perfil}
                      vinculosAtivos={vinculosAtivosPorId.get(u.id) ?? 0}
                      areas={areas}
                      areaIdAtual={u.areaId}
                      usuarioAtual={u.usuario}
                      emailAtual={u.email}
                      telefoneAtual={u.telefone}
                      tipoAgendaAtual={u.tipoAgenda}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
