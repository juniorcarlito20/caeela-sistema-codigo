import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import { gerarMatriculaUnica, MENSAGEM_MATRICULA } from '@/domain/matricula'
import {
  diaValido,
  podeMarcarConsulta,
  PREFIXO_MATRICULA_EXTERNA,
  proximaMatriculaExterna,
  REGEX_DIA,
  REGEX_HORA,
  textoDaConsulta,
} from '@/domain/consultas'
import { AVISO_LIMITE_LANCAR, podeLancarNoDia } from '@/domain/presenca'
import { hojeNoFuso } from '@/lib/fuso'
import { consultaEmConflito, dataDaConsulta, gravarConsultaAvulsa } from '@/lib/consultas'
import { campoNascimento, campoNome, campoTextoOpcional } from '@/lib/esquemaAluno'

const esquema = z.object({
  profissionalId: z.string().min(1, 'Escolha o profissional.'),
  data: z.string().regex(REGEX_DIA, 'Informe o dia da consulta.'),
  hora: z.string().regex(REGEX_HORA, 'Informe a hora da consulta.'),
  alunoId: z.string().min(1).optional(),
  novaPessoa: z
    .object({
      nome: campoNome,
      nascimento: campoNascimento,
      whatsapp: campoTextoOpcional,
      responsavel: campoTextoOpcional,
      ligadoAoAluno: campoTextoOpcional,
      observacoes: campoTextoOpcional,
    })
    .optional(),
})

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status })
}

// Marca uma consulta avulsa (psiquiatra ou assistente social). A pessoa pode ser um aluno do
// centro ou alguém de fora, que é cadastrada aqui mesmo.
export async function POST(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) return erro('Entre no sistema para continuar.', 401)
  const { id: usuarioId, perfil } = sessao.user
  if (perfil !== 'ADMIN' && perfil !== 'PROFISSIONAL') {
    return erro('Seu acesso não permite marcar consultas.', 403)
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return erro('Envie os dados da consulta.', 400)
  }
  const validado = esquema.safeParse(corpo)
  if (!validado.success) {
    return erro(validado.error.issues[0]?.message ?? 'Confira os dados e tente de novo.', 400)
  }
  const dados = validado.data

  const profissional = await prisma.usuario.findFirst({
    where: { id: dados.profissionalId, perfil: 'PROFISSIONAL', ativo: true, excluidoEm: null },
    select: { id: true, nome: true, tipoAgenda: true, areaId: true },
  })
  if (!profissional) return erro('Profissional não encontrado.', 404)
  if (!podeMarcarConsulta({ id: usuarioId, perfil }, profissional)) {
    return erro('Você não pode marcar consulta para este profissional.', 403)
  }
  if (!profissional.areaId) return erro('Este profissional está sem área. Ajuste em Profissionais.', 400)

  if (!!dados.alunoId === !!dados.novaPessoa) {
    return erro('Escolha uma pessoa já cadastrada ou cadastre uma pessoa de fora.', 400)
  }
  if (!diaValido(dados.data)) return erro('Informe o dia da consulta.', 400)
  if (!podeLancarNoDia(perfil, dados.data, hojeNoFuso())) return erro(AVISO_LIMITE_LANCAR, 400)

  const data = dataDaConsulta(dados.data)

  // Pessoa que já existe: confere antes de qualquer gravação.
  let alunoExistente: { id: string; nome: string; situacao: string; deFora: boolean } | null = null
  if (dados.alunoId) {
    alunoExistente = await prisma.aluno.findFirst({
      where: { id: dados.alunoId, excluidoEm: null },
      select: { id: true, nome: true, situacao: true, deFora: true },
    })
    if (!alunoExistente) return erro('Pessoa não encontrada.', 404)
    // Aluno do centro desligado não volta por aqui. A pessoa de fora pode voltar para novo retorno.
    if (alunoExistente.situacao === 'DESLIGADO' && !alunoExistente.deFora) {
      return erro('Este aluno está desligado.', 400)
    }
  }

  // Uma consulta por dia e hora para o profissional (cancelada não conta).
  if (await consultaEmConflito(prisma, profissional.id, data, dados.hora)) {
    return erro('Já existe consulta nesse dia e horário.', 409)
  }

  try {
    let alunoId: string
    let nomePessoa: string
    if (alunoExistente) {
      alunoId = alunoExistente.id
      nomePessoa = alunoExistente.nome
      if (alunoExistente.deFora && alunoExistente.situacao !== 'ATENDIMENTO') {
        await prisma.aluno.update({
          where: { id: alunoId },
          data: { situacao: 'ATENDIMENTO', situacaoDesde: new Date(), pausaRetomarEm: null },
        })
      }
    } else {
      const nova = dados.novaPessoa!
      const ano = new Date().getFullYear()
      const buscarUltima = async () =>
        (
          await prisma.aluno.findFirst({
            where: { matricula: { startsWith: `${PREFIXO_MATRICULA_EXTERNA}${ano}-` } },
            orderBy: { matricula: 'desc' },
            select: { matricula: true },
          })
        )?.matricula
      const criada = await gerarMatriculaUnica(
        ano,
        buscarUltima,
        (matricula) =>
          prisma.aluno.create({
            data: {
              nome: nova.nome,
              nascimento: nova.nascimento,
              whatsapp: nova.whatsapp,
              responsavel: nova.responsavel,
              ligadoAoAluno: nova.ligadoAoAluno,
              observacoes: nova.observacoes,
              matricula,
              deFora: true,
              situacao: 'ATENDIMENTO',
            },
          }),
        5,
        proximaMatriculaExterna,
      )
      alunoId = criada.id
      nomePessoa = criada.nome
      await registrarAcesso(usuarioId, 'CADASTROU_PESSOA_DE_FORA', criada.nome)
    }

    // Vínculo aberto com o profissional, sem horários fixos.
    let vinculo = await prisma.vinculo.findFirst({
      where: { alunoId, profissionalId: profissional.id, fim: null },
      select: { id: true },
    })
    if (!vinculo) {
      vinculo = await prisma.vinculo.create({
        data: { alunoId, profissionalId: profissional.id, areaId: profissional.areaId },
        select: { id: true },
      })
    }

    const atendimento = await gravarConsultaAvulsa(prisma, vinculo.id, data, dados.hora)

    await registrarAcesso(
      usuarioId,
      'MARCOU_CONSULTA',
      textoDaConsulta(nomePessoa, profissional.nome, dados.data, dados.hora),
    )
    return NextResponse.json({ id: atendimento.id, alunoId }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === MENSAGEM_MATRICULA) return erro(MENSAGEM_MATRICULA, 500)
    if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') {
      return erro('Já existe consulta nesse dia e horário.', 409)
    }
    throw e
  }
}
