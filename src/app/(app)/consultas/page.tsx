import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { paginaInicial, type Perfil } from '@/domain/acesso'
import { primeiroDiaParaLancar } from '@/domain/presenca'
import {
  diaIso,
  diaMes,
  pessoaCombinaComBusca,
  podeVerConsultas,
  resumoDaPessoa,
  ROTULO_BLOCO,
  rotuloDia,
  separarConsultas,
} from '@/domain/consultas'
import { hojeNoFuso } from '@/lib/fuso'
import { normalizarBusca } from '@/lib/busca'
import Cabecalho from '@/components/Cabecalho'
import MarcarConsulta from '@/components/MarcarConsulta'
import DesmarcarConsultaBotao from '@/components/DesmarcarConsultaBotao'

function SeloPessoa({ deFora }: { deFora: boolean }) {
  return deFora ? (
    <span className="inline-block rounded-full bg-[#efe7fb] px-2.5 py-0.5 text-[11.5px] font-bold text-[#5b2fa0]">
      de fora
    </span>
  ) : (
    <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
      aluno
    </span>
  )
}

const classeLinkBotao =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-sm font-bold text-white'

type Pessoa = { id: string; nome: string; matricula: string; whatsapp: string | null; deFora: boolean }

export default async function PaginaConsultas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const perfil = sessao.user.perfil as Perfil
  const eAdmin = perfil === 'ADMIN'

  if (!eAdmin) {
    const eu =
      perfil === 'PROFISSIONAL'
        ? await prisma.usuario.findUnique({ where: { id: sessao.user.id }, select: { tipoAgenda: true } })
        : null
    if (!podeVerConsultas(perfil, eu?.tipoAgenda)) redirect(paginaInicial(perfil))
  }

  const { q, ok } = await searchParams
  const busca = (q ?? '').trim()
  const hojeISO = hojeNoFuso()
  const diaMinimo = eAdmin ? undefined : primeiroDiaParaLancar(hojeISO)
  // "+ Marcar consulta": o profissional marca dias à frente ou lança um atendimento que já
  // aconteceu (até 30 dias atrás; aí a tela de atender abre em seguida). "Marcar retorno" é de
  // hoje em diante. A direção marca qualquer dia.
  const diaMinimoMarcar = eAdmin ? undefined : hojeISO

  const profissionais = await prisma.usuario.findMany({
    where: {
      perfil: 'PROFISSIONAL',
      ativo: true,
      excluidoEm: null,
      tipoAgenda: { not: 'FIXA' },
      ...(eAdmin ? {} : { id: sessao.user.id }),
    },
    select: {
      id: true,
      nome: true,
      tipoAgenda: true,
      area: { select: { nome: true } },
      vinculos: {
        where: { fim: null, aluno: { excluidoEm: null } },
        select: {
          aluno: { select: { id: true, nome: true, matricula: true, whatsapp: true, deFora: true } },
        },
      },
    },
    orderBy: { nome: 'asc' },
  })
  const idsProfissionais = profissionais.map((p) => p.id)

  // Todas as consultas avulsas (menos as desmarcadas) desses profissionais: uma só consulta ao banco.
  const consultas = await prisma.atendimento.findMany({
    where: {
      avulso: true,
      situacao: { not: 'CANCELADO' },
      vinculo: { profissionalId: { in: idsProfissionais }, aluno: { excluidoEm: null } },
    },
    select: {
      id: true,
      data: true,
      hora: true,
      situacao: true,
      registroConsulta: { select: { id: true } },
      vinculo: {
        select: {
          profissionalId: true,
          aluno: { select: { id: true, nome: true, deFora: true } },
        },
      },
    },
  })

  const blocos = profissionais.map((prof) => {
    const doProfissional = consultas
      .filter((c) => c.vinculo.profissionalId === prof.id)
      .map((c) => ({
        id: c.id,
        data: c.data,
        hora: c.hora,
        situacao: c.situacao,
        temRegistro: c.registroConsulta !== null,
        aluno: c.vinculo.aluno,
      }))
    const { proximas, pendentes } = separarConsultas(doProfissional, hojeISO)

    const unicas = new Map<string, Pessoa>()
    for (const v of prof.vinculos) unicas.set(v.aluno.id, v.aluno)
    const pessoas = [...unicas.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((p) => ({
        ...p,
        ...resumoDaPessoa(
          doProfissional.filter((c) => c.aluno.id === p.id),
          hojeISO,
        ),
      }))
    return {
      prof,
      proximas,
      pendentes,
      alunosDoCentro: pessoas.filter((p) => !p.deFora),
      deFora: pessoas.filter((p) => p.deFora),
    }
  })

  // Buscar pessoa: entre quem já tem vínculo aberto com algum profissional de agenda avulsa.
  const achadas = new Map<string, { pessoa: Pessoa; profissionais: { id: string; nome: string }[] }>()
  if (busca.length >= 2) {
    for (const prof of profissionais) {
      for (const v of prof.vinculos) {
        if (!pessoaCombinaComBusca(v.aluno, busca, normalizarBusca)) continue
        const item = achadas.get(v.aluno.id) ?? { pessoa: v.aluno, profissionais: [] }
        item.profissionais.push({ id: prof.id, nome: prof.nome })
        achadas.set(v.aluno.id, item)
      }
    }
  }
  const resultados = [...achadas.values()]
    .sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'))
    .slice(0, 20)

  const secaoBusca = (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-[15px] font-extrabold">Buscar pessoa</h2>
      <form action="/consultas" method="get" className="flex flex-wrap gap-2">
        <label htmlFor="buscar-pessoa" className="sr-only">
          Nome, matrícula ou telefone
        </label>
        <input
          id="buscar-pessoa"
          name="q"
          type="search"
          defaultValue={busca}
          placeholder="Nome, matrícula ou telefone"
          className="min-h-[44px] min-w-[200px] flex-1 rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0A63C9] focus:outline-none"
        />
        <button type="submit" className={classeLinkBotao}>
          Buscar
        </button>
        {busca !== '' && (
          <Link
            href="/consultas"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600"
          >
            Limpar
          </Link>
        )}
      </form>
      {busca !== '' && busca.length < 2 && (
        <p className="mt-2 text-[13px] text-slate-500">Escreva pelo menos 2 letras.</p>
      )}
      {busca.length >= 2 && resultados.length === 0 && (
        <p className="mt-2 text-[13px] text-slate-500">Ninguém encontrado entre as pessoas já atendidas.</p>
      )}
      {resultados.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {resultados.map(({ pessoa, profissionais: profs }) => (
            <li key={pessoa.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/alunos/${pessoa.id}`} className="font-bold text-[#0A63C9] underline">
                  {pessoa.nome}
                </Link>
                <SeloPessoa deFora={pessoa.deFora} />
                <span className="text-[13px] text-slate-500">{profs.map((p) => p.nome).join(', ')}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profs.map((p) => (
                  <MarcarConsulta
                    key={p.id}
                    profissionalId={p.id}
                    profissionalNome={p.nome}
                    rotulo={profs.length > 1 ? `Marcar retorno com ${p.nome}` : 'Marcar retorno'}
                    pessoa={{ id: pessoa.id, nome: pessoa.nome, deFora: pessoa.deFora }}
                    diaMinimo={diaMinimoMarcar}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eAdmin ? 'Direção' : 'Profissional'}
        itemAtivo="Consultas"
        menu={eAdmin ? 'admin' : 'profissional'}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        {ok === '1' && (
          <p role="status" className="mb-4 rounded-lg border border-[#2EA84A]/30 bg-[#2EA84A]/10 px-4 py-3 text-sm font-bold text-[#1f7a35]">
            Registro salvo.
          </p>
        )}
        <h1 className="text-xl font-extrabold">{eAdmin ? 'Consultas' : 'Minha agenda'}</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {eAdmin
            ? 'Atendimentos marcados por dia e hora, sem horário fixo na semana.'
            : 'Suas consultas, marcadas por dia e hora. Toque em Atender na hora da consulta.'}
        </p>

        {secaoBusca}

        {blocos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            Nenhum profissional com agenda de consultas. A direção escolhe isso em Profissionais, ao editar o
            profissional.
          </p>
        )}

        {blocos.map(({ prof, proximas, pendentes, alunosDoCentro, deFora }) => {
          const proprio = !eAdmin
          const titulo = proprio
            ? 'Meus atendimentos'
            : prof.nome
          return (
            <section key={prof.id} className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">{titulo}</h2>
                  <p className="text-[13px] text-slate-500">
                    {prof.area?.nome ?? 'Sem área'} · {ROTULO_BLOCO[prof.tipoAgenda] ?? ''}
                  </p>
                </div>
                <MarcarConsulta
                  profissionalId={prof.id}
                  profissionalNome={prof.nome}
                  rotulo="+ Marcar consulta"
                  diaMinimo={diaMinimo}
                  hojeISO={proprio ? hojeISO : undefined}
                  destaque
                />
              </div>

              {(() => {
                const deHoje = proximas.filter((c) => diaIso(c.data) === hojeISO)
                const depois = proximas.filter((c) => diaIso(c.data) !== hojeISO)
                const linha = (c: (typeof proximas)[number], estilo: string, mostrarDia: boolean) => {
                  const dia = diaIso(c.data)
                  return (
                    <li key={c.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${estilo}`}>
                      <span className="min-w-[110px] text-sm font-bold">
                        {mostrarDia ? `${rotuloDia(dia)} · ` : ''}
                        {c.hora}
                      </span>
                      <Link href={`/alunos/${c.aluno.id}`} className="font-bold text-[#0A63C9] underline">
                        {c.aluno.nome}
                      </Link>
                      <SeloPessoa deFora={c.aluno.deFora} />
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        {!eAdmin && (
                          <Link href={`/consultas/${c.id}`} className={classeLinkBotao}>
                            Atender
                          </Link>
                        )}
                        <DesmarcarConsultaBotao consultaId={c.id} pessoa={c.aluno.nome} quando={`${diaMes(dia)} às ${c.hora}`} />
                      </span>
                    </li>
                  )
                }
                return (
                  <>
                    <h3 className="mb-2 text-[14px] font-extrabold">Hoje · {diaMes(hojeISO)}</h3>
                    {deHoje.length === 0 ? (
                      <p className="mb-4 text-[13px] text-slate-500">Nenhuma consulta marcada para hoje.</p>
                    ) : (
                      <ul className="mb-4 flex flex-col gap-2">
                        {deHoje.map((c) => linha(c, 'border-[1.5px] border-[#0A63C9]/40 bg-[#eef5ff]', false))}
                      </ul>
                    )}

                    {pendentes.length > 0 && (
                      <>
                        <h3 className="mb-1 text-[14px] font-extrabold text-[#8a6100]">Pendentes</h3>
                        <p className="mb-2 text-[13px] text-slate-500">
                          Consultas de dias que já passaram, sem registro.
                        </p>
                        <ul className="mb-4 flex flex-col gap-2">
                          {pendentes.map((c) => linha(c, 'border-[1.5px] border-[#F0C000] bg-[#fff6d6]', true))}
                        </ul>
                      </>
                    )}

                    <h3 className="mb-2 text-[14px] font-extrabold">Próximos dias</h3>
                    {depois.length === 0 ? (
                      <p className="mb-4 text-[13px] text-slate-500">Nenhuma consulta marcada.</p>
                    ) : (
                      <ul className="mb-4 flex flex-col gap-2">
                        {depois.map((c) => linha(c, 'border border-slate-200', true))}
                      </ul>
                    )}
                  </>
                )
              })()}

              {[
                { titulo: 'Alunos do centro', lista: alunosDoCentro, vazio: 'Nenhum aluno acompanhado.' },
                { titulo: 'Atendidos de fora do centro', lista: deFora, vazio: 'Nenhuma pessoa de fora acompanhada.' },
              ].map((grupo) => (
                <div key={grupo.titulo} className="mb-4 last:mb-0">
                  <h3 className="mb-2 text-[14px] font-extrabold">{grupo.titulo}</h3>
                  {grupo.lista.length === 0 ? (
                    <p className="text-[13px] text-slate-500">{grupo.vazio}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {grupo.lista.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-3 py-2">
                          <Link href={`/alunos/${p.id}`} className="font-bold text-[#0A63C9] underline">
                            {p.nome}
                          </Link>
                          <span className="text-[13px] text-slate-600">
                            Última: {p.ultima ? diaMes(p.ultima.dia) : '—'}
                          </span>
                          <span className="text-[13px] text-slate-600">
                            Próxima: {p.proxima ? `${diaMes(p.proxima.dia)} às ${p.proxima.hora}` : '—'}
                          </span>
                          <MarcarConsulta
                            profissionalId={prof.id}
                            profissionalNome={prof.nome}
                            rotulo="Marcar retorno"
                            pessoa={{ id: p.id, nome: p.nome, deFora: p.deFora }}
                            diaMinimo={diaMinimoMarcar}
                            alinharDireita
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )
        })}
      </main>
    </div>
  )
}
