import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import {
  diaIso,
  camposDoRegistro,
  diaMes,
  ENCAMINHAMENTOS,
  LIMITE_REGISTRO_CONSULTA,
  podeRegistrarConsulta,
  REGEX_DIA,
  REGEX_HORA,
  retornoParaCampos,
  retornoParaData,
  TIPOS_CONSULTA,
} from '@/domain/consultas'
import { AVISO_LIMITE_LANCAR, podeLancarNoDia } from '@/domain/presenca'
import { consultaEmConflito, dataDaConsulta, gravarConsultaAvulsa } from '@/lib/consultas'
import { hojeNoFuso } from '@/lib/fuso'

const textoOpcional = (max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .max(max, mensagem)
    .nullable()
    .optional()
    .transform((v) => (v && v !== '' ? v : null))

const esquema = z
  .object({
    situacao: z.enum(['REALIZADO', 'FALTOU'], { message: 'Diga se a consulta aconteceu.' }),
    tipo: z.enum(TIPOS_CONSULTA, { message: 'Escolha o tipo da consulta.' }),
    presentes: textoOpcional(300, 'Quem estava presente: use até 300 letras.'),
    registro: z
      .string()
      .trim()
      .max(LIMITE_REGISTRO_CONSULTA, 'O registro passou de 100.000 caracteres. Divida em duas partes.')
      .default(''),
    encaminhamentos: z.array(z.enum(ENCAMINHAMENTOS)).default([]),
    proximoPasso: textoOpcional(1000, 'Próximo passo: use até 1.000 letras.'),
    retornoData: z.string().regex(REGEX_DIA, 'Confira a data do retorno.').nullable().optional(),
    retornoHora: z.string().regex(REGEX_HORA, 'Confira a hora do retorno.').nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.situacao === 'REALIZADO' && v.registro === '') {
      ctx.addIssue({ code: 'custom', path: ['registro'], message: 'Escreva o registro da consulta.' })
    }
    if (v.retornoData && !v.retornoHora) {
      ctx.addIssue({ code: 'custom', path: ['retornoHora'], message: 'Informe a hora do retorno.' })
    }
    if (v.retornoHora && !v.retornoData) {
      ctx.addIssue({ code: 'custom', path: ['retornoData'], message: 'Informe a data do retorno.' })
    }
  })

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status })
}

class ConflitoRetorno extends Error {}

// Cria ou edita o registro de uma consulta avulsa. Só o profissional da consulta grava.
// O texto do registro nunca vai para o Histórico: lá só entram quem e sobre quem.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth()
  if (!sessao?.user) return erro('Entre no sistema para continuar.', 401)
  const { id: usuarioId, perfil } = sessao.user
  if (perfil !== 'PROFISSIONAL') return erro('Só o profissional da consulta pode registrá-la.', 403)

  const { id } = await params
  const consulta = await prisma.atendimento.findFirst({
    where: { id, avulso: true },
    select: {
      id: true,
      data: true,
      hora: true,
      situacao: true,
      confirmadoEm: true,
      vinculoId: true,
      registroConsulta: { select: { id: true, retornoEm: true } },
      vinculo: {
        select: {
          profissionalId: true,
          profissional: { select: { nome: true, tipoAgenda: true } },
          aluno: { select: { nome: true } },
        },
      },
    },
  })
  if (!consulta) return erro('Consulta não encontrada.', 404)
  if (!podeRegistrarConsulta({ id: usuarioId, perfil }, consulta.vinculo.profissionalId)) {
    return erro('Só o profissional da consulta pode registrá-la.', 403)
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return erro('Envie os dados do registro.', 400)
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return erro(validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.', 400)
  }
  const dados = validado.data
  // Cada profissional só grava o que o formulário dele oferece (o psiquiatra não encaminha à rede).
  const permitido = camposDoRegistro(consulta.vinculo.profissional.tipoAgenda)
  if (!permitido.tipos.includes(dados.tipo)) return erro('Escolha o tipo da consulta.', 400)
  if (!permitido.encaminhamentos) dados.encaminhamentos = []

  const dia = diaIso(consulta.data)
  if (!podeLancarNoDia(perfil, dia, hojeNoFuso())) return erro(AVISO_LIMITE_LANCAR, 403)
  if (!['AGENDADO', 'REALIZADO', 'FALTOU'].includes(consulta.situacao)) {
    return erro('Esta consulta foi desmarcada. Não dá para registrá-la.', 409)
  }

  // Retorno: cria a próxima consulta só na primeira vez ou quando dia/hora mudaram.
  const retornoNovo = dados.retornoData && dados.retornoHora ? retornoParaData(dados.retornoData, dados.retornoHora) : null
  const retornoAntigo = consulta.registroConsulta?.retornoEm ?? null
  const retornoMudou = (retornoNovo?.getTime() ?? null) !== (retornoAntigo?.getTime() ?? null)
  if (retornoNovo && retornoMudou && dados.retornoData! <= hojeNoFuso()) {
    return erro('A data do retorno precisa ser depois de hoje.', 400)
  }

  const campos = {
    tipo: dados.tipo,
    presentes: dados.presentes,
    registro: dados.registro,
    encaminhamentos: dados.encaminhamentos,
    proximoPasso: dados.proximoPasso,
    retornoEm: retornoNovo,
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.atendimento.update({
        where: { id },
        data: {
          situacao: dados.situacao,
          confirmadoEm: consulta.confirmadoEm ?? new Date(),
          registradoPorId: usuarioId,
        },
      })
      await tx.registroConsulta.upsert({
        where: { atendimentoId: id },
        create: { atendimentoId: id, autorId: usuarioId, ...campos },
        update: campos,
      })
      if (retornoMudou) {
        // O retorno anterior, se ainda estava só marcado, sai da agenda para não ficar em duplicidade.
        const antigo = retornoParaCampos(retornoAntigo)
        if (antigo) {
          await tx.atendimento.updateMany({
            where: {
              vinculoId: consulta.vinculoId,
              data: dataDaConsulta(antigo.dia),
              hora: antigo.hora,
              avulso: true,
              situacao: 'AGENDADO',
              registroConsulta: { is: null },
            },
            data: { situacao: 'CANCELADO', observacao: 'Retorno alterado' },
          })
        }
        if (dados.retornoData && dados.retornoHora) {
          const data = dataDaConsulta(dados.retornoData)
          if (await consultaEmConflito(tx, consulta.vinculo.profissionalId, data, dados.retornoHora)) {
            throw new ConflitoRetorno()
          }
          await gravarConsultaAvulsa(tx, consulta.vinculoId, data, dados.retornoHora)
        }
      }
    })
  } catch (e) {
    if (e instanceof ConflitoRetorno) {
      return erro('Já existe consulta no dia e horário do retorno. Escolha outro horário.', 409)
    }
    if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') {
      return erro('Já existe consulta no dia e horário do retorno. Escolha outro horário.', 409)
    }
    throw e
  }

  await registrarAcesso(
    usuarioId,
    'REGISTROU_CONSULTA',
    `${consulta.vinculo.aluno.nome} com ${consulta.vinculo.profissional.nome} em ${diaMes(dia)}`,
  )
  return NextResponse.json({ ok: true })
}
