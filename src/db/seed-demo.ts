// Carga da VERSÃO DE DEMONSTRAÇÃO: tudo inventado (nomes, CPFs, telefones, escolas).
// Nenhum dado de pessoa real. Uso: DATABASE_URL=... npx tsx src/db/seed-demo.ts
// Apaga e recria somente se a variável DEMO=1 estiver definida (proteção contra rodar no banco real).
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { seed } from './seed'

const SENHA_DEMO = 'demo2026'

const PROFISSIONAIS = [
  { nome: 'Ana Fictícia Prado', usuario: 'ana.psicologia', area: 'Psicologia' },
  { nome: 'Bruno Fictício Lima', usuario: 'bruno.fono', area: 'Fonoaudiologia' },
  { nome: 'Carla Fictícia Souza', usuario: 'carla.fisio', area: 'Fisioterapia' },
  { nome: 'Davi Fictício Rocha', usuario: 'davi.to', area: 'Terapia Ocupacional' },
]
const ALUNOS = [
  'Lucas Exemplo', 'Maria Exemplo', 'Pedro Exemplo', 'Júlia Exemplo', 'Gabriel Exemplo', 'Laura Exemplo',
  'Miguel Exemplo', 'Sofia Exemplo', 'Arthur Exemplo', 'Helena Exemplo', 'Heitor Exemplo', 'Alice Exemplo',
]
const HORAS = ['08:00', '08:50', '09:40', '10:30', '13:30', '14:20']

const iso = (d: Date) => d.toISOString().slice(0, 10)
const meioDia = (s: string) => new Date(`${s}T12:00:00Z`)

async function main() {
  if (process.env.DEMO !== '1') throw new Error('Defina DEMO=1: este script apaga o banco e só serve para a demonstração.')
  process.env.ADMIN_USUARIO = 'direcao'
  process.env.ADMIN_SENHA = SENHA_DEMO
  await seed()
  await prisma.usuario.updateMany({ where: { usuario: 'direcao' }, data: { precisaTrocarSenha: false, nome: 'Direção (demonstração)' } })

  const hash = await bcrypt.hash(SENHA_DEMO, 10)
  await prisma.usuario.upsert({
    where: { usuario: 'secretaria' }, update: {},
    create: { nome: 'Secretaria (demonstração)', usuario: 'secretaria', senhaHash: hash, precisaTrocarSenha: false, perfil: 'SECRETARIA' },
  })
  if (await prisma.aluno.count()) { console.log('Demonstração já carregada.'); return }

  const profs = []
  for (const p of PROFISSIONAIS) {
    const area = await prisma.area.findUniqueOrThrow({ where: { nome: p.area } })
    profs.push(await prisma.usuario.create({
      data: { nome: p.nome, usuario: p.usuario, senhaHash: hash, precisaTrocarSenha: false, perfil: 'PROFISSIONAL', areaId: area.id },
      include: { area: true },
    }))
  }

  const hoje = new Date()
  for (let i = 0; i < ALUNOS.length; i++) {
    const nasc = new Date(Date.UTC(2014 + (i % 8), i % 12, 5 + i))
    const aluno = await prisma.aluno.create({
      data: {
        matricula: `2026-${String(i + 1).padStart(4, '0')}`,
        nome: ALUNOS[i],
        nascimento: nasc,
        escola: i % 2 ? 'Escola Municipal Exemplo' : 'Colégio Fictício',
        serie: `${(i % 5) + 1}º ano`,
        responsavel: `Responsável de ${ALUNOS[i].split(' ')[0]}`,
        whatsapp: `(77) 90000-${String(1000 + i)}`,
        situacao: i < 10 ? 'ATENDIMENTO' : 'ESPERA',
      },
    })
    if (i >= 10) continue
    for (const k of [0, 1]) {
      const prof = profs[(i + k * 2) % profs.length]
      const dia = ((i + k) % 5) + 1
      const hora = HORAS[(i + k * 3) % HORAS.length]
      const v = await prisma.vinculo.create({
        data: { alunoId: aluno.id, profissionalId: prof.id, areaId: prof.areaId!, inicio: new Date(Date.UTC(2026, 9, 6)) },
      })
      await prisma.horario.create({ data: { vinculoId: v.id, diaSemana: dia, hora } })
      // Últimas 4 semanas: atendimentos passados no dia da semana do horário.
      for (let s = 1; s <= 4; s++) {
        const d = new Date(hoje)
        d.setUTCDate(d.getUTCDate() - 7 * s + (dia - ((d.getUTCDay() + 6) % 7 + 1)))
        if (d >= hoje) continue
        const faltou = (i + s + k) % 6 === 0
        const at = await prisma.atendimento.create({
          data: {
            vinculoId: v.id, data: meioDia(iso(d)), hora,
            situacao: faltou ? 'FALTOU' : 'REALIZADO', confirmadoEm: d, registradoPorId: prof.id,
          },
        })
        if (!faltou) {
          await prisma.evolucao.create({
            data: {
              atendimentoId: at.id, autorId: prof.id,
              atividade: 'Atividade lúdica de exemplo (texto fictício da demonstração).',
              objetivo: 'Objetivo de exemplo: estimular atenção e comunicação.',
              observacoes: 'Registro inventado para demonstrar o sistema.',
            },
          })
        }
      }
    }
  }
  console.log(`Demonstração carregada: ${profs.length} profissionais, ${ALUNOS.length} alunos fictícios. Senha de todos: ${SENHA_DEMO}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
