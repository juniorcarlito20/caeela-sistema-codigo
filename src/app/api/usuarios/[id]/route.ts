import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { motivoParaNaoTrocarPerfil, ROTULO_PERFIL } from '@/domain/acesso'
import { motivoParaNaoTrocarTipoAgenda, ROTULO_TIPO_AGENDA, TIPOS_AGENDA } from '@/domain/tipoAgenda'

const esquema = z.object({
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'O usuário precisa ter 3 caracteres ou mais.')
    .regex(/^[a-z0-9.-]+$/, 'O usuário só pode ter letras, números, ponto e traço.')
    .optional(),
  nome: z.string().trim().min(3, 'O nome precisa ter 3 letras ou mais.'),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
    .pipe(z.string().email('Digite um e-mail válido.').nullable()),
  telefone: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
  areaId: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
  perfil: z.enum(['ADMIN', 'PROFISSIONAL', 'SECRETARIA']).optional(),
  tipoAgenda: z.enum(TIPOS_AGENDA, { message: 'Escolha um tipo de agenda válido.' }).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção pode editar profissionais.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const usuario = await prisma.usuario.findUnique({ where: { id } })
  if (!usuario) {
    return NextResponse.json({ erro: 'Profissional não encontrado.' }, { status: 404 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const dados = validado.data

  if (dados.email) {
    const emUso = await prisma.usuario.findUnique({ where: { email: dados.email } })
    if (emUso && emUso.id !== id) {
      return NextResponse.json({ erro: 'Já existe alguém com esse e-mail.' }, { status: 400 })
    }
  }
  const trocouLogin = dados.usuario !== undefined && dados.usuario !== usuario.usuario
  if (trocouLogin) {
    const emUso = await prisma.usuario.findUnique({ where: { usuario: dados.usuario } })
    if (emUso && emUso.id !== id) {
      return NextResponse.json({ erro: 'Já existe alguém com esse usuário.' }, { status: 400 })
    }
  }
  if (dados.areaId && !(await prisma.area.findUnique({ where: { id: dados.areaId } }))) {
    return NextResponse.json({ erro: 'Área não encontrada.' }, { status: 400 })
  }

  const perfilFinal = dados.perfil ?? usuario.perfil
  if (dados.tipoAgenda) {
    const motivo = motivoParaNaoTrocarTipoAgenda(perfilFinal, dados.tipoAgenda)
    if (motivo) return NextResponse.json({ erro: motivo }, { status: 400 })
  }
  // Quem deixa de ser profissional volta para a agenda fixa; sem tipo no corpo, nada muda.
  const tipoAgendaNovo = perfilFinal !== 'PROFISSIONAL' ? 'FIXA' : (dados.tipoAgenda ?? usuario.tipoAgenda)

  if (dados.perfil && dados.perfil !== usuario.perfil) {
    const [alunosVigentes, contasDeDirecaoAtivas] = await Promise.all([
      prisma.vinculo.count({ where: { profissionalId: id, fim: null } }),
      prisma.usuario.count({ where: { perfil: 'ADMIN', ativo: true } }),
    ])
    const motivo = motivoParaNaoTrocarPerfil({
      quemEditaId: sessao.user.id,
      alvoId: id,
      perfilAtual: usuario.perfil,
      perfilNovo: dados.perfil,
      alunosVigentes,
      contasDeDirecaoAtivas,
    })
    if (motivo) return NextResponse.json({ erro: motivo }, { status: 400 })
  }

  await prisma.usuario.update({
    where: { id },
    data: {
      ...(trocouLogin ? { usuario: dados.usuario } : {}),
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      areaId: dados.areaId,
      perfil: dados.perfil,
      tipoAgenda: tipoAgendaNovo,
    },
  })
  await registrarAcesso(
    sessao.user.id,
    'EDITOU_PROFISSIONAL',
    trocouLogin
      ? `${dados.nome} (trocou o usuário de login de ${usuario.usuario} para ${dados.usuario})`
      : `${dados.nome} (nome, área, e-mail ou telefone)`,
  )
  if (tipoAgendaNovo !== usuario.tipoAgenda) {
    await registrarAcesso(
      sessao.user.id,
      'MUDOU_TIPO_AGENDA',
      `${usuario.nome}: ${ROTULO_TIPO_AGENDA[usuario.tipoAgenda]} → ${ROTULO_TIPO_AGENDA[tipoAgendaNovo]}`,
    )
  }
  if (dados.perfil && dados.perfil !== usuario.perfil) {
    await registrarAcesso(
      sessao.user.id,
      'TROCOU_PERFIL',
      `${usuario.nome}: ${ROTULO_PERFIL[usuario.perfil]} → ${ROTULO_PERFIL[dados.perfil]}`,
    )
  }
  return NextResponse.json({ ok: true })
}
