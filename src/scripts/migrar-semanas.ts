// src/scripts/migrar-semanas.ts
// Converte o rodízio antigo (grupo/ciclo/offset/referência em cada horário) para semanas.
//   npm run migrar-semanas              → só simula e mostra os números (não grava nada)
//   npm run migrar-semanas -- --gravar  → grava, se a prova de datas passar
//   npm run migrar-semanas -- --gravar --forcar → grava de novo (só no banco local)
// A saída mostra só números e nomes de profissionais — nunca nome de criança.
import { PrismaClient } from '@prisma/client'
import {
  alunosNaMesmaSemana, cicloDoProfissional, datasIguais, semanasDoHorarioAntigo, type RotacaoAntiga,
} from '@/domain/migracaoSemanas'
import { frequencia, type Ciclo, type Ritmo } from '@/domain/semanas'

const banco = new PrismaClient()
const gravar = process.argv.includes('--gravar')
const forcar = process.argv.includes('--forcar')

type Linha = RotacaoAntiga & {
  id: string; profissionalId: string; profissionalNome: string; diaSemana: number; hora: string; vigente: boolean
}

async function main() {
  // SQL cru nas colunas antigas: funciona até antes da migração das colunas novas (simulação).
  const linhas = await banco.$queryRaw<Linha[]>`
    select h.id, v."profissionalId", u.nome as "profissionalNome", h."diaSemana", h.hora,
           h."cicloSemanas", h."cicloOffset", h."semanaReferencia",
           (h."excluidoEm" is null and v.fim is null) as vigente
    from "Horario" h
    join "Vinculo" v on v.id = h."vinculoId"
    join "Usuario" u on u.id = v."profissionalId"`

  const porProfissional = new Map<string, Linha[]>()
  for (const l of linhas) porProfissional.set(l.profissionalId, [...(porProfissional.get(l.profissionalId) ?? []), l])

  const ciclos = new Map<string, Ciclo>()
  const novas = new Map<string, number>()
  let falhas = 0
  const hoje = new Date()
  for (const [profissionalId, lista] of porProfissional) {
    const vigentes = lista.filter((l) => l.vigente)
    const ciclo = cicloDoProfissional(vigentes.length > 0 ? vigentes : lista)
    if ('erro' in ciclo) {
      console.log(`✖ ${lista[0].profissionalNome}: ${ciclo.erro} — não dá para converter. Nada foi gravado.`)
      process.exitCode = 1
      return
    }
    ciclos.set(profissionalId, ciclo)
    const freq: Record<string, number> = { SEMANAL: 0, QUINZENAL: 0, MENSAL: 0, OUTRA: 0 }
    for (const l of lista) {
      const semanas = semanasDoHorarioAntigo(l, ciclo)
      novas.set(l.id, semanas)
      if (!datasIguais(l, { ...ciclo, semanas }, hoje)) falhas++
      if (l.vigente) freq[frequencia(semanas, ciclo.semanasNoCiclo)]++
    }
    console.log(
      `${lista[0].profissionalNome}: ${ciclo.semanasNoCiclo} semana(s)` +
        (ciclo.cicloInicio ? `, Semana 1 = ${ciclo.cicloInicio.toLocaleDateString('pt-BR')}` : '') +
        ` · ${vigentes.length} horários vigentes (semanal ${freq.SEMANAL}, quinzenal ${freq.QUINZENAL},` +
        ` mensal ${freq.MENSAL}, outra ${freq.OUTRA})`,
    )
  }

  const vigentesComRitmo = linhas
    .filter((l) => l.vigente)
    .map((l) => ({ ...l, ritmo: { ...ciclos.get(l.profissionalId)!, semanas: novas.get(l.id)! } as Ritmo }))
  const juntos = alunosNaMesmaSemana(vigentesComRitmo)
  console.log(`\nHorários convertidos: ${linhas.length} (vigentes ${vigentesComRitmo.length})`)
  console.log(`Prova de datas (13 semanas): ${falhas === 0 ? 'OK, nenhuma data muda' : `✖ ${falhas} horários mudariam de data`}`)
  console.log(`Dois alunos no mesmo horário e semana (viram alerta de conflito): ${juntos.length}`)
  for (const [a] of juntos) console.log(`  - ${a.profissionalNome}, dia ${a.diaSemana} às ${a.hora}`)

  if (!gravar) {
    console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: npm run migrar-semanas -- --gravar')
    return
  }
  if (falhas > 0) {
    console.log('\n✖ A prova de datas falhou. Nada foi gravado.')
    process.exitCode = 1
    return
  }
  const config = await banco.configuracao.findUnique({ where: { id: 'unica' } })
  if (config?.semanasMigradasEm && !forcar) {
    console.log(`\nJá migrado em ${config.semanasMigradasEm.toLocaleString('pt-BR')}. Nada foi gravado.`)
    return
  }
  const porMascara = new Map<number, string[]>()
  for (const [id, m] of novas) porMascara.set(m, [...(porMascara.get(m) ?? []), id])
  await banco.$transaction([
    ...[...ciclos].map(([id, c]) =>
      banco.usuario.update({ where: { id }, data: { semanasNoCiclo: c.semanasNoCiclo, cicloInicio: c.cicloInicio } })),
    ...[...porMascara].map(([semanas, ids]) => banco.horario.updateMany({ where: { id: { in: ids } }, data: { semanas } })),
    banco.configuracao.upsert({
      where: { id: 'unica' },
      update: { semanasMigradasEm: new Date() },
      create: { id: 'unica', semanasMigradasEm: new Date() },
    }),
  ])
  console.log('\n✔ Gravado.')
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => banco.$disconnect())
