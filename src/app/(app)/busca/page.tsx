import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { buscar } from '@/lib/busca'
import { rotuloPresenca } from '@/lib/busca'
import Cabecalho from '@/components/Cabecalho'

const DIAS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta']

export default async function PaginaBusca({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')

  const { q } = await searchParams
  const termo = (q ?? '').trim()
  const { alunos, profissionais } =
    termo.length >= 2
      ? await buscar({ id: sessao.user.id, perfil: sessao.user.perfil }, termo)
      : { alunos: [], profissionais: [] }
  const eSecretaria = sessao.user.perfil === 'SECRETARIA'
  const menu = sessao.user.perfil === 'ADMIN' ? ('admin' as const) : eSecretaria ? ('secretaria' as const) : ('profissional' as const)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={sessao.user.perfil === 'ADMIN' ? 'Direção' : eSecretaria ? 'Secretaria' : 'Profissional'}
        itemAtivo={eSecretaria ? 'Busca' : 'Alunos'}
        menu={menu}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">
          Resultados para “{termo}”
        </h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {alunos.length} {alunos.length === 1 ? 'aluno' : 'alunos'} e{' '}
          {profissionais.length}{' '}
          {profissionais.length === 1 ? 'profissional' : 'profissionais'}
        </p>
        {alunos.length === 0 && profissionais.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Ninguém encontrado. Tente o nome, a matrícula ou o CPF.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {alunos.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[16px] font-extrabold">{a.nome}</p>
                <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
                  {a.rotuloSituacao}
                </span>
                {!eSecretaria && a.pendencias.map((p) => (
                  <span
                    key={p}
                    className="inline-block rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[11.5px] font-bold text-[#8a6100]"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Matrícula {a.matricula}
              </p>
              {a.vinculos.length > 0 && (
                <ul className="mt-2 text-[13px]">
                  {a.vinculos.map((v, i) => (
                    <li key={i}>
                      {v.area} · {v.profissional} · {DIAS[v.dia]} às {v.hora}
                      {v.frequencia ? ` · ${v.frequencia}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {a.ultimas.length > 0 && (
                <p className="mt-1 text-[12.5px] text-slate-500">
                  <strong>Últimas presenças:</strong>{' '}
                  {a.ultimas.map((u) => `${u.data} ${rotuloPresenca(u.situacao)}`).join(' · ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/alunos/${a.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white"
                >
                  Abrir ficha
                </Link>
              </div>
            </div>
          ))}
          {profissionais.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[16px] font-extrabold">{p.nome}</p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                {p.area} · {p.alunos} {p.alunos === 1 ? 'aluno' : 'alunos'} ·{' '}
                {p.dias === '—' ? 'sem dias marcados' : `atende ${p.dias}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={eSecretaria ? `/equipe/${p.id}` : `/profissionais/${p.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-xs font-bold text-white"
                >
                  {eSecretaria ? 'Ver agenda' : 'Abrir ficha'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
