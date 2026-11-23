import { describe, it, expect } from 'vitest'
import { linhasDasConsultas, type ConsultaParaLembrete } from '@/domain/lembrete'
import { PREFIXO_SEM_ATENDIMENTO } from '@/domain/diaSemAtendimento'

function consulta(extra: Partial<ConsultaParaLembrete> & { tipoAgenda?: string; deFora?: boolean; ativo?: boolean; excluido?: boolean } = {}): ConsultaParaLembrete {
  const { tipoAgenda = 'AVULSA_DIRECAO', deFora = false, ativo = true, excluido = false, ...resto } = extra
  return {
    id: 'a1',
    vinculoId: 'v1',
    hora: '14:00',
    situacao: 'AGENDADO',
    ausenciaId: null,
    observacao: null,
    lembrete: null,
    vinculo: {
      profissionalId: 'p1',
      aluno: { id: 'al1', nome: 'Pessoa Teste', responsavel: 'Responsável Teste', whatsapp: '(77) 99999-0000', deFora },
      profissional: { nome: 'Profissional Teste', tipoAgenda, ativo, excluidoEm: excluido ? new Date() : null },
      area: { nome: 'Psiquiatria' },
    },
    ...resto,
  }
}

describe('linhasDasConsultas', () => {
  it('inclui consulta AGENDADO de profissional AVULSA_DIRECAO', () => {
    const l = linhasDasConsultas([consulta()], { diaSemAtendimento: false })
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({
      vinculoId: 'v1', hora: '14:00', alunoId: 'al1', aluno: 'Pessoa Teste', profissionalId: 'p1',
      area: 'Psiquiatria', atendimentoId: 'a1', temZap: true, consulta: true, deFora: false,
    })
  })

  it('traz o estado do lembrete e marca pessoa de fora', () => {
    const enviadoEm = new Date('2026-11-03T10:00:00Z')
    const l = linhasDasConsultas(
      [consulta({ deFora: true, lembrete: { enviadoEm, confirmadoEm: null, resposta: 'VAI' } })],
      { diaSemAtendimento: false },
    )
    expect(l[0]).toMatchObject({ deFora: true, enviadoEm, resposta: 'VAI', confirmadoEm: null })
  })

  it('sem WhatsApp válido, temZap é falso', () => {
    const c = consulta()
    c.vinculo.aluno.whatsapp = null
    expect(linhasDasConsultas([c], { diaSemAtendimento: false })[0].temZap).toBe(false)
  })

  it('não inclui AVULSA_PROPRIA nem FIXA', () => {
    expect(linhasDasConsultas([consulta({ tipoAgenda: 'AVULSA_PROPRIA' })], { diaSemAtendimento: false })).toHaveLength(0)
    expect(linhasDasConsultas([consulta({ tipoAgenda: 'FIXA' })], { diaSemAtendimento: false })).toHaveLength(0)
  })

  it('não inclui profissional inativo nem excluído', () => {
    expect(linhasDasConsultas([consulta({ ativo: false })], { diaSemAtendimento: false })).toHaveLength(0)
    expect(linhasDasConsultas([consulta({ excluido: true })], { diaSemAtendimento: false })).toHaveLength(0)
  })

  it('não inclui consulta CANCELADO nem realizada', () => {
    expect(linhasDasConsultas([consulta({ situacao: 'CANCELADO', observacao: 'Desmarcada' })], { diaSemAtendimento: false })).toHaveLength(0)
    expect(linhasDasConsultas([consulta({ situacao: 'REALIZADO' })], { diaSemAtendimento: false })).toHaveLength(0)
  })

  it('em dia sem atendimento, entra a consulta cancelada pelo próprio dia (vira aviso)', () => {
    const c = consulta({ situacao: 'CANCELADO', observacao: `${PREFIXO_SEM_ATENDIMENTO}Feriado` })
    expect(linhasDasConsultas([c], { diaSemAtendimento: true })).toHaveLength(1)
    expect(linhasDasConsultas([consulta()], { diaSemAtendimento: true })).toHaveLength(1)
  })

  it('em dia sem atendimento, não entra a desmarcada à mão nem a cancelada por ausência', () => {
    expect(linhasDasConsultas([consulta({ situacao: 'CANCELADO', observacao: 'Desmarcada' })], { diaSemAtendimento: true })).toHaveLength(0)
    const porAusencia = consulta({ situacao: 'CANCELADO', observacao: `${PREFIXO_SEM_ATENDIMENTO}Feriado`, ausenciaId: 'au1' })
    expect(linhasDasConsultas([porAusencia], { diaSemAtendimento: true })).toHaveLength(0)
  })

  it('não duplica: chave já presente nos horários fixos ou repetida', () => {
    const fixas = new Set(['v1-14:00'])
    expect(linhasDasConsultas([consulta()], { diaSemAtendimento: false, chavesJaNaTela: fixas })).toHaveLength(0)
    const repetida = [consulta(), consulta({ id: 'a2' })]
    expect(linhasDasConsultas(repetida, { diaSemAtendimento: false })).toHaveLength(1)
    const outraHora = [consulta(), consulta({ id: 'a2', hora: '15:00' })]
    expect(linhasDasConsultas(outraHora, { diaSemAtendimento: false })).toHaveLength(2)
  })
})
