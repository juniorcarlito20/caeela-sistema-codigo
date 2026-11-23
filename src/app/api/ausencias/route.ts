import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso, nomeDoUsuario } from '@/lib/registro'
import { validarEnvio } from '@/domain/documentos'
import { diasDaAusencia, ausenciaCancela } from '@/domain/ausencia'
import { enviarArquivo } from '@/lib/storage'
import { ehArquivo } from '@/lib/arquivoEnviado'

const TIPOS = ['FALTA', 'ATESTADO', 'LICENCA', 'FERIAS', 'CAPACITACAO', 'OUTRO'] as const

const esquema = z.object({
  profissionalId: z.string().min(1, 'Escolha o profissional.'),
  tipo: z.enum(TIPOS, { message: 'Escolha o tipo da ausência.' }),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Confira o início.'),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Confira o fim.'),
  justificativa: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim()
      return t === '' ? null : t
    }),
})

function diaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para registrar ausência.' }, { status: 401 })
  }

  let dados: FormData
  try {
    dados = await req.formData()
  } catch {
    return NextResponse.json({ erro: 'Envie os dados.' }, { status: 400 })
  }
  const validado = esquema.safeParse({
    profissionalId: dados.get('profissionalId'),
    tipo: dados.get('tipo'),
    inicio: dados.get('inicio'),
    fim: dados.get('fim'),
    justificativa: dados.get('justificativa'),
  })
  if (!validado.success) {
    return NextResponse.json(
      { erro: validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.' },
      { status: 400 },
    )
  }
  const { profissionalId, tipo, justificativa } = validado.data
  const inicio = new Date(`${validado.data.inicio}T12:00:00`)
  const fim = new Date(`${validado.data.fim}T12:00:00`)
  if (fim < inicio) {
    return NextResponse.json({ erro: 'O fim vem depois do início.' }, { status: 400 })
  }

  const profissional = await prisma.usuario.findFirst({
    where: { id: profissionalId, ativo: true },
  })
  if (!profissional) {
    return NextResponse.json(
      { erro: 'Profissional não encontrado ou inativo.' },
      { status: 400 },
    )
  }
  if (sessao.user.perfil !== 'ADMIN' && profissionalId !== sessao.user.id) {
    return NextResponse.json(
      { erro: 'Você só pode registrar a sua própria ausência.' },
      { status: 403 },
    )
  }

  const arquivo = dados.get('atestado')
  let atestado: { corpo: Buffer; tipo: string; nome: string } | null = null
  if (ehArquivo(arquivo) && arquivo.size > 0) {
    const problema = validarEnvio({ tamanhoBytes: arquivo.size, mime: arquivo.type })
    if (problema) {
      return NextResponse.json({ erro: problema }, { status: 400 })
    }
    atestado = {
      corpo: Buffer.from(await arquivo.arrayBuffer()),
      tipo: arquivo.type,
      nome: arquivo.name,
    }
  }

  const ausencia = await prisma.ausencia.create({
    data: {
      profissionalId,
      tipo,
      inicio,
      fim,
      justificativa,
      registradoPor: sessao.user.name ?? sessao.user.id,
    },
  })

  if (atestado) {
    const ext = atestado.tipo === 'application/pdf' ? 'pdf' : atestado.tipo === 'image/png' ? 'png' : 'jpg'
    const chave = `ausencias/${ausencia.id}.${ext}`
    await enviarArquivo(chave, atestado.corpo, atestado.tipo)
    await prisma.ausencia.update({ where: { id: ausencia.id }, data: { documentoChave: chave } })
  }

  // Cancela os atendimentos ainda agendados dos dias atingidos. O que já foi registrado não se mexe.
  // O filtro de data vai no banco (rede de segurança em JS contra fuso).
  const dias = new Set(diasDaAusencia(inicio, fim).map(diaISO))
  const diaMin = new Date(inicio)
  diaMin.setHours(0, 0, 0, 0)
  const diaMax = new Date(fim)
  diaMax.setHours(23, 59, 59, 999)
  const alvos = await prisma.atendimento.findMany({
    where: {
      vinculo: { profissionalId, fim: null },
      situacao: 'AGENDADO',
      data: { gte: diaMin, lte: diaMax },
    },
    select: { id: true, data: true, situacao: true },
  })
  let cancelados = 0
  for (const at of alvos) {
    if (!dias.has(diaISO(at.data))) continue
    if (!ausenciaCancela(at.situacao)) continue
    await prisma.atendimento.update({
      where: { id: at.id },
      data: {
        situacao: 'CANCELADO',
        observacao: `Profissional ausente: ${tipo}`,
        ausenciaId: ausencia.id,
      },
    })
    cancelados++
  }

  await registrarAcesso(
    sessao.user.id,
    'REGISTROU_AUSENCIA',
    `${await nomeDoUsuario(profissionalId)} (${tipo}, ${cancelados} atendimento(s) cancelado(s))`,
  )
  return NextResponse.json({ id: ausencia.id, cancelados }, { status: 201 })
}
