import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Campo } from '@/domain/anamnese'

export const AREAS_PADRAO = [
  'Psicologia', 'Psicopedagogia AEE', 'Psicopedagogia Clínica', 'Fonoaudiologia',
  'Fisioterapia', 'Terapia Ocupacional', 'Assistência Terapêutica', 'Serviço Social',
  'Nutrição', 'Massoterapia', 'Libras', 'Neuropediatria', 'Psiquiatria',
]

export async function criarUsuario(d: {
  nome: string; usuario: string; email?: string | null; senha: string
  perfil: 'ADMIN' | 'PROFISSIONAL'; areaId?: string | null
}) {
  return prisma.usuario.create({
    data: {
      nome: d.nome,
      usuario: d.usuario.toLowerCase().trim(),
      email: d.email ? d.email.toLowerCase().trim() : null,
      senhaHash: await bcrypt.hash(d.senha, 10),
      precisaTrocarSenha: true,
      perfil: d.perfil,
      areaId: d.areaId ?? null,
    },
  })
}

export async function seed() {
  for (const nome of AREAS_PADRAO) {
    await prisma.area.upsert({ where: { nome }, update: {}, create: { nome } })
  }
  await prisma.configuracao.upsert({ where: { id: 'unica' }, update: {}, create: { id: 'unica' } })
  const login = (process.env.ADMIN_USUARIO ?? 'direcao').toLowerCase()
  if (!(await prisma.usuario.findUnique({ where: { usuario: login } }))) {
    const senha = process.env.ADMIN_SENHA
    if (!senha) throw new Error('Defina ADMIN_SENHA no arquivo .env antes de rodar o seed.')
    await criarUsuario({ nome: 'Direção', usuario: login, senha, perfil: 'ADMIN' })
  }
  await seedModelosAnamnese()
}

// Os modelos de anamnese são conteúdo (JSON em src/db/modelos/), não código:
// a instituição ajusta o arquivo e roda o seed de novo. Idempotente por nome.
export async function seedModelosAnamnese(diretorio = join(process.cwd(), 'src', 'db', 'modelos')) {
  const arquivos = readdirSync(diretorio).filter((a) => a.endsWith('.json'))
  for (const arquivo of arquivos) {
    const modelo = JSON.parse(readFileSync(join(diretorio, arquivo), 'utf-8')) as {
      nome: string
      area?: string | null
      campos: Campo[]
    }
    let areaId: string | null = null
    if (modelo.area) {
      const area = await prisma.area.findUnique({ where: { nome: modelo.area } })
      areaId = area?.id ?? null
    }
    await prisma.modeloAnamnese.upsert({
      where: { nome: modelo.nome },
      update: { campos: modelo.campos, areaId },
      create: { nome: modelo.nome, campos: modelo.campos, areaId },
    })
  }
}
