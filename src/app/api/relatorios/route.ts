import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerAluno } from '@/domain/permissoes'
import { podeVerRegistroClinico } from '@/domain/transferencia'
import { montarAnexoAnamnese, type AnexoAnamnese } from '@/domain/anexoAnamnese'
import type { Campo } from '@/domain/anamnese'
import { dadosParaRelatorio, vinculoParaRelatorio } from '@/lib/relatorios'
import { carregarLogos } from '@/lib/pdf/timbre'
import { gerarRelatorioPDF, codigoVerificacao, type TipoRelatorioPDF } from '@/lib/pdf/relatorio'
import { enviarArquivo } from '@/lib/storage'
import { registrarAcesso } from '@/lib/registro'

const esquema = z.object({
  alunoId: z.string().min(1, 'Aluno inválido.'),
  tipo: z.enum(['ACOMPANHAMENTO', 'PAUSA', 'ALTA'], { message: 'Escolha o tipo do relatório.' }),
  texto: z.string().trim().min(1, 'Escreva o texto do relatório.'),
  inicio: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null)),
  fim: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null)),
  // Anamneses que vão como anexo do PDF (opcional).
  anamneseIds: z.array(z.string().min(1)).max(5, 'Escolha até 5 anamneses.').optional().default([]),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para emitir relatórios.' }, { status: 401 })
  }
  const eAdmin = sessao.user.perfil === 'ADMIN'

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados do relatório.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const { alunoId, tipo, texto, inicio, fim, anamneseIds } = validado.data

  const aluno = await prisma.aluno.findFirst({
    where: { id: alunoId, excluidoEm: null },
  })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }
  if (!eAdmin) {
    const vinculos = await prisma.vinculo.findMany({
      where: { alunoId },
      select: { profissionalId: true, fim: true },
    })
    if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
      return NextResponse.json(
        { erro: 'Você não tem vínculo com este aluno.' },
        { status: 403 },
      )
    }
  }

  const vinculo = await vinculoParaRelatorio(alunoId, sessao.user.id, eAdmin)
  if (!vinculo) {
    return NextResponse.json(
      { erro: 'O aluno precisa de um vínculo para emitir relatório.' },
      { status: 400 },
    )
  }

  // Anamneses anexadas: só as deste aluno que o autor já pode ver (a própria, ou todas para a direção).
  const anexos: AnexoAnamnese[] = []
  const idsUnicos = [...new Set(anamneseIds)]
  if (idsUnicos.length > 0) {
    const encontradas = await prisma.anamnese.findMany({
      where: { id: { in: idsUnicos }, alunoId },
      include: { modelo: { select: { nome: true, campos: true } }, autor: { select: { nome: true } } },
    })
    if (encontradas.length !== idsUnicos.length) {
      return NextResponse.json({ erro: 'Anamnese não encontrada para este aluno.' }, { status: 404 })
    }
    const transferencias = await prisma.transferencia.findMany({
      where: { alunoId },
      select: { paraProfissionalId: true, criadoEm: true },
    })
    for (const id of idsUnicos) {
      const a = encontradas.find((x) => x.id === id)!
      const pode = podeVerRegistroClinico(
        { id: sessao.user.id, perfil: sessao.user.perfil },
        { autorId: a.autorId, criadoEm: a.criadoEm },
        transferencias,
      )
      if (!pode) {
        return NextResponse.json(
          { erro: 'Você não pode anexar a anamnese de outro profissional.' },
          { status: 403 },
        )
      }
      anexos.push(
        montarAnexoAnamnese(
          { nome: a.modelo.nome, campos: a.modelo.campos as unknown as Campo[] },
          (a.respostas ?? {}) as Record<string, unknown>,
          a.autor.nome,
          a.criadoEm,
        ),
      )
    }
  }
  const comAnamnese = anexos.length > 0

  const dados = await dadosParaRelatorio(alunoId, vinculo.id, inicio, fim)
  const criado = await prisma.relatorio.create({
    data: { alunoId, autorId: sessao.user.id, tipo, texto, comAnamnese },
  })

  const codigo = codigoVerificacao(criado.id)
  const geradoEm = new Date()
  const pdf = await gerarRelatorioPDF({
    aluno: aluno.nome,
    matricula: aluno.matricula,
    periodo: dados.periodo,
    area: dados.area,
    profissional: dados.profissional,
    tipo: tipo as TipoRelatorioPDF,
    resumo: dados.resumo,
    texto,
    codigo,
    geradoEm,
    logos: await carregarLogos(),
    anexos,
  })
  const chave = `relatorios/${criado.id}.pdf`
  await enviarArquivo(chave, pdf, 'application/pdf')
  await prisma.relatorio.update({ where: { id: criado.id }, data: { pdfChave: chave } })
  // A pasta Documentos do aluno é visível a todos os profissionais que o atendem. A anamnese de
  // um profissional não é: por isso o relatório COM anamnese não vira Documento e fica só em
  // "Relatórios emitidos", onde vale a regra de quem escreveu / direção / quem recebeu o aluno.
  if (!comAnamnese) {
    // O documento aponta para a mesma chave: sem duplicar o arquivo.
    await prisma.documento.create({
      data: {
        alunoId,
        tipo: 'RELATORIO_CENTRO',
        chave,
        nomeArquivo: `relatorio-${tipo.toLowerCase()}-${geradoEm.toISOString().slice(0, 10)}.pdf`,
        enviadoPor: sessao.user.name ?? sessao.user.id,
      },
    })
  }
  await registrarAcesso(
    sessao.user.id,
    'GEROU_RELATORIO',
    `relatorio:${criado.id}${comAnamnese ? ` · com anamnese (${anexos.length})` : ''}`,
  )
  return NextResponse.json({ id: criado.id }, { status: 201 })
}
