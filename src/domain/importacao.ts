export type LinhaAgenda = {
  profissional: string
  area: string | null
  diaSemana: number
  hora: string
  aluno: string
  cpf: string | null
  responsavel: string | null
  whatsapp: string | null
  grupo: string | null
  local: string | null
  cicloSemanas?: number
  cicloOffset?: number
}

const DIAS: Record<string, number> = {
  'SEGUNDA': 1, 'TERÇA': 2, 'TERCA': 2, 'QUARTA': 3, 'QUINTA': 4, 'SEXTA': 5,
}
// Chaves longas primeiro: a busca é por inclusão, então 'FISIO' não pode
// passar na frente de 'FISIOTERAPEUTA'.
const AREAS: Record<string, string> = {
  'PSICOPEDAGOGIA AEE': 'Psicopedagogia AEE',
  'PSICOPEDAGOGIA CLÍNICA': 'Psicopedagogia Clínica',
  'PSICOPEDAGOGIA CLINICA': 'Psicopedagogia Clínica',
  'ASSISTÊNCIA TERAPÊUTICA': 'Assistência Terapêutica',
  'ASSISTENCIA TERAPEUTICA': 'Assistência Terapêutica',
  'TERAPIA OCUPACIONAL': 'Terapia Ocupacional',
  'SERVIÇO SOCIAL': 'Serviço Social',
  'SERVICO SOCIAL': 'Serviço Social',
  'PSICOPEDAGOGIA': 'Psicopedagogia AEE',
  'PSICOPEDAGOGA': 'Psicopedagogia AEE',
  'FISIOTERAPEUTA': 'Fisioterapia', 'FISIOTERAPIA': 'Fisioterapia',
  'FONOAUDIOLOGA': 'Fonoaudiologia', 'FONOAUDIÓLOGA': 'Fonoaudiologia',
  'FONOAUDIOLOGO': 'Fonoaudiologia', 'FONOAUDIÓLOGO': 'Fonoaudiologia',
  'FONOAUDIOLOGIA': 'Fonoaudiologia',
  'NUTRICIONISTA': 'Nutrição', 'NUTRICINISTA': 'Nutrição',
  'NUTRIÇÃO': 'Nutrição', 'NUTRICAO': 'Nutrição',
  'PSICOLOGA': 'Psicologia', 'PSICÓLOGA': 'Psicologia',
  'PSICOLOGIA': 'Psicologia',
  'NEUROPEDIATRIA': 'Neuropediatria',
  'PSIQUIATRIA': 'Psiquiatria',
  'MASSOTERAPIA': 'Massoterapia',
  'LIBRAS': 'Libras',
  'FISIO': 'Fisioterapia',
  'A T': 'Assistência Terapêutica', 'A.T.': 'Assistência Terapêutica',
}

const capitalizar = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()).trim()

// Pontos viram espaço e espaços extras colapsam, dos dois lados da comparação
// de área — assim "A T", "A.T." e "A. T." valem o mesmo sem caçar variantes.
const semPontos = (s: string) => s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()

export type CabecalhoTabela = {
  diaSemana: number
  profissional: string
  area: string | null
  grupo: string | null
  local: string | null
}

export function interpretarCabecalho(texto: string): CabecalhoTabela | null {
  const t = texto.replace(/\s+/g, ' ').trim().toUpperCase()
  const m = t.match(/^\(([\p{L}]+?)[ -]?FEIRA\)\s*(.+)$/u)
  if (!m) return null
  const diaSemana = DIAS[m[1]]
  if (!diaSemana) return null
  let resto = semPontos(m[2])
  const grupoMatch = resto.match(/GRUPO\s*(\d+)/)
  const grupo = grupoMatch ? `Grupo ${grupoMatch[1].padStart(2, '0')}` : null
  if (grupoMatch) resto = resto.replace(/GRUPO\s*\d+.*/, '').trim()
  // Formato novo: NOME – ESPECIALIDADE – LOCAL (traços com espaço).
  // Formato antigo: NOME ESPECIALIDADE (sem traço, só o primeiro nome vale).
  const partes = resto.split(/\s+[–—-]\s*/).map((p) => p.trim()).filter(Boolean)
  const comTraco = partes.length > 1
  const buscaArea = comTraco ? partes.slice(1).join(' ') : resto
  let area: string | null = null
  for (const [chave, valor] of Object.entries(AREAS)) {
    if (semPontos(buscaArea).includes(semPontos(chave))) { area = valor; break }
  }
  let profissional: string
  let local: string | null
  if (comTraco) {
    profissional = capitalizar(partes[0])
    local = partes.slice(2).join(' – ') || null
  } else {
    let nome = resto
    for (const chave of Object.keys(AREAS)) {
      const alvo = semPontos(chave)
      if (semPontos(nome).includes(alvo)) { nome = semPontos(nome).replace(alvo, '').trim(); break }
    }
    profissional = capitalizar(nome.split(' ')[0] ?? '')
    local = null
  }
  return { diaSemana, profissional, area, grupo, local }
}

// Formato das últimas páginas da planilha: não há "(DIA-FEIRA) NOME – ESPECIALIDADE".
// O título vem em parágrafos soltos antes da tabela, nesta ordem:
//   "CONSULTA COM A FONOAUDIÓLOGA" / "SEGUNDA-FEIRA" / "NOME COMPLETO" / ["GRUPO 1"]
// Recebe só os parágrafos de nível de página (nunca os de dentro de células).
export function interpretarContextoConsulta(paragrafos: string[]): CabecalhoTabela | null {
  const linhas = paragrafos.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const consulta = linhas[0]?.toUpperCase().match(/^CONSULTA COM (?:A |O )?(.+)$/)
  if (!consulta) return null
  let area: string | null = null
  for (const [chave, valor] of Object.entries(AREAS)) {
    if (semPontos(consulta[1]).includes(semPontos(chave))) { area = valor; break }
  }
  const resto = linhas.slice(1)
  let diaSemana = 0
  for (const l of resto) {
    const m = l.toUpperCase().match(/(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA)/)
    if (m) { diaSemana = DIAS[m[1]]; break }
  }
  let grupo: string | null = null
  for (const l of resto) {
    grupo = interpretarContinuacaoDeGrupo(l)
    if (grupo) break
  }
  const nome = resto.find(
    (l) =>
      /^\p{Lu}[\p{Lu}.]*( \p{Lu}[\p{Lu}.]*)+$/u.test(l) &&
      !/FEIRA|GRUPO|CONSULTA|MATUTINO|VESPERTINO/i.test(l),
  )
  if (!diaSemana || !nome) return null
  return { diaSemana, profissional: capitalizar(nome), area, grupo, local: null }
}

// Sub-tabela de rotação: título abreviado com só o número do grupo
// ("GRUPO 1", "GRUPO 02"), sem dia nem profissional — continua a última
// tabela completa, herdando dia, profissional e área dela.
export function interpretarContinuacaoDeGrupo(texto: string): string | null {
  const m = texto.replace(/\s+/g, ' ').trim().toUpperCase().match(/^GRUPO\s*0?(\d+)\s*$/)
  if (!m) return null
  return `Grupo ${m[1].padStart(2, '0')}`
}

export function normalizarHora(bruto: string): string | null {
  const t = bruto.trim()
  if (!t) return null
  const hm = t.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})?/i)
  if (!hm) return null
  return `${hm[1].padStart(2, '0')}:${(hm[2] ?? '0').padStart(2, '0')}`
}

export function normalizarCPF(bruto: string): string | null {
  const d = bruto.replace(/\D/g, '')
  return d.length === 11 ? d : null
}

// Nome para achar duplicado: sem acento, minúsculo, espaços colapsados.
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
