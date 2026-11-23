import { estaNaSemana, ritmosBatem, todasAsSemanas, type Ritmo } from './semanas'
import { intervalosSeSobrepoem, type Slot } from './grade'

// Um horário de aluno do jeito que a checagem de choque precisa. Sem semanas informadas,
// vale toda semana (profissional de 1 semana).
export type Ocupacao = {
  profissionalId: string; alunoId: string; diaSemana: number; hora: string
  semanas?: number; semanasNoCiclo?: number; cicloInicio?: Date | null
  duracaoMin?: number | null
  // Quantas crianças cabem no horário em que este atendimento está (1 = individual, o padrão).
  vagas?: number
}

const mesmoSlot = (a: Ocupacao, b: Ocupacao) => a.diaSemana === b.diaSemana && a.hora === b.hora

// A mesma criança não pode estar em dois lugares ao mesmo tempo: compara o intervalo inteiro
// (hora + duração) quando as duas durações são conhecidas, e o horário de início quando não.
const seSobrepoem = (a: Ocupacao, b: Ocupacao): boolean => {
  if (a.diaSemana !== b.diaSemana) return false
  if (a.duracaoMin && b.duracaoMin) return intervalosSeSobrepoem(a.hora, a.duracaoMin, b.hora, b.duracaoMin)
  return a.hora === b.hora
}

export function ritmoDe(o: Ocupacao): Ritmo {
  const semanasNoCiclo = o.semanasNoCiclo ?? 1
  return { semanasNoCiclo, cicloInicio: o.cicloInicio ?? null, semanas: o.semanas ?? todasAsSemanas(semanasNoCiclo) }
}

// Quantas crianças cabem num lugar da grade: o maior número de vagas que algum atendimento dele
// declara (cada atendimento carrega as vagas do horário em que está). Sem informar, 1.
const capacidadeDe = (grupo: Ocupacao[]): number => Math.max(1, ...grupo.map((o) => o.vagas ?? 1))

// O novo horário cabe? A mesma criança não pode estar em dois lugares ao mesmo tempo, e o
// profissional atende no máximo `vagas` crianças por dia + hora + semana (1 = individual).
export function detectarConflito(novo: Ocupacao, existentes: Ocupacao[]): string | null {
  const rNovo = ritmoDe(novo)
  const batem = (e: Ocupacao) => ritmosBatem(rNovo, ritmoDe(e))
  if (existentes.some((e) => e.alunoId === novo.alunoId && seSobrepoem(e, novo) && batem(e))) {
    return 'Este aluno já tem atendimento nesse dia e horário.'
  }
  const noHorario = existentes.filter((e) => e.profissionalId === novo.profissionalId && mesmoSlot(e, novo))
  if (noHorario.length > 0) {
    const vagas = capacidadeDe([novo, ...noHorario])
    const ciclo = Math.max(rNovo.semanasNoCiclo, ...noHorario.map((e) => ritmoDe(e).semanasNoCiclo))
    for (let semana = 1; semana <= ciclo; semana++) {
      if (!estaNaSemana(rNovo.semanas, semana)) continue
      const ocupados = noHorario.filter((e) => estaNaSemana(ritmoDe(e).semanas, semana)).length
      if (ocupados >= vagas) {
        return vagas === 1
          ? 'Este profissional já tem atendimento nesse dia e horário.'
          : 'Este horário já está com todas as vagas ocupadas nessa semana.'
      }
    }
  }
  return null
}

export function horariosLivres(
  profissionalId: string, existentes: Ocupacao[], slots: Slot[],
  indisponiveis: Set<string> = new Set(),
): { diaSemana: number; hora: string }[] {
  const ocupantes = new Map<string, number>()
  for (const e of existentes) {
    if (e.profissionalId !== profissionalId) continue
    const chave = `${e.diaSemana}-${e.hora}`
    ocupantes.set(chave, (ocupantes.get(chave) ?? 0) + 1)
  }
  const livres: { diaSemana: number; hora: string }[] = []
  for (const slot of [...slots].sort((a, b) => a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora))) {
    const chave = `${slot.diaSemana}-${slot.hora}`
    // Livre enquanto houver vaga sobrando (horário individual: 1 vaga).
    if ((ocupantes.get(chave) ?? 0) < (slot.vagas ?? 1) && !indisponiveis.has(chave)) {
      livres.push({ diaSemana: slot.diaSemana, hora: slot.hora })
    }
  }
  return livres
}

export type ParConflito<T> = { a: T; b: T; motivo: 'ALUNO' | 'PROFISSIONAL' }

// Olha a agenda inteira e devolve cada par de horários que bate de verdade: a mesma criança
// em dois lugares ao mesmo tempo, ou um profissional com mais alunos do que vagas no mesmo
// horário e semana (num horário individual, dois alunos). Serve pro alerta da direção —
// quem decide o que fazer é a pessoa.
export function listarConflitos<T extends Ocupacao & { id: string }>(horarios: T[]): ParConflito<T>[] {
  const porDia = new Map<number, T[]>()
  for (const h of horarios) porDia.set(h.diaSemana, [...(porDia.get(h.diaSemana) ?? []), h])
  const pares: ParConflito<T>[] = []
  const vistos = new Set<string>()
  const adicionar = (a: T, b: T, motivo: 'ALUNO' | 'PROFISSIONAL') => {
    const chave = `${motivo}|${[a.id, b.id].sort().join('|')}`
    if (vistos.has(chave)) return
    vistos.add(chave)
    pares.push({ a, b, motivo })
  }
  for (const lista of porDia.values()) {
    // A mesma criança em dois lugares ao mesmo tempo.
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        if (a.alunoId === b.alunoId && seSobrepoem(a, b) && ritmosBatem(ritmoDe(a), ritmoDe(b))) adicionar(a, b, 'ALUNO')
      }
    }
    // Profissional com mais alunos do que vagas no horário, semana a semana.
    const grupos = new Map<string, T[]>()
    for (const h of lista) {
      const chave = `${h.profissionalId}|${h.hora}`
      grupos.set(chave, [...(grupos.get(chave) ?? []), h])
    }
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue
      const vagas = capacidadeDe(grupo)
      const ciclo = Math.max(...grupo.map((h) => ritmoDe(h).semanasNoCiclo))
      for (let semana = 1; semana <= ciclo; semana++) {
        const ativos = grupo.filter((h) => estaNaSemana(ritmoDe(h).semanas, semana))
        if (ativos.length <= vagas) continue
        for (let i = 0; i < ativos.length; i++) {
          for (let j = i + 1; j < ativos.length; j++) {
            if (ativos[i].alunoId !== ativos[j].alunoId) adicionar(ativos[i], ativos[j], 'PROFISSIONAL')
          }
        }
      }
    }
  }
  return pares
}

// true quando TODOS os horários fixos daquele dia estão marcados indisponível
// pro profissional — usado pra tirar o dia inteiro do seletor da agenda dele.
export function diaTotalmenteIndisponivel(
  diaSemana: number, indisponiveis: Set<string>, slots: Slot[],
): boolean {
  const doDia = slots.filter((s) => s.diaSemana === diaSemana)
  return doDia.length > 0 && doDia.every((s) => indisponiveis.has(`${diaSemana}-${s.hora}`))
}

// O profissional não atende nesse dia: não tem nenhum horário, ou todos estão bloqueados.
export function diaSemAtendimento(
  diaSemana: number, indisponiveis: Set<string>, slots: Slot[],
): boolean {
  return !slots.some((s) => s.diaSemana === diaSemana) || diaTotalmenteIndisponivel(diaSemana, indisponiveis, slots)
}

// Só os choques que uma mudança CRIARIA (os que já existiam antes não contam), pra
// recusar a mudança sem travar o que a secretaria ainda não resolveu.
export function conflitosNovos<T extends Ocupacao & { id: string }>(antes: T[], depois: T[]): ParConflito<T>[] {
  const chave = (p: ParConflito<T>) => [p.a.id, p.b.id].sort().join('|')
  const existentes = new Set(listarConflitos(antes).map(chave))
  return listarConflitos(depois).filter((p) => !existentes.has(chave(p)))
}
