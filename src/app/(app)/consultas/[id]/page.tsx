import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/db/prisma'
import { auth } from '@/lib/auth'
import { registrarAcesso } from '@/lib/registro'
import { hojeNoFuso } from '@/lib/fuso'
import { AVISO_LIMITE_LANCAR, podeLancarNoDia, textoLancadoDepois } from '@/domain/presenca'
import {
  camposDoRegistro,
  diaIso,
  podeRegistrarConsulta,
  retornoParaCampos,
  ROTULO_SITUACAO_CONSULTA,
  ROTULO_TIPO_CONSULTA,
  ultimasConsultas,
  type TipoConsultaRegistro,
} from '@/domain/consultas'
import FormularioConsulta, { type RegistroInicial } from '@/components/FormularioConsulta'
import UltimasConsultas from '@/components/UltimasConsultas'
import DetalheRegistroConsulta, { type DadosRegistroConsulta } from '@/components/DetalheRegistroConsulta'

function telaErro(mensagem: string) {
  return (
    <main className="mx-auto max-w-[560px] px-4 py-10 text-center text-[#16243b]">
      <p className="font-bold">{mensagem}</p>
      <Link href="/consultas" className="mt-2 inline-flex min-h-[44px] items-center font-bold text-[#0A63C9]">
        ← Voltar
      </Link>
    </main>
  )
}

const dataBR = (iso: string) => iso.split('-').reverse().join('/')

// Leitura do registro (a direção, ou o profissional fora do prazo de edição).
function VistaRegistro({ r }: { r: DadosRegistroConsulta & { tipo: string } }) {
  return (
    <section aria-label="Registro da consulta" className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-[14px] font-bold">
        {ROTULO_TIPO_CONSULTA[r.tipo as TipoConsultaRegistro] ?? r.tipo}
      </p>
      <DetalheRegistroConsulta r={r} />
    </section>
  )
}

export default async function PaginaRegistroConsulta({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const { id: usuarioId, perfil } = sessao.user
  const eAdmin = perfil === 'ADMIN'

  const { id } = await params
  const consulta = await prisma.atendimento.findFirst({
    where: { id, avulso: true },
    include: {
      vinculo: {
        select: {
          alunoId: true,
          profissionalId: true,
          profissional: { select: { nome: true, tipoAgenda: true } },
          aluno: { select: { id: true, nome: true, deFora: true, excluidoEm: true } },
        },
      },
      registroConsulta: true,
    },
  })
  if (!consulta || consulta.vinculo.aluno.excluidoEm) return telaErro('Consulta não encontrada.')

  const ehProfissionalDaConsulta = podeRegistrarConsulta({ id: usuarioId, perfil }, consulta.vinculo.profissionalId)
  if (!eAdmin && !ehProfissionalDaConsulta) return telaErro('Esta consulta não é sua.')

  const registro = consulta.registroConsulta && !consulta.registroConsulta.excluidoEm ? consulta.registroConsulta : null
  const dia = diaIso(consulta.data)
  const hojeISO = hojeNoFuso()
  const alemDoLimite = !podeLancarNoDia(perfil, dia, hojeISO)
  const aluno = consulta.vinculo.aluno
  const depois = registro ? textoLancadoDepois(dia, registro.criadoEm) : null

  // Registro de acesso: a direção lendo o que outro profissional escreveu (só quem, nunca o texto).
  if (eAdmin && registro) {
    await registrarAcesso(usuarioId, 'ABRIU_CONSULTA', `aluno:${aluno.id} (consulta de ${dataBR(dia)})`)
  }

  // Últimas consultas da pessoa com este profissional (só para quem vai registrar).
  const podeEditar = ehProfissionalDaConsulta && !alemDoLimite && consulta.situacao !== 'CANCELADO'
  let ultimas: ReturnType<typeof ultimasConsultas> = []
  if (podeEditar) {
    const [anteriores, transferencias] = await Promise.all([
      prisma.registroConsulta.findMany({
        where: {
          excluidoEm: null,
          atendimentoId: { not: consulta.id },
          atendimento: { avulso: true, vinculo: { alunoId: aluno.id, profissionalId: consulta.vinculo.profissionalId } },
        },
        include: {
          atendimento: { select: { data: true, hora: true, situacao: true } },
          autor: { select: { nome: true } },
        },
        orderBy: { atendimento: { data: 'desc' } },
        take: 40,
      }),
      prisma.transferencia.findMany({
        where: { alunoId: aluno.id },
        select: { paraProfissionalId: true, criadoEm: true },
      }),
    ])
    ultimas = ultimasConsultas(
      anteriores.map((r) => ({
        id: r.id,
        autorId: r.autorId,
        autorNome: r.autor.nome,
        criadoEm: r.criadoEm,
        data: r.atendimento.data,
        hora: r.atendimento.hora,
        tipo: r.tipo,
        situacao: r.atendimento.situacao,
        presentes: r.presentes,
        registro: r.registro,
        encaminhamentos: r.encaminhamentos,
        proximoPasso: r.proximoPasso,
      })),
      {
        sessao: { id: usuarioId, perfil },
        transferencias,
        antesDe: { data: consulta.data, hora: consulta.hora },
      },
    )
  }

  const retorno = registro ? retornoParaCampos(registro.retornoEm) : null
  const inicial: RegistroInicial | null = registro
    ? {
        situacao: consulta.situacao === 'FALTOU' ? 'FALTOU' : 'REALIZADO',
        tipo: registro.tipo,
        presentes: registro.presentes ?? '',
        registro: registro.registro,
        encaminhamentos: registro.encaminhamentos,
        proximoPasso: registro.proximoPasso ?? '',
        retornoData: retorno?.dia ?? '',
        retornoHora: retorno?.hora ?? '',
      }
    : null

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-5 text-[#16243b]">
      <Link href="/consultas" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]">
        ← Voltar para {perfil === 'ADMIN' ? 'Consultas' : 'Minha agenda'}
      </Link>
      <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
        <Link href={`/alunos/${aluno.id}`} className="text-[#0A63C9] underline">
          {aluno.nome}
        </Link>
        {aluno.deFora ? (
          <span className="inline-block rounded-full bg-[#efe7fb] px-2.5 py-0.5 text-[11.5px] font-bold text-[#5b2fa0]">
            de fora
          </span>
        ) : (
          <span className="inline-block rounded-full bg-[#e6f0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0A63C9]">
            aluno
          </span>
        )}
      </p>
      <p className="mb-4 text-[13px] text-slate-500">
        {dataBR(dia)} às {consulta.hora} · {consulta.vinculo.profissional.nome}
        {consulta.situacao !== 'AGENDADO' && ` · ${ROTULO_SITUACAO_CONSULTA[consulta.situacao] ?? consulta.situacao}`}
      </p>
      {depois && <p className="-mt-3 mb-4 text-[12px] text-slate-500">{depois}</p>}

      {consulta.situacao === 'CANCELADO' ? (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
          Esta consulta foi desmarcada.
        </p>
      ) : podeEditar ? (
        <>
          <UltimasConsultas itens={ultimas} euId={usuarioId} />
          <FormularioConsulta
            atendimentoId={consulta.id}
            inicial={inicial}
            hojeISO={hojeISO}
            campos={camposDoRegistro(consulta.vinculo.profissional.tipoAgenda)}
            linkSugestoes={`/alunos/${aluno.id}?aba=sugestoes`}
          />
        </>
      ) : (
        <>
          {ehProfissionalDaConsulta && alemDoLimite && (
            <p role="status" className="mb-3 text-[12.5px] font-bold text-slate-600">
              {AVISO_LIMITE_LANCAR}
            </p>
          )}
          {registro ? (
            <VistaRegistro r={registro} />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Ainda sem registro.</p>
          )}
        </>
      )}
    </main>
  )
}
