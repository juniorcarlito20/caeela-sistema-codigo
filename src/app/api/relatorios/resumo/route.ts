import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { podeVerAluno } from '@/domain/permissoes'
import { dadosParaRelatorio, vinculoParaRelatorio } from '@/lib/relatorios'

export async function GET(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para ver os números.' }, { status: 401 })
  }
  const eAdmin = sessao.user.perfil === 'ADMIN'

  const url = new URL(req.url)
  const alunoId = url.searchParams.get('alunoId') ?? ''
  const inicio = url.searchParams.get('inicio')
  const fim = url.searchParams.get('fim')
  if (!alunoId) {
    return NextResponse.json({ erro: 'Informe o aluno.' }, { status: 400 })
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
  const dados = await dadosParaRelatorio(alunoId, vinculo.id, inicio, fim)
  return NextResponse.json(dados)
}
