// Desfazer uma mudança de agenda a partir do Histórico: cada mudança guarda como cada
// horário estava ANTES e como ficou DEPOIS. Só dá para voltar se os horários ainda
// estiverem exatamente como ficaram (senão a gente desfaria também o que veio depois).
// Mudanças gravadas antes da agenda em semanas (com grupo/ciclo) não são lidas: não voltam.

export type CamposHorario = { diaSemana: number; hora: string; semanas: number }

export type MudancaHorarios = {
  horarios: { id: string; antes: CamposHorario; depois: CamposHorario }[]
}

type HorarioLike = { diaSemana: number; hora: string; semanas: number }

export function camposDoHorario(h: HorarioLike): CamposHorario {
  return { diaSemana: h.diaSemana, hora: h.hora, semanas: h.semanas }
}

export function mesmosCampos(a: CamposHorario, b: CamposHorario): boolean {
  return a.diaSemana === b.diaSemana && a.hora === b.hora && a.semanas === b.semanas
}

function ehCampos(v: unknown): v is CamposHorario {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return typeof c.diaSemana === 'number' && typeof c.hora === 'string' && typeof c.semanas === 'number'
}

// O que veio do banco é JSON solto: só aceita se tiver exatamente o formato esperado.
export function lerMudanca(v: unknown): MudancaHorarios | null {
  if (typeof v !== 'object' || v === null) return null
  const lista = (v as { horarios?: unknown }).horarios
  if (!Array.isArray(lista) || lista.length === 0) return null
  const horarios: MudancaHorarios['horarios'] = []
  for (const item of lista) {
    if (typeof item !== 'object' || item === null) return null
    const { id, antes, depois } = item as Record<string, unknown>
    if (typeof id !== 'string' || !ehCampos(antes) || !ehCampos(depois)) return null
    horarios.push({ id, antes: camposDoHorario(antes), depois: camposDoHorario(depois) })
  }
  return { horarios }
}

// Aplica os campos de um horário (como guardados no histórico) sobre o horário completo.
export function comCampos<T extends HorarioLike>(h: T, c: CamposHorario): T {
  return { ...h, diaSemana: c.diaSemana, hora: c.hora, semanas: c.semanas }
}

export type PodeDesfazer = { ok: true } | { ok: false; motivo: string }

// `atuais` = como os horários estão agora (só os que ainda existem e estão vigentes).
export function conferirDesfazer(mudanca: MudancaHorarios, atuais: Map<string, CamposHorario>): PodeDesfazer {
  for (const h of mudanca.horarios) {
    const atual = atuais.get(h.id)
    if (!atual) {
      return { ok: false, motivo: 'Um desses atendimentos foi encerrado ou removido depois da mudança, então não dá para desfazer.' }
    }
    if (!mesmosCampos(atual, h.depois)) {
      return {
        ok: false,
        motivo: 'Esses horários já mudaram de novo depois dessa alteração. Desfaça antes as mudanças mais novas, ou ajuste à mão.',
      }
    }
  }
  return { ok: true }
}
