import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { podeVerAluno } from '@/domain/permissoes'
import { TIPOS_DOCUMENTO, validarDescricao, validarEnvio } from '@/domain/documentos'
import { chaveDeDocumento, enviarArquivo } from '@/lib/storage'
import { ehArquivo } from '@/lib/arquivoEnviado'

const esquema = z.object({
  alunoId: z.string().min(1, 'Aluno inválido.'),
  tipo: z.enum(TIPOS_DOCUMENTO, { message: 'Escolha o tipo do documento.' }),
  descricao: z.string().optional(),
})

async function podeVerDocumentos(
  perfil: string,
  usuarioId: string,
  alunoId: string,
): Promise<boolean> {
  if (perfil === 'ADMIN') return true
  const vinculos = await prisma.vinculo.findMany({
    where: { alunoId },
    select: { profissionalId: true, fim: true },
  })
  return podeVerAluno(
    { id: usuarioId, perfil: perfil as 'ADMIN' | 'PROFISSIONAL' },
    vinculos,
  )
}

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para enviar documentos.' }, { status: 401 })
  }

  let dados: FormData
  try {
    dados = await req.formData()
  } catch {
    return NextResponse.json({ erro: 'Envie o arquivo.' }, { status: 400 })
  }

  const validado = esquema.safeParse({
    alunoId: dados.get('alunoId'),
    tipo: dados.get('tipo'),
    descricao: dados.get('descricao') || undefined,
  })
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }

  const arquivo = dados.get('arquivo')
  if (!ehArquivo(arquivo) || arquivo.size === 0) {
    return NextResponse.json({ erro: 'Escolha o arquivo para enviar.' }, { status: 400 })
  }

  const problema = validarEnvio({ tamanhoBytes: arquivo.size, mime: arquivo.type })
  if (problema) {
    return NextResponse.json({ erro: problema }, { status: 400 })
  }

  const { alunoId, tipo, descricao } = validado.data
  if (descricao) {
    const problemaDescricao = validarDescricao(descricao)
    if (problemaDescricao) {
      return NextResponse.json({ erro: problemaDescricao }, { status: 400 })
    }
  }
  const aluno = await prisma.aluno.findFirst({
    where: { id: alunoId, excluidoEm: null },
  })
  if (!aluno) {
    return NextResponse.json({ erro: 'Aluno não encontrado.' }, { status: 404 })
  }
  if (!(await podeVerDocumentos(sessao.user.perfil, sessao.user.id, alunoId))) {
    return NextResponse.json(
      { erro: 'Você não tem acesso a este aluno.' },
      { status: 403 },
    )
  }

  const corpo = Buffer.from(await arquivo.arrayBuffer())
  const chave = await enviarArquivo(chaveDeDocumento(alunoId, arquivo.name), corpo, arquivo.type)
  const criado = await prisma.documento.create({
    data: {
      alunoId,
      tipo,
      chave,
      nomeArquivo: arquivo.name,
      descricao: descricao || null,
      enviadoPor: sessao.user.name ?? sessao.user.id,
    },
  })
  await registrarAcesso(sessao.user.id, 'ENVIOU_DOCUMENTO', `${aluno.nome} (${arquivo.name})`)
  return NextResponse.json({ id: criado.id }, { status: 201 })
}
