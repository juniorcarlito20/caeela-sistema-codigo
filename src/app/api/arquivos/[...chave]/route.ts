import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerAluno } from '@/domain/permissoes'
import { podeVerRegistroClinico } from '@/domain/transferencia'
import { registrarAcesso } from '@/lib/registro'
import { lerArquivo } from '@/lib/storage'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chave: string[] }> },
) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para ver este arquivo.' }, { status: 401 })
  }

  const { chave } = await params
  const caminho = chave.join('/')

  // Assinatura: só o profissional dono do vínculo, a direção, ou quem recebeu
  // o aluno por transferência depois da assinatura.
  const assinatura = caminho.match(/^assinaturas\/(.+)\.png$/)
  if (assinatura) {
    const atendimento = await prisma.atendimento.findUnique({
      where: { id: assinatura[1] },
      include: { vinculo: true },
    })
    if (!atendimento) return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
    const dono =
      sessao.user.perfil === 'ADMIN' ||
      atendimento.vinculo.profissionalId === sessao.user.id
    if (!dono) {
      const transferencias = await prisma.transferencia.findMany({
        where: { alunoId: atendimento.vinculo.alunoId },
        select: { paraProfissionalId: true, criadoEm: true },
      })
      const pode = podeVerRegistroClinico(
        { id: sessao.user.id, perfil: sessao.user.perfil },
        {
          autorId: atendimento.vinculo.profissionalId,
          criadoEm: atendimento.assinadoEm ?? atendimento.data,
        },
        transferencias,
      )
      if (!pode) {
        return NextResponse.json({ erro: 'Este atendimento não é seu.' }, { status: 403 })
      }
    }
    return servir(caminho)
  }

  // Documento do aluno: só quem tem vínculo com ele ou a direção.
  const documento = caminho.match(/^alunos\/([^/]+)\//)
  if (documento) {
    const alunoId = documento[1]
    if (sessao.user.perfil !== 'ADMIN') {
      const vinculos = await prisma.vinculo.findMany({
        where: { alunoId },
        select: { profissionalId: true, fim: true },
      })
      if (!podeVerAluno({ id: sessao.user.id, perfil: sessao.user.perfil }, vinculos)) {
        return NextResponse.json({ erro: 'Este arquivo não é seu.' }, { status: 403 })
      }
    }
    const resposta = await servir(caminho)
    if (resposta.ok) {
      await registrarAcesso(sessao.user.id, 'ABRIU_DOCUMENTO', caminho)
    }
    return resposta
  }

  return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
}

async function servir(caminho: string): Promise<NextResponse> {
  const arquivo = await lerArquivo(caminho)
  if (!arquivo) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  }
  return new NextResponse(new Uint8Array(arquivo.corpo), {
    headers: {
      'Content-Type': arquivo.tipo,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
