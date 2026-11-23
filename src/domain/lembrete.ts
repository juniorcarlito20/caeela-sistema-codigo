import { randomBytes } from 'node:crypto'
import { PREFIXO_SEM_ATENDIMENTO } from './diaSemAtendimento'

export function normalizarTelefone(bruto: string): string | null {
  const d = bruto.replace(/\D/g, '')
  if (d.length < 10) return null
  return d.startsWith('55') ? d : `55${d}`
}

// timeZone UTC de propósito: o dia do atendimento é o mesmo em qualquer servidor, sem
// depender do fuso da máquina.
const diaMes = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })

// "hoje, dia 09/10", "amanhã, dia 10/10" ou "segunda-feira, dia 12/10". Sem saber que dia é
// hoje, mantém "amanhã" (o lembrete nasceu para a véspera).
function quandoE(data: Date, hojeISO?: string): string {
  const dia = diaMes(data)
  if (!hojeISO) return `amanhã, dia ${dia}`
  const iso = data.toISOString().slice(0, 10)
  if (iso === hojeISO) return `hoje, dia ${dia}`
  const amanha = new Date(`${hojeISO}T12:00:00Z`)
  amanha.setUTCDate(amanha.getUTCDate() + 1)
  if (iso === amanha.toISOString().slice(0, 10)) return `amanhã, dia ${dia}`
  return `${data.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long' })}, dia ${dia}`
}

export function montarMensagem(d: {
  responsavel: string | null; aluno: string; data: Date; hora: string
  profissional: string; area: string; url: string
  hojeISO?: string
}): string {
  const saudacao = d.responsavel ? `Olá, ${d.responsavel}!` : 'Olá!'
  return [
    saudacao,
    `Lembrete do CAEELA: ${d.aluno} tem atendimento ${quandoE(d.data, d.hojeISO)}, às ${d.hora}, com ${d.profissional} (${d.area}).`,
    `Confirme a presença: ${d.url}`,
    'Qualquer dúvida, estamos à disposição.',
  ].join('\n\n')
}

// Aviso de dia sem atendimento (feriado, decreto…): sem link de confirmação, com o próximo
// atendimento quando dá para saber.
export function montarAvisoSemAtendimento(d: {
  responsavel: string | null; aluno: string; data: Date; motivo: string; profissional: string
  proximo: { data: Date; hora: string } | null
}): string {
  const saudacao = d.responsavel ? `Olá, ${d.responsavel}!` : 'Olá!'
  return [
    saudacao,
    `Aviso do CAEELA: dia ${diaMes(d.data)} não haverá atendimento (${d.motivo}).`,
    d.proximo
      ? `O próximo atendimento de ${d.aluno} com ${d.profissional} é dia ${diaMes(d.proximo.data)}, às ${d.proximo.hora}.`
      : `Avisaremos a data do próximo atendimento de ${d.aluno}.`,
    'Qualquer dúvida, estamos à disposição.',
  ].join('\n\n')
}

export const linkWhatsApp = (telefone: string, mensagem: string) =>
  `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`

// Token do link de confirmação: 16 bytes aleatórios em base64url.
// Nada de id sequencial nem Math.random: o link expõe dados de criança.
export function gerarToken(): string {
  return randomBytes(16).toString('base64url')
}

export function primeiroNome(nome: string | null): string {
  return (nome ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? ''
}

// Resposta da família no link do WhatsApp: só um aviso para a equipe, nunca
// muda a situação do atendimento (quem decide é sempre a equipe, na tela).
export function respostaDaFamilia(resposta: 'sim' | 'nao'): 'VAI' | 'NAO_VAI' {
  return resposta === 'sim' ? 'VAI' : 'NAO_VAI'
}

// Agrupa as linhas do dia por profissional. Dentro do grupo, por hora; os grupos ficam na ordem
// do PRIMEIRO horário do dia (empate: nome).
export function agruparPorProfissional<T extends { profissionalId: string; profissional: string; area: string; hora: string }>(
  linhas: T[],
): { profissionalId: string; profissional: string; area: string; linhas: T[] }[] {
  const mapa = new Map<string, { profissionalId: string; profissional: string; area: string; linhas: T[] }>()
  for (const l of linhas) {
    let g = mapa.get(l.profissionalId)
    if (!g) {
      g = { profissionalId: l.profissionalId, profissional: l.profissional, area: l.area, linhas: [] }
      mapa.set(l.profissionalId, g)
    }
    g.linhas.push(l)
  }
  const grupos = [...mapa.values()]
  for (const g of grupos) g.linhas.sort((a, b) => a.hora.localeCompare(b.hora))
  return grupos.sort(
    (a, b) => a.linhas[0].hora.localeCompare(b.linhas[0].hora) || a.profissional.localeCompare(b.profissional, 'pt-BR'),
  )
}

// Consulta avulsa (atendimento com `avulso: true`) como o banco devolve, com o que a tela precisa.
export type ConsultaParaLembrete = {
  id: string
  vinculoId: string
  hora: string
  situacao: string
  ausenciaId: string | null
  observacao: string | null
  lembrete: { enviadoEm: Date | null; confirmadoEm: Date | null; resposta: string | null } | null
  vinculo: {
    profissionalId: string
    aluno: { id: string; nome: string; responsavel: string | null; whatsapp: string | null; deFora: boolean }
    profissional: { nome: string; tipoAgenda: string; ativo: boolean; excluidoEm: Date | null }
    area: { nome: string }
  }
}

// Linhas da tela de Lembretes para as consultas do dia. Entram só as consultas de profissional
// com agenda marcada pela direção (AVULSA_DIRECAO), ativo e fora da lixeira: as da agenda própria
// (AVULSA_PROPRIA) não são lembradas por aqui. Entra a consulta AGENDADO; a CANCELADO só entra
// quando foi o próprio "dia sem atendimento" que a cancelou (aí a tela vira aviso). Desmarcada à
// mão ou cancelada por ausência do profissional, não. `chavesJaNaTela` ("vinculoId-hora" dos
// horários fixos) evita mostrar a mesma linha duas vezes.
export function linhasDasConsultas(
  consultas: ConsultaParaLembrete[],
  opcoes: { diaSemAtendimento: boolean; chavesJaNaTela?: Set<string> },
) {
  const vistas = new Set(opcoes.chavesJaNaTela ?? [])
  const linhas = []
  for (const c of consultas) {
    const p = c.vinculo.profissional
    if (p.tipoAgenda !== 'AVULSA_DIRECAO' || !p.ativo || p.excluidoEm) continue
    const canceladaPeloDia =
      opcoes.diaSemAtendimento &&
      c.situacao === 'CANCELADO' &&
      c.ausenciaId === null &&
      (c.observacao ?? '').startsWith(PREFIXO_SEM_ATENDIMENTO)
    if (c.situacao !== 'AGENDADO' && !canceladaPeloDia) continue
    const chave = `${c.vinculoId}-${c.hora}`
    if (vistas.has(chave)) continue
    vistas.add(chave)
    const a = c.vinculo.aluno
    linhas.push({
      vinculoId: c.vinculoId,
      hora: c.hora,
      alunoId: a.id,
      aluno: a.nome,
      responsavel: a.responsavel,
      whatsapp: a.whatsapp,
      temZap: a.whatsapp ? normalizarTelefone(a.whatsapp) !== null : false,
      profissionalId: c.vinculo.profissionalId,
      profissional: p.nome,
      area: c.vinculo.area.nome,
      atendimentoId: c.id as string | null,
      enviadoEm: c.lembrete?.enviadoEm ?? null,
      confirmadoEm: c.lembrete?.confirmadoEm ?? null,
      resposta: c.lembrete?.resposta ?? null,
      situacao: c.situacao as string | null,
      consulta: true,
      deFora: a.deFora,
    })
  }
  return linhas
}
