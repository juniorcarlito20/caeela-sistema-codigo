import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listarConflitos } from '@/domain/conflitos'
import { rotuloSemanas } from '@/domain/semanas'
import { horariosVigentes, type HorarioVigente } from '@/lib/agendaVigente'
import Cabecalho from '@/components/Cabecalho'

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

function Horario({ h }: { h: HorarioVigente }) {
  const periodo = rotuloSemanas(h.semanas, h.semanasNoCiclo) || 'toda semana'
  return (
    <div className="rounded-lg border border-slate-200 bg-[#f8fafc] p-3 text-[13px]">
      <p className="font-bold">
        {DIAS[h.diaSemana]} às {h.hora}
      </p>
      <p className="text-slate-600">
        <Link href={`/alunos/${h.alunoId}`} className="font-bold text-[#0A63C9]">
          {h.alunoNome}
        </Link>{' '}
        com{' '}
        <Link href={`/profissionais/${h.profissionalId}?aba=agenda`} className="font-bold text-[#0A63C9]">
          {h.profissionalNome}
        </Link>{' '}
        <span className="text-slate-500">({h.areaNome})</span>
      </p>
      <p className="text-[12px] text-slate-500">
        {periodo}
      </p>
    </div>
  )
}

export default async function PaginaConflitos() {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const pares = listarConflitos(await horariosVigentes()).sort(
    (x, y) => x.a.diaSemana - y.a.diaSemana || x.a.hora.localeCompare(y.a.hora),
  )

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Painel" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <Link href="/painel" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]">
          ← Voltar para o painel
        </Link>
        <h1 className="text-xl font-extrabold">Horários em conflito</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          O sistema só mostra onde os horários batem — quem decide o que mudar é a secretaria.
          Abra a ficha do profissional, toque em &ldquo;Mover atendimentos&rdquo; e mude um dos dois
          para um horário livre, ou encerre um dos atendimentos.
        </p>
        {pares.length === 0 ? (
          <p className="rounded-xl border border-[#2EA84A]/30 bg-[#2EA84A]/10 p-5 text-sm font-bold text-[#1c7a33]">
            Nenhum conflito de horário agora.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pares.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className="rounded-xl border-l-4 border-[#B3261E] bg-white p-4">
                <p className="mb-2 text-[14px] font-extrabold text-[#B3261E]">
                  {p.motivo === 'ALUNO'
                    ? `${p.a.alunoNome} está em dois atendimentos ao mesmo tempo`
                    : `${p.a.profissionalNome} tem mais alunos do que vagas no horário`}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Horario h={p.a} />
                  <Horario h={p.b} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
