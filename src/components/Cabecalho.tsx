import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { signOut } from '@/lib/auth'
import BuscaRapida from './BuscaRapida'
import ContadorSugestoes from './ContadorSugestoes'
import ItemMenuConsultas, { ItemMenuAgenda } from './ItemMenuConsultas'

async function sair() {
  'use server'
  await signOut({ redirectTo: '/entrar' })
}

export default function Cabecalho({
  nome,
  detalhe,
  itemAtivo,
  menu = 'admin',
}: {
  nome: string
  detalhe: string
  itemAtivo: 'Painel' | 'Alunos' | 'Profissionais' | 'Agendas' | 'Lembretes' | 'Agenda' | 'Histórico' | 'Busca' | 'Lixeira' | 'Sugestões' | 'Consultas'
  menu?: 'admin' | 'profissional' | 'secretaria'
}) {
  const inicio = menu === 'admin' ? '/painel' : menu === 'secretaria' ? '/lembretes' : '/agenda'
  return (
    <>
      <div className="h-[7px] bg-gradient-to-r from-[#e63946] via-[#F0C000] to-[#0070F0]" />
      <header className="flex flex-wrap items-center justify-center gap-6 bg-gradient-to-br from-[#eef5ff] via-white to-[#eafaf0] px-6 py-4">
        <Link href={inicio} className="contents">
          <Image
            src="/logo-caeela.png"
            alt="Logo do CAEELA"
            width={72}
            height={72}
            className="h-[72px] w-[72px] object-contain"
          />
          <div className="min-w-[230px] flex-1 text-center">
            <p className="text-[13px] font-extrabold leading-snug tracking-wide">
              CENTRO DE ATENDIMENTO EDUCACIONAL ESPECIALIZADO
              <br />
              DE LICÍNIO DE ALMEIDA – BA
            </p>
            <p className="mt-1 text-xl font-black tracking-[4px] text-[#0070F0]">CAEELA</p>
            <p className="text-[11px] tracking-[1px] text-slate-500">ACOLHER, INCLUIR E EDUCAR</p>
          </div>
        </Link>
        <Image
          src="/brasao-secretaria.png"
          alt="Demonstração"
          width={150}
          height={58}
          className="h-auto w-[150px] object-contain"
        />
      </header>
      <nav className="flex flex-wrap items-center gap-1 border-y border-slate-200 bg-[#f4f7fc] px-4 py-2 text-[13px]">
        {menu === 'admin' ? (
          <>
            <Link
              href="/painel"
              className={
                itemAtivo === 'Painel'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Painel
            </Link>
            <Link
              href="/alunos"
              className={
                itemAtivo === 'Alunos'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Alunos
            </Link>
            <Link
              href="/profissionais"
              className={
                itemAtivo === 'Profissionais'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Profissionais
            </Link>
            <Link
              href="/agendas"
              className={
                itemAtivo === 'Agendas'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Agendas
            </Link>
            <Link
              href="/consultas"
              className={
                itemAtivo === 'Consultas'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Consultas
            </Link>
            <Link
              href="/lembretes"
              className={
                itemAtivo === 'Lembretes'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Lembretes
            </Link>
            <Link
              href="/sugestoes"
              className={
                itemAtivo === 'Sugestões'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Sugestões
              <Suspense fallback={null}>
                <ContadorSugestoes />
              </Suspense>
            </Link>
            <Link
              href="/registro-acessos"
              className={
                itemAtivo === 'Histórico'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Histórico
            </Link>
            <Link
              href="/lixeira"
              className={
                itemAtivo === 'Lixeira'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Lixeira
            </Link>
          </>
        ) : menu === 'secretaria' ? (
          <>
            <Link href="/lembretes" className={itemAtivo === 'Lembretes' ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white' : 'rounded-lg px-3 py-2 text-slate-600'}>
              Lembretes
            </Link>
            <Link href="/equipe" className={itemAtivo === 'Agendas' ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white' : 'rounded-lg px-3 py-2 text-slate-600'}>
              Agendas
            </Link>
            <Link href="/alunos" className={itemAtivo === 'Alunos' ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white' : 'rounded-lg px-3 py-2 text-slate-600'}>
              Alunos
            </Link>
            <Link href="/busca" className={itemAtivo === 'Busca' ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white' : 'rounded-lg px-3 py-2 text-slate-600'}>
              Busca
            </Link>
          </>
        ) : (
          <>
            <Suspense
              fallback={
                <Link href="/agenda" className="rounded-lg px-3 py-2 text-slate-600">
                  Minha agenda
                </Link>
              }
            >
              <ItemMenuAgenda itemAtivo={itemAtivo} />
            </Suspense>
            <Link
              href="/alunos"
              className={
                itemAtivo === 'Alunos'
                  ? 'rounded-lg bg-[#0A63C9] px-3 py-2 font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-slate-600'
              }
            >
              Meus alunos
            </Link>
            <Suspense fallback={null}>
              <ItemMenuConsultas ativo={itemAtivo === 'Consultas'} />
            </Suspense>
          </>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {nome} · {detalhe}
        </span>
        <BuscaRapida modo={menu === 'secretaria' ? 'secretaria' : 'normal'} />
        <form action={sair}>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-lg border-[1.5px] border-[#B3261E] px-3 py-2 text-[13px] font-bold text-[#B3261E]"
          >
            Sair
          </button>
        </form>
      </nav>
    </>
  )
}
