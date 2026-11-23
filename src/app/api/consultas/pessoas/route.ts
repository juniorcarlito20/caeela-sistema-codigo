import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { idsPorNomeAproximado, normalizarBusca } from '@/lib/busca'
import { podeVerConsultas } from '@/domain/consultas'

// Busca de pessoas para a tela Consultas. Devolve só o necessário para escolher
// (nome, matrícula e se é de fora): nada clínico.
//   modo=centro        alunos do centro (não excluídos, não desligados)
//   modo=fora          pessoas de fora já cadastradas
//   modo=acompanhados  quem tem vínculo aberto com profissional de agenda avulsa
//                      (o profissional só vê as pessoas dele)
export async function GET(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) return NextResponse.json({ erro: 'Entre no sistema para continuar.' }, { status: 401 })
  const { id: usuarioId, perfil } = sessao.user

  let tipoAgenda: string | null = null
  if (perfil === 'PROFISSIONAL') {
    const eu = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { tipoAgenda: true } })
    tipoAgenda = eu?.tipoAgenda ?? null
  }
  if (!podeVerConsultas(perfil, tipoAgenda)) {
    return NextResponse.json({ erro: 'Seu acesso não permite isso.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const modo = url.searchParams.get('modo')
  if (modo !== 'centro' && modo !== 'fora' && modo !== 'acompanhados') {
    return NextResponse.json({ erro: 'Escolha o tipo de busca.' }, { status: 400 })
  }
  const busca = (url.searchParams.get('q') ?? '').trim()
  const termo = normalizarBusca(busca)
  const digitos = busca.replace(/\D/g, '')

  const filtros: Prisma.AlunoWhereInput[] = [{ excluidoEm: null }]
  if (modo === 'centro') filtros.push({ deFora: false, situacao: { not: 'DESLIGADO' } })
  if (modo === 'fora') filtros.push({ deFora: true })
  if (modo === 'acompanhados') {
    filtros.push({
      vinculos: {
        some: {
          fim: null,
          profissional: {
            ativo: true,
            excluidoEm: null,
            tipoAgenda: { not: 'FIXA' },
            ...(perfil === 'PROFISSIONAL' ? { id: usuarioId } : {}),
          },
        },
      },
    })
  }
  if (busca !== '') {
    const idsNome = await idsPorNomeAproximado('Aluno', busca)
    filtros.push({
      OR: [
        idsNome ? { id: { in: idsNome } } : { nome: { contains: busca, mode: 'insensitive' } },
        { matricula: { contains: busca, mode: 'insensitive' } },
        ...(digitos.length >= 3 ? [{ whatsapp: { contains: digitos } }] : []),
      ],
    })
  }

  const candidatos = await prisma.aluno.findMany({
    where: { AND: filtros },
    select: { id: true, nome: true, matricula: true, deFora: true, whatsapp: true },
    orderBy: { nome: 'asc' },
    take: 60,
  })

  const pessoas = candidatos
    .filter(
      (a) =>
        termo === '' ||
        normalizarBusca(a.nome).includes(termo) ||
        normalizarBusca(a.matricula).includes(termo) ||
        (digitos.length >= 3 && (a.whatsapp ?? '').replace(/\D/g, '').includes(digitos)),
    )
    .slice(0, 20)
    .map((a) => ({ id: a.id, nome: a.nome, matricula: a.matricula, deFora: a.deFora }))

  return NextResponse.json({ pessoas })
}
