// src/domain/acesso.ts
// Tipos de acesso do sistema. A Secretaria (agendamentos) tem uma lista fechada do que pode
// abrir: tudo fora dela é recusado pelo middleware. Direção e Profissional seguem as regras
// que cada página e rota já tem.

export type Perfil = 'ADMIN' | 'PROFISSIONAL' | 'SECRETARIA'

export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Direção',
  PROFISSIONAL: 'Profissional',
  SECRETARIA: 'Secretaria',
}

export function paginaInicial(perfil: Perfil): string {
  if (perfil === 'ADMIN') return '/painel'
  if (perfil === 'SECRETARIA') return '/lembretes'
  return '/agenda'
}

// Páginas: qualquer método (as ações de servidor, como Sair e trocar senha, chegam como POST
// na própria página).
const PAGINAS_SECRETARIA = [
  /^\/$/,
  /^\/lembretes$/,
  /^\/equipe$/,
  /^\/equipe\/[^/]+$/,
  /^\/busca$/,
  /^\/trocar-senha$/,
  // Consulta de alunos (só leitura): a lista e a ficha. Nada de /alunos/novo nem de subpáginas
  // (anamnese etc.). `novo` é barrado pelo (?!novo$).
  /^\/alunos$/,
  /^\/alunos\/(?!novo$)[^/]+$/,
]

// API: só estas, e só com este método.
const API_SECRETARIA: { metodo: string; caminho: RegExp }[] = [
  { metodo: 'POST', caminho: /^\/api\/lembretes$/ },
  { metodo: 'POST', caminho: /^\/api\/atendimentos$/ },
  { metodo: 'PATCH', caminho: /^\/api\/alunos\/[^/]+$/ },
  { metodo: 'GET', caminho: /^\/api\/busca$/ },
  { metodo: 'POST', caminho: /^\/api\/dias-sem-atendimento$/ },
  { metodo: 'DELETE', caminho: /^\/api\/dias-sem-atendimento$/ },
]

export function secretariaPodeAbrir(caminho: string, metodo: string): boolean {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho
  if (limpo.startsWith('/api/')) {
    return API_SECRETARIA.some((r) => r.metodo === metodo.toUpperCase() && r.caminho.test(limpo))
  }
  return PAGINAS_SECRETARIA.some((r) => r.test(limpo))
}

// Abas da ficha do aluno que cada perfil enxerga. A Secretaria só consulta o cadastro: o
// prontuário (evolução, anamnese, relatórios, documentos, sugestões) não aparece para ela.
export const ABAS_FICHA_ALUNO = ['evolucao', 'documentos', 'anamnese', 'relatorios', 'sugestoes', 'consultas', 'dados'] as const
export type AbaFichaAluno = (typeof ABAS_FICHA_ALUNO)[number]

export function abasPermitidas(perfil: Perfil): readonly AbaFichaAluno[] {
  return perfil === 'SECRETARIA' ? ['dados'] : ABAS_FICHA_ALUNO
}

// A aba "Consultas" só aparece quando a pessoa tem alguma consulta avulsa.
export function abasDaFicha(perfil: Perfil, temConsultas: boolean): readonly AbaFichaAluno[] {
  return abasPermitidas(perfil).filter((a) => a !== 'consultas' || temConsultas)
}

// O único dado do aluno que a Secretaria grava: o número de quem ela chama pelo WhatsApp.
export const CAMPOS_ALUNO_SECRETARIA: readonly string[] = ['whatsapp']

export function soCamposDaSecretaria(campos: string[]): boolean {
  return campos.length > 0 && campos.every((c) => CAMPOS_ALUNO_SECRETARIA.includes(c))
}

// Travas para a direção trocar o tipo de acesso de alguém. Devolve a frase do motivo, ou null.
export function motivoParaNaoTrocarPerfil(p: {
  quemEditaId: string
  alvoId: string
  perfilAtual: Perfil
  perfilNovo: Perfil
  alunosVigentes: number
  contasDeDirecaoAtivas: number
}): string | null {
  if (p.perfilNovo === p.perfilAtual) return null
  if (p.quemEditaId === p.alvoId) return 'Você não pode trocar o seu próprio tipo de acesso.'
  if (p.perfilAtual === 'PROFISSIONAL' && p.alunosVigentes > 0) {
    return `Essa pessoa ainda atende ${p.alunosVigentes} ${p.alunosVigentes === 1 ? 'aluno' : 'alunos'}. Encerre ou transfira antes de trocar o tipo de acesso.`
  }
  if (p.perfilAtual === 'ADMIN' && p.contasDeDirecaoAtivas <= 1) {
    return 'Esta é a última conta da direção: ela não pode deixar de ser direção.'
  }
  return null
}

// Travas para a direção excluir um profissional (exclusão lógica: o histórico fica).
// Devolve a frase do motivo, ou null.
export function motivoParaNaoExcluir(p: {
  quemExcluiId: string
  alvoId: string
  perfilAlvo: Perfil
  alunosVigentes: number
  contasDeDirecaoAtivas: number
}): string | null {
  if (p.quemExcluiId === p.alvoId) return 'Você não pode excluir a sua própria conta.'
  if (p.alunosVigentes > 0) {
    return `Essa pessoa ainda atende ${p.alunosVigentes} ${p.alunosVigentes === 1 ? 'aluno' : 'alunos'}. Encerre ou transfira antes de excluir.`
  }
  if (p.perfilAlvo === 'ADMIN' && p.contasDeDirecaoAtivas <= 1) {
    return 'Esta é a última conta da direção: ela não pode ser excluída.'
  }
  return null
}
