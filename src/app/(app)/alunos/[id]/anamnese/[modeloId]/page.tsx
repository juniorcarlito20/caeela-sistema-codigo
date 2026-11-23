import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerAluno } from '@/domain/permissoes'
import { podeVerRegistroClinico } from '@/domain/transferencia'
import { agruparPorSecao, imcDoCampo, type Campo } from '@/domain/anamnese'
import { registrarAcesso } from '@/lib/registro'
import Cabecalho from '@/components/Cabecalho'
import FormularioAnamnese from '@/components/FormularioAnamnese'
import ResumoEscala from '@/components/ResumoEscala'
import QuadroResultadoEscala from '@/components/QuadroResultadoEscala'

function telaErro(mensagem: string) {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-10 text-center text-[#16243b]">
      <p className="font-bold">{mensagem}</p>
      <Link href="/agenda" className="mt-2 inline-block font-bold text-[#0A63C9]">
        ← Voltar para a agenda
      </Link>
    </main>
  )
}

export default async function PaginaAnamneseAluno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; modeloId: string }>
  searchParams: Promise<{ a?: string; ver?: string; nova?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')

  const { id, modeloId } = await params
  const { a, ver, nova } = await searchParams
  const eAdmin = sessao.user.perfil === 'ADMIN'

  const aluno = await prisma.aluno.findFirst({
    where: { id, excluidoEm: null },
  })
  if (!aluno) notFound()
  const modelo = await prisma.modeloAnamnese.findUnique({ where: { id: modeloId } })
  if (!modelo || !modelo.ativo) notFound()

  if (!eAdmin) {
    const vinculos = await prisma.vinculo.findMany({
      where: { alunoId: id },
      select: { profissionalId: true, fim: true },
    })
    if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
      redirect('/agenda')
    }
  }

  const campos = modelo.campos as unknown as Campo[]
  let anamnese: {
    id: string
    autorId: string
    respostas: Record<string, string>
    criadoEm: Date
    autor: { nome: string }
  } | null = null

  if (a) {
    const encontrada = await prisma.anamnese.findUnique({
      where: { id: a },
      include: { autor: { select: { nome: true } } },
    })
    if (!encontrada || encontrada.alunoId !== id || encontrada.modeloId !== modeloId) {
      notFound()
    }
    const transferencias = await prisma.transferencia.findMany({
      where: { alunoId: id },
      select: { paraProfissionalId: true, criadoEm: true },
    })
    if (
      !podeVerRegistroClinico(
        { id: sessao.user.id, perfil: sessao.user.perfil },
        { autorId: encontrada.autorId, criadoEm: encontrada.criadoEm },
        transferencias,
      )
    ) {
      return telaErro('Esta anamnese não é sua.')
    }
    anamnese = {
      id: encontrada.id,
      autorId: encontrada.autorId,
      respostas: (encontrada.respostas ?? {}) as Record<string, string>,
      criadoEm: encontrada.criadoEm,
      autor: encontrada.autor,
    }
  } else if (nova === '1') {
    // Nova aplicação (escalas que se repetem): começa em branco, sem carregar a anterior.
  } else if (!eAdmin) {
    const minha = await prisma.anamnese.findFirst({
      where: { alunoId: id, modeloId, autorId: sessao.user.id },
      orderBy: { criadoEm: 'desc' },
      include: { autor: { select: { nome: true } } },
    })
    if (minha) {
      anamnese = {
        id: minha.id,
        autorId: minha.autorId,
        respostas: (minha.respostas ?? {}) as Record<string, string>,
        criadoEm: minha.criadoEm,
        autor: minha.autor,
      }
    }
  } else {
    const ultima = await prisma.anamnese.findFirst({
      where: { alunoId: id, modeloId },
      orderBy: { criadoEm: 'desc' },
      include: { autor: { select: { nome: true } } },
    })
    if (ultima) {
      anamnese = {
        id: ultima.id,
        autorId: ultima.autorId,
        respostas: (ultima.respostas ?? {}) as Record<string, string>,
        criadoEm: ultima.criadoEm,
        autor: ultima.autor,
      }
    }
  }

  const somenteLeitura =
    ver === '1' || (!!anamnese?.id && anamnese.autorId !== sessao.user.id)

  // Registro de acesso: a direção lendo anamnese escrita por outro profissional.
  if (anamnese && sessao.user.perfil === 'ADMIN' && anamnese.autorId !== sessao.user.id) {
    await registrarAcesso(sessao.user.id, 'ABRIU_ANAMNESE', `anamnese:${anamnese.id}`)
  }
  const menu = eAdmin ? ('admin' as const) : ('profissional' as const)

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho
        nome={sessao.user.name ?? ''}
        detalhe={eAdmin ? 'Direção' : 'Profissional'}
        itemAtivo="Alunos"
        menu={menu}
      />
      <main className="mx-auto w-full max-w-[720px] px-4 py-5">
        <Link
          href={`/alunos/${aluno.id}?aba=anamnese`}
          className="mb-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0A63C9]"
        >
          ← Voltar para a ficha
        </Link>
        <h1 className="text-xl font-extrabold">
          {modelo.nome} · {aluno.nome}
        </h1>
        <p className="mb-4 text-[13px] text-slate-500">
          {anamnese
            ? `Preenchida por ${anamnese.autor.nome} em ${anamnese.criadoEm.toLocaleDateString('pt-BR')}`
            : 'Nova anamnese — nada é obrigatório, salve o rascunho quando precisar'}
        </p>
        {somenteLeitura && anamnese ? (
          <VerAnamnese campos={campos} respostas={anamnese.respostas} />
        ) : somenteLeitura ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhuma anamnese deste modelo para este aluno.
          </p>
        ) : (
          <FormularioAnamnese
            alunoId={aluno.id}
            modeloId={modelo.id}
            modeloNome={modelo.nome}
            campos={campos}
            anamneseInicial={anamnese?.id ?? null}
            respostasIniciais={anamnese?.respostas ?? {}}
          />
        )}
      </main>
    </div>
  )
}

function VerAnamnese({
  campos,
  respostas,
}: {
  campos: Campo[]
  respostas: Record<string, string>
}) {
  const secoes = agruparPorSecao(campos)
    .map((s) => ({
      secao: s.secao,
      campos: s.campos.filter((c) => c.tipo !== 'aviso' && c.tipo !== 'resumo' && c.tipo !== 'imc' && (respostas[c.id] ?? '').trim() !== ''),
      resumo: s.campos.find((c) => c.tipo === 'resumo') ?? null,
      // IMC calculado do peso e da altura respondidos (só entra se deu resultado).
      imcs: s.campos.flatMap((c) => {
        const imc = c.tipo === 'imc' ? imcDoCampo(c, respostas) : null
        return imc ? [{ id: c.id, rotulo: c.rotulo, texto: imc.texto, nota: c.nota }] : []
      }),
    }))
    .filter((s) => s.campos.length > 0)
  if (secoes.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Nenhuma resposta preenchida.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <QuadroResultadoEscala campos={campos} respostas={respostas} />
      {secoes.map((s) => (
        <section key={s.secao} className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[15px] font-extrabold">{s.secao}</h2>
          <dl className="flex flex-col gap-2">
            {s.campos.map((c) => (
              <div key={c.id} className="grid gap-1 border-b border-slate-100 py-1.5 text-sm md:grid-cols-[220px_1fr]">
                <dt className="font-bold text-slate-500">{c.rotulo}</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{respostas[c.id]}</dd>
              </div>
            ))}
            {s.imcs.map((i) => (
              <div key={i.id} className="grid gap-1 border-b border-slate-100 py-1.5 text-sm md:grid-cols-[220px_1fr]">
                <dt className="font-bold text-slate-500">{i.rotulo}</dt>
                <dd className="text-slate-800">
                  <strong>{i.texto}</strong>
                  {i.nota && <span className="mt-0.5 block text-[11.5px] text-slate-500">{i.nota}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {s.resumo && (
            <div className="mt-3">
              <ResumoEscala campos={campos} respostas={respostas} campo={s.resumo} />
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
