import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import mammoth from 'mammoth'
import { parse } from 'node-html-parser'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  interpretarCabecalho,
  interpretarContextoConsulta,
  interpretarContinuacaoDeGrupo,
  normalizarHora,
  normalizarCPF,
  normalizarNome,
  type CabecalhoTabela,
  type LinhaAgenda,
} from '@/domain/importacao'
import { detectarConflito, type Ocupacao } from '@/domain/conflitos'
import { proximaMatricula } from '@/domain/matricula'
import { expandirSemanas, semanaEmMonday } from '@/domain/semanas'
import { semanasDoHorarioAntigo } from '@/domain/migracaoSemanas'

type Banco = PrismaClient

export type ResultadoImportacao = {
  profCriados: string[]
  profExistiam: string[]
  alunosCriados: { nome: string; matricula: string }[]
  alunosExistiam: string[]
  alunosSemCpf: string[]
  horariosCriados: number
  vagas: number
  ignoradas: string[]
}

// Extrai as linhas de todas as tabelas do HTML. Nunca joga exceção por causa
// de linha feia: ignora a linha, anota o motivo e segue. Linha com horário e
// sem aluno é horário vago (conta à parte, não é erro).
export function extrairLinhas(html: string): {
  linhas: LinhaAgenda[]
  ignoradas: string[]
  vagas: number
} {
  const linhas: LinhaAgenda[] = []
  const ignoradas: string[] = []
  let vagas = 0
  const raiz = parse(html)
  const nos = raiz.querySelectorAll('p, table')
  let ultimoP = ''
  // Último cabeçalho COMPLETO (com dia) reconhecido: sub-tabelas de rotação
  // com título só "GRUPO N" herdam dia, profissional e área dele. Só muda aqui,
  // nunca numa continuação — para um erro não encadear no seguinte.
  let ultimoCab: CabecalhoTabela | null = null
  // Parágrafos de nível de página desde a última tabela (os de dentro de células
  // ficam de fora): servem ao formato "CONSULTA COM A ..." das últimas páginas.
  let ctxPagina: string[] = []
  const daConsulta = new Set<LinhaAgenda>()
  for (const no of nos) {
    if (no.tagName === 'P') {
      const texto = no.text.trim()
      if (texto) ultimoP = texto
      if (texto && !no.closest('table')) {
        if (/^CONSULTA COM/i.test(texto)) ctxPagina = [texto]
        else ctxPagina.push(texto)
      }
      continue
    }
    const ctx = ctxPagina
    ctxPagina = []
    // Título da tabela: primeiro o parágrafo logo antes dela (formato novo);
    // se não for um cabeçalho válido, a própria primeira linha da tabela
    // (formato antigo, título dentro da tabela em célula mesclada).
    const paragrafoAntes = ultimoP
    ultimoP = '' // zera sempre: texto solto de páginas atrás não pode vazar como título
    if (/NOME DO PROFISSIONAL/i.test(paragrafoAntes)) {
      ignoradas.push('tabela de modelo em branco, ignorada')
      continue
    }
    const trsTodas = no.querySelectorAll('tr')
    let cab = interpretarContextoConsulta(ctx)
    const formatoConsulta = cab !== null
    if (!cab) cab = interpretarCabecalho(paragrafoAntes)
    let trs = trsTodas
    let origemTitulo = paragrafoAntes
    if (!cab && trsTodas.length > 0) {
      const tituloNaTabela = trsTodas[0].text.trim()
      if (/NOME DO PROFISSIONAL/i.test(tituloNaTabela)) {
        ignoradas.push('tabela de modelo em branco, ignorada')
        continue
      }
      cab = interpretarCabecalho(tituloNaTabela)
      if (cab) {
        trs = trsTodas.slice(1) // a primeira linha era o título, já consumida
        origemTitulo = tituloNaTabela
      }
    }
    if (cab) {
      ultimoCab = cab // título completo: vira base para eventual continuação
    } else if (ultimoCab) {
      // Sub-tabela de rotação ("GRUPO 2", sem dia): continua a última tabela
      // completa. Vale no parágrafo antes ou na primeira linha da tabela.
      const grupoDoParagrafo = interpretarContinuacaoDeGrupo(paragrafoAntes)
      if (grupoDoParagrafo) {
        cab = { ...ultimoCab, grupo: grupoDoParagrafo }
        origemTitulo = paragrafoAntes
      } else if (trsTodas.length > 0) {
        const tituloNaTabela = trsTodas[0].text.trim()
        const grupoNaTabela = interpretarContinuacaoDeGrupo(tituloNaTabela)
        if (grupoNaTabela) {
          cab = { ...ultimoCab, grupo: grupoNaTabela }
          trs = trsTodas.slice(1)
          origemTitulo = tituloNaTabela
        }
      }
    }
    if (!cab) {
      ignoradas.push(`tabela ignorada: cabeçalho não reconhecido ("${origemTitulo.slice(0, 60)}")`)
      continue
    }
    const comeco = trs.length > 0 && /hor[aá]rio|aluno|matutino|vespertino/i.test(trs[0].text) ? 1 : 0
    for (const tr of trs.slice(comeco)) {
      const cels = tr.querySelectorAll('td, th').map((c) => c.text.trim())
      if (cels.every((c) => c === '')) continue
      if (cels.length < 3) {
        ignoradas.push(`[${cab.profissional}] linha incompleta ignorada`)
        continue
      }
      const aluno = (cels[2] ?? '').replace(/\s+/g, ' ').trim()
      const hora = normalizarHora(cels[1] ?? '')
      if (!aluno && !hora) continue // linha em branco: horário vago, normal
      if (!aluno && hora) {
        vagas++ // horário vago de propósito: conta à parte, não é erro
        continue
      }
      if (!hora) {
        ignoradas.push(`[${cab.profissional}] ${aluno}: sem horário, ignorada`)
        continue
      }
      const contato = (cels[5] ?? '').replace(/\s+/g, ' ').trim()
      const nova: LinhaAgenda = {
        profissional: cab.profissional,
        area: cab.area,
        diaSemana: cab.diaSemana,
        hora,
        aluno,
        cpf: normalizarCPF(cels[3] ?? ''),
        responsavel: (cels[4] ?? '').replace(/\s+/g, ' ').trim() || null,
        whatsapp: contato || null,
        grupo: cab.grupo,
        local: cab.local,
      }
      linhas.push(nova)
      if (formatoConsulta) daConsulta.add(nova)
    }
  }
  // No formato "CONSULTA COM A ...", vários grupos no mesmo dia e profissional são
  // um rodízio: cada grupo atende numa semana e eles se alternam (Grupo 1, Grupo 2...).
  const gruposPorDia = new Map<string, Set<string>>()
  for (const l of daConsulta) {
    if (!l.grupo) continue
    const k = `${l.profissional}|${l.area}|${l.diaSemana}`
    gruposPorDia.set(k, (gruposPorDia.get(k) ?? new Set()).add(l.grupo))
  }
  for (const l of daConsulta) {
    if (!l.grupo) continue
    const grupos = [...(gruposPorDia.get(`${l.profissional}|${l.area}|${l.diaSemana}`) ?? [])].sort()
    if (grupos.length < 2) continue
    l.cicloSemanas = grupos.length
    l.cicloOffset = grupos.indexOf(l.grupo)
  }
  // Criança listada em TODOS os grupos do mesmo dia e horário ocupa o horário toda
  // semana: vira um horário semanal comum, não duas linhas de rodízio.
  const porSlot = new Map<string, LinhaAgenda[]>()
  for (const l of daConsulta) {
    if (!l.cicloSemanas) continue
    const k = `${l.profissional}|${l.area}|${l.diaSemana}|${l.hora}|${l.cpf ?? normalizarNome(l.aluno)}`
    porSlot.set(k, [...(porSlot.get(k) ?? []), l])
  }
  const repetidas = new Set<LinhaAgenda>()
  for (const v of porSlot.values()) {
    const [primeira, ...resto] = v
    if (v.length !== primeira.cicloSemanas) continue
    primeira.grupo = null
    primeira.cicloSemanas = undefined
    primeira.cicloOffset = undefined
    resto.forEach((r) => repetidas.add(r))
  }
  return { linhas: linhas.filter((l) => !repetidas.has(l)), ignoradas, vagas }
}

function sugerirUsuario(nome: string, area: string | null): string {
  const limpo = (s: string) => s.replace(/[^a-z0-9]/g, '')
  const primeiro = limpo(normalizarNome(nome).split(' ')[0] ?? 'profissional')
  if (!area) return primeiro
  const baseArea = limpo(normalizarNome(area).split(' ')[0] ?? '')
  return baseArea ? `${primeiro}.${baseArea}` : primeiro
}

// A planilha ainda fala em "Grupo 1/2" e "mensal" (ciclo/offset). Converte para as semanas do
// profissional, aumentando a agenda dele (1 → 2 → 4 semanas) quando a planilha pede mais.
async function semanasDaLinha(
  banco: Banco,
  profissional: { id: string; semanasNoCiclo: number; cicloInicio: Date | null },
  ocupacoes: Ocupacao[],
  cicloSemanas: number,
  cicloOffset: number,
): Promise<number> {
  const precisa = cicloSemanas <= 1 ? 1 : cicloSemanas <= 2 ? 2 : 4
  if (precisa > profissional.semanasNoCiclo) {
    const de = profissional.semanasNoCiclo
    const inicio = profissional.cicloInicio ?? semanaEmMonday(new Date())
    const horarios = await banco.horario.findMany({
      where: { vinculo: { profissionalId: profissional.id } },
      select: { id: true, semanas: true },
    })
    // Em sequência, sem $transaction: no --simular o `banco` já é uma transação (que é desfeita
    // no fim) e o cliente de transação do Prisma não abre outra.
    await banco.usuario.update({ where: { id: profissional.id }, data: { semanasNoCiclo: precisa, cicloInicio: inicio } })
    for (const h of horarios) {
      await banco.horario.update({ where: { id: h.id }, data: { semanas: expandirSemanas(h.semanas, de, precisa) } })
    }
    for (const o of ocupacoes) {
      if (o.profissionalId !== profissional.id) continue
      o.semanas = expandirSemanas(o.semanas ?? 1, de, precisa)
      o.semanasNoCiclo = precisa
      o.cicloInicio = inicio
    }
    profissional.semanasNoCiclo = precisa
    profissional.cicloInicio = inicio
  }
  return semanasDoHorarioAntigo({ cicloSemanas, cicloOffset, semanaReferencia: profissional.cicloInicio }, profissional)
}

export async function importarLinhas(
  banco: Banco,
  linhas: LinhaAgenda[],
  ignoradas: string[],
  vagas = 0,
): Promise<ResultadoImportacao> {
  const ano = new Date().getFullYear()
  const r: ResultadoImportacao = {
    profCriados: [],
    profExistiam: [],
    alunosCriados: [],
    alunosExistiam: [],
    alunosSemCpf: [],
    horariosCriados: 0,
    vagas,
    ignoradas: [...ignoradas],
  }

  const areas = await banco.area.findMany()
  const mapaAreas = new Map(areas.map((a) => [a.nome, a.id]))
  const profissionais = await banco.usuario.findMany({
    where: { perfil: 'PROFISSIONAL' },
  })
  const profsPorUsuario = new Map(profissionais.map((u) => [u.usuario, u]))
  const profsPorNome = new Map(profissionais.map((u) => [normalizarNome(u.nome), u]))
  const alunos = await banco.aluno.findMany({
    where: { excluidoEm: null },
    select: { id: true, nome: true, cpf: true, responsavel: true, whatsapp: true },
  })
  const alunosPorCpf = new Map(alunos.filter((a) => a.cpf).map((a) => [a.cpf!, a]))
  const alunosPorNome = new Map(alunos.map((a) => [normalizarNome(a.nome), a]))
  let ultima = (
    await banco.aluno.findFirst({
      where: { matricula: { startsWith: `${ano}-` } },
      orderBy: { matricula: 'desc' },
      select: { matricula: true },
    })
  )?.matricula

  const vinculosVigentes = await banco.vinculo.findMany({
    where: { fim: null },
    include: { horarios: true, profissional: { select: { semanasNoCiclo: true, cicloInicio: true } } },
  })
  const ocupacoes: Ocupacao[] = vinculosVigentes.flatMap((v) =>
    v.horarios.map((h) => ({
      profissionalId: v.profissionalId,
      alunoId: v.alunoId,
      diaSemana: h.diaSemana,
      hora: h.hora,
      semanas: h.semanas,
      semanasNoCiclo: v.profissional.semanasNoCiclo,
      cicloInicio: v.profissional.cicloInicio,
    })),
  )
  const vinculoPorChave = new Map<string, { id: string }>(
    vinculosVigentes.map((v) => [`${v.alunoId}|${v.profissionalId}|${v.areaId}`, { id: v.id }]),
  )
  const profCriadoAgora = new Set<string>()
  const alunoCriadoAgora = new Set<string>()
  const horariosExistentes = new Set(
    vinculosVigentes.flatMap((v) => v.horarios.map((h) => `${v.id}|${h.diaSemana}|${h.hora}`)),
  )

  for (const linha of linhas) {
    const onde = `[${linha.profissional} dia ${linha.diaSemana} ${linha.hora} ${linha.aluno}]`
    if (!linha.area) {
      r.ignoradas.push(`${onde} área não reconhecida`)
      continue
    }
    let areaId = mapaAreas.get(linha.area)
    if (!areaId) {
      const criada = await banco.area.create({ data: { nome: linha.area } })
      areaId = criada.id
      mapaAreas.set(linha.area, areaId)
    }

    let profissional =
      profsPorUsuario.get(sugerirUsuario(linha.profissional, linha.area)) ??
      profsPorNome.get(normalizarNome(linha.profissional))
    if (!profissional) {
      let usuario = sugerirUsuario(linha.profissional, linha.area)
      let n = 2
      while (profsPorUsuario.has(usuario)) usuario = `${sugerirUsuario(linha.profissional, linha.area)}${n++}`
      profissional = await banco.usuario.create({
        data: {
          nome: linha.profissional,
          usuario,
          email: null,
          senhaHash: await bcrypt.hash(randomBytes(12).toString('base64url'), 10),
          precisaTrocarSenha: true,
          perfil: 'PROFISSIONAL',
          areaId,
          ativo: false,
        },
      })
      profsPorUsuario.set(profissional.usuario, profissional)
      profsPorNome.set(normalizarNome(profissional.nome), profissional)
      profCriadoAgora.add(profissional.id)
      r.profCriados.push(`${profissional.nome} (${profissional.usuario})`)
    } else if (!profCriadoAgora.has(profissional.id) && !r.profExistiam.includes(profissional.nome)) {
      r.profExistiam.push(profissional.nome)
    }

    let aluno =
      (linha.cpf ? alunosPorCpf.get(linha.cpf) : undefined) ??
      alunosPorNome.get(normalizarNome(linha.aluno))
    if (!aluno) {
      const matricula = proximaMatricula(ano, ultima)
      ultima = matricula
      aluno = await banco.aluno.create({
        data: {
          matricula,
          nome: linha.aluno,
          cpf: linha.cpf,
          responsavel: linha.responsavel,
          whatsapp: linha.whatsapp,
          situacao: 'ESPERA',
        },
      })
      if (linha.cpf) alunosPorCpf.set(linha.cpf, aluno)
      alunosPorNome.set(normalizarNome(linha.aluno), aluno)
      alunoCriadoAgora.add(aluno.id)
      r.alunosCriados.push({ nome: linha.aluno, matricula })
      if (!linha.cpf) r.alunosSemCpf.push(`${linha.aluno} (${matricula})`)
    } else {
      // Completa o que falta, sem apagar o que a secretaria já preencheu.
      const completar: { cpf?: string; responsavel?: string | null; whatsapp?: string | null } = {}
      if (!aluno.cpf && linha.cpf) {
        completar.cpf = linha.cpf
        alunosPorCpf.set(linha.cpf, aluno)
      }
      if (!aluno.responsavel && linha.responsavel) completar.responsavel = linha.responsavel
      if (!aluno.whatsapp && linha.whatsapp) completar.whatsapp = linha.whatsapp
      if (Object.keys(completar).length > 0) {
        await banco.aluno.update({ where: { id: aluno.id }, data: completar })
        Object.assign(aluno, completar)
      }
      if (!alunoCriadoAgora.has(aluno.id) && !r.alunosExistiam.includes(aluno.nome)) {
        r.alunosExistiam.push(aluno.nome)
      }
    }

    const chaveVinculo = `${aluno.id}|${profissional.id}|${areaId}`
    let vinculo = vinculoPorChave.get(chaveVinculo)
    if (!vinculo) {
      const criado = await banco.vinculo.create({
        data: { alunoId: aluno.id, profissionalId: profissional.id, areaId },
      })
      vinculo = { id: criado.id }
      vinculoPorChave.set(chaveVinculo, vinculo)
    }
    const chaveHorario = `${vinculo.id}|${linha.diaSemana}|${linha.hora}`
    if (horariosExistentes.has(chaveHorario)) continue
    const semanas = await semanasDaLinha(banco, profissional, ocupacoes, linha.cicloSemanas ?? 1, linha.cicloOffset ?? 0)
    const novo: Ocupacao = {
      profissionalId: profissional.id,
      alunoId: aluno.id,
      diaSemana: linha.diaSemana,
      hora: linha.hora,
      semanas,
      semanasNoCiclo: profissional.semanasNoCiclo,
      cicloInicio: profissional.cicloInicio,
    }
    const conflito = detectarConflito(novo, ocupacoes)
    if (conflito) {
      r.ignoradas.push(`${onde} ${conflito.toLowerCase()}`)
      continue
    }
    await banco.horario.create({
      data: {
        vinculoId: vinculo.id,
        diaSemana: linha.diaSemana,
        hora: linha.hora,
        duracaoMin: 40,
        local: linha.local,
        semanas,
      },
    })
    horariosExistentes.add(chaveHorario)
    ocupacoes.push(novo)
    r.horariosCriados++
    await banco.aluno.update({
      where: { id: aluno.id },
      data: { situacao: 'ATENDIMENTO' },
    })
  }
  return r
}

export function textoRelatorio(r: ResultadoImportacao, arquivo: string, simular: boolean): string {
  const agora = new Date().toLocaleString('pt-BR')
  const linhas = [
    `Importação da agenda — ${agora}${simular ? ' (SIMULAÇÃO, nada gravado)' : ''}`,
    `Arquivo: ${arquivo}`,
    `Profissionais: ${r.profCriados.length} criados, ${r.profExistiam.length} já existiam`,
    ...r.profCriados.map((p) => `  + ${p}`),
    `Alunos: ${r.alunosCriados.length} criados, ${r.alunosExistiam.length} já existiam`,
    ...r.alunosCriados.map((a) => `  + ${a.nome} (${a.matricula})`),
    `Horários: ${r.horariosCriados} criados`,
    `Horários vagos: ${r.vagas}`,
    `Alunos criados sem CPF (${r.alunosSemCpf.length}):`,
    ...r.alunosSemCpf.map((a) => `  - ${a}`),
    `Linhas ignoradas (${r.ignoradas.length}):`,
    ...r.ignoradas.map((m) => `  - ${m}`),
  ]
  return linhas.join('\n')
}

const SIMULAR = Symbol('simular')

export async function importarArquivo(caminho: string, simular: boolean): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ path: caminho })
  const { linhas, ignoradas, vagas } = extrairLinhas(html)
  const prisma = new PrismaClient()
  try {
    if (!simular) {
      const resultado = await importarLinhas(prisma, linhas, ignoradas, vagas)
      const texto = textoRelatorio(resultado, caminho, false)
      salvarRelatorio(texto, false)
      return texto
    }
    // Simulação: roda tudo numa transação que é desfeita de propósito, mas
    // guarda o relatório antes para mostrar.
    let capturado: ResultadoImportacao | null = null
    try {
      await prisma.$transaction(
        async (tx) => {
          capturado = await importarLinhas(tx as unknown as PrismaClient, linhas, ignoradas, vagas)
          throw SIMULAR
        },
        { timeout: 120000 },
      )
    } catch (e) {
      if (e !== SIMULAR) throw e
    }
    if (!capturado) throw new Error('Simulação não devolveu relatório.')
    const texto = textoRelatorio(capturado, caminho, true)
    salvarRelatorio(texto, true)
    return texto
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

function salvarRelatorio(texto: string, simular: boolean) {
  const pasta = join(process.cwd(), '.arquivos', 'importacoes')
  mkdirSync(pasta, { recursive: true })
  const hoje = new Date().toISOString().slice(0, 10)
  writeFileSync(join(pasta, simular ? `${hoje}-simulacao.txt` : `${hoje}.txt`), texto, 'utf-8')
}

const executadoDireto =
  process.argv[1]?.endsWith('importar-agenda.ts') ||
  process.argv[1]?.endsWith('importar-agenda.js')
if (executadoDireto) {
  const args = process.argv.slice(2).filter((a) => a !== '--simular')
  const simular = process.argv.includes('--simular')
  const caminho = args[0]
  if (!caminho) {
    console.error('Uso: npm run importar -- <caminho-da-agenda.docx> [--simular]')
    process.exit(2)
  }
  importarArquivo(caminho, simular)
    .then((texto) => {
      console.log(texto)
      process.exit(0)
    })
    .catch((e: Error) => {
      console.error(`Importação falhou: ${e.message}`)
      process.exit(1)
    })
}
