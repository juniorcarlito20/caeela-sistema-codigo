// Regras puras da tela Consultas (psiquiatra e assistente social, que não seguem a agenda fixa).
import { TIPOS_AGENDA, type TipoAgenda } from './tipoAgenda'
import { podeVerRegistroClinico, type SessaoClinica, type TransferenciaVista } from './transferencia'

export type SessaoConsulta = { id: string; perfil: string }

export const PREFIXO_MATRICULA_EXTERNA = 'EXT-'
export const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/
export const REGEX_DIA = /^\d{4}-\d{2}-\d{2}$/

export const ROTULO_BLOCO: Record<string, string> = {
  AVULSA_DIRECAO: 'Agenda própria, com lembrete',
  AVULSA_PROPRIA: 'Agenda própria, sem lembrete',
}

export function tipoAgendaValido(valor: unknown): valor is TipoAgenda {
  return typeof valor === 'string' && (TIPOS_AGENDA as readonly string[]).includes(valor)
}

// Agenda avulsa = qualquer tipo que não seja a agenda fixa semanal.
export function agendaAvulsa(tipo: string | null | undefined): boolean {
  return !!tipo && tipo !== 'FIXA'
}

// Quem abre a tela Consultas: a direção, e o profissional de agenda avulsa.
export function podeVerConsultas(perfil: string, tipoAgenda: string | null | undefined): boolean {
  if (perfil === 'ADMIN') return true
  return perfil === 'PROFISSIONAL' && agendaAvulsa(tipoAgenda)
}

// Quem marca: a direção marca para qualquer profissional de agenda avulsa; o profissional só para si.
export function podeMarcarConsulta(
  sessao: SessaoConsulta,
  profissional: { id: string; tipoAgenda: string },
): boolean {
  if (!agendaAvulsa(profissional.tipoAgenda)) return false
  if (sessao.perfil === 'ADMIN') return true
  return sessao.perfil === 'PROFISSIONAL' && sessao.id === profissional.id
}

// Quem desmarca: a direção ou o próprio profissional da consulta.
export function podeDesmarcarConsulta(sessao: SessaoConsulta, profissionalId: string): boolean {
  if (sessao.perfil === 'ADMIN') return true
  return sessao.perfil === 'PROFISSIONAL' && sessao.id === profissionalId
}

// Matrícula das pessoas de fora: mesma ideia da dos alunos, com o prefixo EXT- (EXT-2026-0001).
// `ultima` é a última matrícula EXT- já gravada (ou nada).
export function proximaMatriculaExterna(ano: number, ultima?: string): string {
  const inicio = `${PREFIXO_MATRICULA_EXTERNA}${ano}-`
  const seq = ultima?.startsWith(inicio) ? Number(ultima.slice(inicio.length)) + 1 : 1
  return `${inicio}${String(Number.isFinite(seq) ? seq : 1).padStart(4, '0')}`
}

// "2026-11-03" -> "03/11"
export function diaMes(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Dia (AAAA-MM-DD) de um atendimento guardado ao meio-dia.
export function diaIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function diaValido(iso: string): boolean {
  if (!REGEX_DIA.test(iso)) return false
  const d = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

type Item = { data: Date; hora: string; situacao: string }

// "Última" = a consulta mais recente já feita (nem agendada, nem cancelada).
// "Próxima" = a primeira ainda agendada de hoje em diante.
export function resumoDaPessoa(
  atendimentos: Item[],
  hojeISO: string,
): { ultima: { dia: string; hora: string } | null; proxima: { dia: string; hora: string } | null } {
  const chave = (a: Item) => `${diaIso(a.data)} ${a.hora}`
  const feitas = atendimentos
    .filter((a) => a.situacao !== 'AGENDADO' && a.situacao !== 'CANCELADO')
    .sort((a, b) => chave(b).localeCompare(chave(a)))
  const futuras = atendimentos
    .filter((a) => a.situacao === 'AGENDADO' && diaIso(a.data) >= hojeISO)
    .sort((a, b) => chave(a).localeCompare(chave(b)))
  return {
    ultima: feitas[0] ? { dia: diaIso(feitas[0].data), hora: feitas[0].hora } : null,
    proxima: futuras[0] ? { dia: diaIso(futuras[0].data), hora: futuras[0].hora } : null,
  }
}

// Separa as consultas AGENDADO: de hoje em diante, e as pendentes (dias passados sem registro).
export function separarConsultas<T extends Item & { temRegistro?: boolean }>(
  agendadas: T[],
  hojeISO: string,
): { proximas: T[]; pendentes: T[] } {
  const chave = (a: Item) => `${diaIso(a.data)} ${a.hora}`
  const agendadasOrdenadas = agendadas
    .filter((a) => a.situacao === 'AGENDADO')
    .sort((a, b) => chave(a).localeCompare(chave(b)))
  return {
    proximas: agendadasOrdenadas.filter((a) => diaIso(a.data) >= hojeISO),
    pendentes: agendadasOrdenadas.filter((a) => diaIso(a.data) < hojeISO && !a.temRegistro),
  }
}

// Frase do Histórico: "Fulano com Dra. Beltrana em 03/11 às 14:00".
export function textoDaConsulta(pessoa: string, profissional: string, diaISO: string, hora: string): string {
  return `${pessoa} com ${profissional} em ${diaMes(diaISO)} às ${hora}`
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// "2026-11-03" -> "ter 03/11"
export function rotuloDia(iso: string): string {
  const semana = DIAS_CURTOS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
  return `${semana} ${diaMes(iso)}`
}

// Texto para achar pessoas: sem acento e em minúsculas; telefone só pelos números.
export function pessoaCombinaComBusca(
  p: { nome: string; matricula: string; whatsapp: string | null },
  busca: string,
  normalizar: (t: string) => string,
): boolean {
  const termo = normalizar(busca.trim())
  if (termo === '') return false
  const digitos = busca.replace(/\D/g, '')
  return (
    normalizar(p.nome).includes(termo) ||
    normalizar(p.matricula).includes(termo) ||
    (digitos.length >= 3 && (p.whatsapp ?? '').replace(/\D/g, '').includes(digitos))
  )
}

// ---- Registro da consulta (fase 8.3) ----

export const LIMITE_REGISTRO_CONSULTA = 100000

export const TIPOS_CONSULTA = ['CONSULTA_NO_CENTRO', 'VISITA_DOMICILIAR', 'TELEFONE', 'REUNIAO_REDE'] as const
export type TipoConsultaRegistro = (typeof TIPOS_CONSULTA)[number]

export const ROTULO_TIPO_CONSULTA: Record<TipoConsultaRegistro, string> = {
  CONSULTA_NO_CENTRO: 'Consulta no centro',
  VISITA_DOMICILIAR: 'Visita domiciliar',
  TELEFONE: 'Por telefone',
  REUNIAO_REDE: 'Reunião com a rede (CRAS, escola…)',
}

export const ENCAMINHAMENTOS = ['CRAS', 'CREAS', 'UBS', 'CONSELHO_TUTELAR', 'DEFENSORIA', 'OUTRO'] as const
export type Encaminhamento = (typeof ENCAMINHAMENTOS)[number]

// O que o formulário do registro oferece a cada profissional. O psiquiatra (consultas marcadas pela
// direção) atende no centro ou por telefone e não encaminha à rede: o que precisar, ele sugere à
// direção (aba Sugestões, como os outros). A assistente social faz visitas, reuniões com a rede e
// encaminha (CRAS, CREAS…).
export type CamposDoRegistro = {
  tipos: readonly TipoConsultaRegistro[]
  encaminhamentos: boolean
  exemploProximoPasso: string
}
export function camposDoRegistro(tipoAgenda: string | null | undefined): CamposDoRegistro {
  if (tipoAgenda === 'AVULSA_DIRECAO') {
    return {
      tipos: ['CONSULTA_NO_CENTRO', 'TELEFONE'],
      encaminhamentos: false,
      exemploProximoPasso: 'Ex.: reavaliar no retorno',
    }
  }
  return { tipos: TIPOS_CONSULTA, encaminhamentos: true, exemploProximoPasso: 'Ex.: levar o laudo ao CRAS' }
}

export const ROTULO_ENCAMINHAMENTO: Record<Encaminhamento, string> = {
  CRAS: 'CRAS',
  CREAS: 'CREAS',
  UBS: 'UBS/saúde',
  CONSELHO_TUTELAR: 'Conselho Tutelar',
  DEFENSORIA: 'Defensoria/jurídico',
  OUTRO: 'Outro',
}

export const ROTULO_SITUACAO_CONSULTA: Record<string, string> = {
  AGENDADO: 'Marcada',
  REALIZADO: 'Aconteceu',
  FALTOU: 'A pessoa faltou',
  JUSTIFICOU: 'Justificou',
  CANCELADO: 'Desmarcada',
}

// Só o profissional da consulta grava o registro. A direção só lê.
export function podeRegistrarConsulta(sessao: SessaoConsulta, profissionalId: string): boolean {
  return sessao.perfil === 'PROFISSIONAL' && sessao.id === profissionalId
}

// Quem lê o texto do registro: o autor, a direção e quem recebeu a pessoa por transferência
// (mesma regra das evoluções).
export function podeVerRegistroDeConsulta(
  sessao: SessaoClinica,
  registro: { autorId: string; criadoEm: Date },
  transferencias: TransferenciaVista[],
): boolean {
  return podeVerRegistroClinico(sessao, registro, transferencias)
}

// O retorno guarda dia e hora como relógio de parede em UTC ("2026-11-20T14:30:00Z"), para não
// depender do fuso do servidor.
export function retornoParaData(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00Z`)
}

export function retornoParaCampos(d: Date | null): { dia: string; hora: string } | null {
  if (!d) return null
  const iso = d.toISOString()
  return { dia: iso.slice(0, 10), hora: iso.slice(11, 16) }
}

export type ConsultaAnterior = {
  id: string
  autorId: string
  autorNome: string
  criadoEm: Date
  data: Date // dia da consulta
  hora: string
  tipo: string
  situacao: string
  presentes: string | null
  registro: string
  encaminhamentos: string[]
  proximoPasso: string | null
}

// As últimas consultas da pessoa com o mesmo profissional, para ler antes de registrar a nova:
// só as anteriores à consulta aberta, só as com texto, só as que quem abriu pode ver, da mais recente para a mais antiga.
export function ultimasConsultas(
  itens: ConsultaAnterior[],
  p: {
    sessao: SessaoClinica
    transferencias: TransferenciaVista[]
    antesDe: { data: Date; hora: string }
    limite?: number
  },
): ConsultaAnterior[] {
  const chave = (d: Date, h: string) => `${diaIso(d)} ${h}`
  const limiteChave = chave(p.antesDe.data, p.antesDe.hora)
  return itens
    .filter((c) => chave(c.data, c.hora) < limiteChave)
    .filter((c) => c.registro.trim() !== '')
    .filter((c) => podeVerRegistroDeConsulta(p.sessao, { autorId: c.autorId, criadoEm: c.criadoEm }, p.transferencias))
    .sort((a, b) => (chave(a.data, a.hora) < chave(b.data, b.hora) ? 1 : -1))
    .slice(0, p.limite ?? 3)
}
