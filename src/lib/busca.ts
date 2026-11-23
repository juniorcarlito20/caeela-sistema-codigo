import type { Prisma } from '@prisma/client'
import { prisma } from '@/db/prisma'
import type { Perfil } from '@/domain/acesso'
import { rotuloSemanas } from '@/domain/semanas'
import { pendenciasDoAluno, rotuloSituacao } from '@/domain/matricula'

export type SessaoBusca = { id: string; perfil: Perfil }

export type AlunoEncontrado = {
  id: string
  nome: string
  matricula: string
  situacao: string
  rotuloSituacao: string
  pendencias: string[]
  vinculos: { area: string; profissional: string; dia: number; hora: string; frequencia: string }[]
  ultimas: { data: string; situacao: string }[]
}

export type ProfissionalEncontrado = {
  id: string
  nome: string
  usuario: string
  area: string
  alunos: number
  dias: string
}

const DIAS = ['', 'seg', 'ter', 'qua', 'qui', 'sex']

// Tira acento e baixa tudo, para "jose" achar "José" sem extensão no banco.
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Ids por nome aproximado usando unaccent do Postgres. Devolve nulo se a
// extensão não existir no ambiente — aí vale a comparação simples.
export async function idsPorNomeAproximado(tabela: 'Aluno' | 'Usuario', q: string): Promise<string[] | null> {
  try {
    if (tabela === 'Aluno') {
      const linhas = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Aluno"
        WHERE "excluidoEm" IS NULL AND unaccent(nome) ILIKE unaccent(${'%' + q + '%'})
        LIMIT 50`
      return linhas.map((l) => l.id)
    }
    const linhas = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Usuario"
      WHERE "ativo" IS TRUE AND "perfil" = 'PROFISSIONAL' AND unaccent(nome) ILIKE unaccent(${'%' + q + '%'})
      LIMIT 50`
    return linhas.map((l) => l.id)
  } catch {
    return null
  }
}

export async function buscar(
  sessao: SessaoBusca,
  q: string,
): Promise<{ alunos: AlunoEncontrado[]; profissionais: ProfissionalEncontrado[] }> {
  const busca = q.trim()
  if (busca.length < 2) return { alunos: [], profissionais: [] }
  const digitos = busca.replace(/\D/g, '')
  const termo = normalizarBusca(busca)

  // Candidatos no banco (rápido, com unaccent) + filtro sem acento na
  // aplicação (preciso). Sem a extensão, vale a comparação simples.
  const idsNome = await idsPorNomeAproximado('Aluno', busca)
  const ouNome: Prisma.AlunoWhereInput = idsNome
    ? { id: { in: idsNome } }
    : { nome: { contains: busca, mode: 'insensitive' } }
  const candidatos = await prisma.aluno.findMany({
    where: {
      excluidoEm: null,
      deFora: false, // pessoa de fora do centro (consultas) não se mistura com os alunos
      // Aluno desligado sai da busca; para achá-lo, Alunos → situação "Desligado".
      situacao: { not: 'DESLIGADO' },
      OR: [
        ouNome,
        { matricula: { contains: busca, mode: 'insensitive' } },
        ...(digitos ? [{ cpf: { contains: digitos } }] : []),
      ],
    },
    include: {
      vinculos: {
        include: { area: true, profissional: true, horarios: { where: { excluidoEm: null } } },
      },
    },
    take: 50,
  })

  let alunos = candidatos.filter(
    (a) =>
      normalizarBusca(a.nome).includes(termo) ||
      normalizarBusca(a.matricula).includes(termo) ||
      (digitos && (a.cpf ?? '').includes(digitos)),
  )

  if (sessao.perfil === 'PROFISSIONAL') {
    const meus = await prisma.vinculo.findMany({
      where: { profissionalId: sessao.id },
      select: { alunoId: true },
    })
    const ids = new Set(meus.map((v) => v.alunoId))
    alunos = alunos.filter((a) => ids.has(a.id))
  }

  const ultimosPorAluno = new Map<string, { data: Date; situacao: string }[]>()
  if (alunos.length > 0) {
    const recentes = await prisma.atendimento.findMany({
      where: {
        vinculo: { alunoId: { in: alunos.map((a) => a.id) } },
        situacao: { not: 'AGENDADO' },
      },
      orderBy: [{ data: 'desc' }, { hora: 'desc' }],
      take: 60,
    })
    const vinculoAluno = new Map(
      alunos.flatMap((a) => a.vinculos.map((v) => [v.id, a.id] as const)),
    )
    for (const at of recentes) {
      const alunoId = vinculoAluno.get(at.vinculoId)
      if (!alunoId) continue
      const lista = ultimosPorAluno.get(alunoId) ?? []
      if (lista.length < 3) lista.push({ data: at.data, situacao: at.situacao })
      ultimosPorAluno.set(alunoId, lista)
    }
  }

  const alunosFmt: AlunoEncontrado[] = alunos.slice(0, 20).map((a) => ({
    id: a.id,
    nome: a.nome,
    matricula: a.matricula,
    situacao: a.situacao,
    rotuloSituacao: rotuloSituacao(a.situacao),
    pendencias: pendenciasDoAluno(a),
    vinculos: a.vinculos.flatMap((v) =>
      v.horarios.filter((h) => !h.excluidoEm).map((h) => ({
        area: v.area.nome,
        profissional: v.profissional.nome,
        dia: h.diaSemana,
        hora: h.hora,
        frequencia: rotuloSemanas(h.semanas, v.profissional.semanasNoCiclo),
      })),
    ),
    ultimas: (ultimosPorAluno.get(a.id) ?? []).map((u) => ({
      data: u.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      situacao: u.situacao,
    })),
  }))

  // Profissionais: ADMIN vê todos; profissional só encontra a si mesmo.
  const idsProf = await idsPorNomeAproximado('Usuario', busca)
  const ouNomeProf: Prisma.UsuarioWhereInput = idsProf
    ? { id: { in: idsProf } }
    : { nome: { contains: busca, mode: 'insensitive' } }
  const profs = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfil: 'PROFISSIONAL',
      ...(sessao.perfil === 'PROFISSIONAL' ? { id: sessao.id } : {}),
      OR: [
        ouNomeProf,
        { usuario: { contains: busca.toLowerCase(), mode: 'insensitive' } },
      ],
    },
    include: { area: true, vinculos: { where: { fim: null }, include: { horarios: { where: { excluidoEm: null } } } } },
    take: 20,
  })
  const profissionais: ProfissionalEncontrado[] = profs
    .filter(
      (u) =>
        normalizarBusca(u.nome).includes(termo) ||
        normalizarBusca(u.usuario).includes(termo),
    )
    .map((u) => {
      const dias = [...new Set(u.vinculos.flatMap((v) => v.horarios.map((h) => h.diaSemana)))]
        .sort()
        .map((d) => DIAS[d])
      return {
        id: u.id,
        nome: u.nome,
        usuario: u.usuario,
        area: u.area?.nome ?? '—',
        alunos: new Set(u.vinculos.map((v) => v.alunoId)).size,
        dias: dias.length > 0 ? dias.join(', ') : '—',
      }
    })

  return { alunos: alunosFmt, profissionais }
}

export function rotuloPresenca(s: string): string {
  if (s === 'REALIZADO') return '✔'
  if (s === 'FALTOU') return 'faltou'
  if (s === 'JUSTIFICOU') return 'justificou'
  return 'cancelado'
}
