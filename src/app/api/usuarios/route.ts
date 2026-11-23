import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { ROTULO_PERFIL } from '@/domain/acesso'
import { motivoParaNaoTrocarTipoAgenda, ROTULO_TIPO_AGENDA, TIPOS_AGENDA } from '@/domain/tipoAgenda'

const esquema = z.object({
  nome: z.string().trim().min(3, 'O nome precisa ter 3 letras ou mais.'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'O usuário precisa ter 3 caracteres ou mais.')
    .regex(/^[a-z0-9.-]+$/, 'O usuário só pode ter letras, números, ponto e traço.'),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
    .pipe(z.string().email('Digite um e-mail válido.').nullable()),
  telefone: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
  senha: z.string().min(6, 'A senha provisória precisa ter 6 caracteres ou mais.'),
  perfil: z.enum(['ADMIN', 'PROFISSIONAL', 'SECRETARIA'], { message: 'Perfil inválido.' }),
  areaId: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
  areaNome: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
  // Como a agenda dele funciona (agenda fixa ou agenda própria, com ou sem lembrete).
  tipoAgenda: z.enum(TIPOS_AGENDA, { message: 'Escolha o tipo de agenda.' }).default('FIXA'),
})

export async function POST(req: Request) {
  const sessao = await auth()
  if (sessao?.user.perfil !== 'ADMIN') {
    return NextResponse.json(
      { erro: 'Só a direção pode criar acessos.' },
      { status: 403 },
    )
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados do profissional.' }, { status: 400 })
  }

  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const dados = validado.data
  const motivoTipo = motivoParaNaoTrocarTipoAgenda(dados.perfil, dados.tipoAgenda)
  if (motivoTipo) return NextResponse.json({ erro: motivoTipo }, { status: 400 })

  if (await prisma.usuario.findUnique({ where: { usuario: dados.usuario } })) {
    return NextResponse.json(
      { erro: 'Já existe alguém com esse usuário.' },
      { status: 400 },
    )
  }
  if (dados.email && (await prisma.usuario.findUnique({ where: { email: dados.email } }))) {
    return NextResponse.json(
      { erro: 'Já existe alguém com esse e-mail.' },
      { status: 400 },
    )
  }
  let areaId = dados.areaId
  if (dados.areaNome) {
    // Nem toda função do centro é uma área clínica da lista (coordenação,
    // motorista, cozinheira...) — deixa criar a área na hora, sem duplicar
    // se já existir uma com o mesmo nome (sem diferenciar maiúscula/minúscula).
    const existente = await prisma.area.findFirst({
      where: { nome: { equals: dados.areaNome, mode: 'insensitive' } },
    })
    areaId = existente ? existente.id : (await prisma.area.create({ data: { nome: dados.areaNome } })).id
  } else if (areaId && !(await prisma.area.findUnique({ where: { id: areaId } }))) {
    return NextResponse.json({ erro: 'Área não encontrada.' }, { status: 400 })
  }

  const criado = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      usuario: dados.usuario,
      email: dados.email,
      telefone: dados.telefone,
      senhaHash: await bcrypt.hash(dados.senha, 10),
      precisaTrocarSenha: true,
      perfil: dados.perfil,
      areaId,
      tipoAgenda: dados.tipoAgenda,
    },
  })
  const tipo = dados.tipoAgenda !== 'FIXA' ? `, ${ROTULO_TIPO_AGENDA[dados.tipoAgenda].toLowerCase()}` : ''
  await registrarAcesso(
    sessao.user.id,
    'CRIOU_ACESSO',
    `${criado.nome} (${criado.usuario}, ${ROTULO_PERFIL[criado.perfil].toLowerCase()}${tipo})`,
  )
  return NextResponse.json({ id: criado.id, usuario: criado.usuario }, { status: 201 })
}
