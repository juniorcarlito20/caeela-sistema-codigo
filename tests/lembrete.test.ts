import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { montarMensagem, montarAvisoSemAtendimento, linkWhatsApp, normalizarTelefone, gerarToken, respostaDaFamilia } from '@/domain/lembrete'

describe('telefone', () => {
  it('normaliza para o formato internacional', () => {
    expect(normalizarTelefone('(77) 99144-8391')).toBe('5577991448391')
  })
  it('devolve nulo para número incompleto', () => {
    expect(normalizarTelefone('9914')).toBeNull()
  })
  it('não duplica o 55 de quem já mandou com código do país', () => {
    expect(normalizarTelefone('5577991448391')).toBe('5577991448391')
  })
  it('limpa espaços, traços e parênteses', () => {
    expect(normalizarTelefone('(77) 9 9144-8391')).toBe('5577991448391')
  })
})

describe('mensagem', () => {
  const dados = {
    responsavel: 'Cláudia', aluno: 'Pedro', data: new Date('2026-09-23'),
    hora: '08:50', profissional: 'Profissional Teste', area: 'Psicologia',
    url: 'https://caeela.app/confirmar/x7k2',
  }
  it('traz aluno, dia, hora, profissional e link', () => {
    const m = montarMensagem(dados)
    expect(m).toContain('Cláudia')
    expect(m).toContain('Pedro')
    expect(m).toContain('23/09')
    expect(m).toContain('08:50')
    expect(m).toContain('Profissional Teste')
    expect(m).toContain('https://caeela.app/confirmar/x7k2')
  })
  it('gera link do WhatsApp com a mensagem codificada', () => {
    const link = linkWhatsApp('5577991448391', 'Olá, Cláudia!')
    expect(link).toBe('https://wa.me/5577991448391?text=Ol%C3%A1%2C%20Cl%C3%A1udia!')
  })
  it('sem responsável começa com Olá e sem undefined', () => {
    const m = montarMensagem({ ...dados, responsavel: null })
    expect(m.startsWith('Olá!')).toBe(true)
    expect(m).not.toContain('undefined')
  })
})

describe('token do link', () => {
  it('gera tokens únicos de ao menos 16 bytes em base64url', () => {
    const a = gerarToken()
    const b = gerarToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(Buffer.from(a, 'base64url').length).toBeGreaterThanOrEqual(16)
  })
})

describe('resposta da família (só avisa, nunca decide)', () => {
  it('traduz sim/nao para VAI/NAO_VAI', () => {
    expect(respostaDaFamilia('sim')).toBe('VAI')
    expect(respostaDaFamilia('nao')).toBe('NAO_VAI')
  })
  it('a rota de confirmação nunca toca na situação do atendimento', () => {
    const fonte = readFileSync('src/app/api/confirmar/[token]/route.ts', 'utf-8')
    expect(fonte).not.toMatch(/prisma\.atendimento\.update/)
    expect(fonte).not.toMatch(/JUSTIFICOU/)
    expect(fonte).toMatch(/respostaDaFamilia/)
  })
})

describe('quando é o atendimento (hoje, amanhã ou dia da semana)', () => {
  const base = {
    responsavel: 'Responsável Teste', aluno: 'Aluno A', hora: '08:50', profissional: 'Profissional Teste',
    area: 'Fonoaudiologia', url: 'https://caeela.app/confirmar/x',
  }
  const dia = (iso: string) => new Date(`${iso}T12:00:00Z`)
  it('sem informar o dia de hoje continua dizendo amanhã (como antes)', () => {
    expect(montarMensagem({ ...base, data: dia('2026-10-12') })).toContain('tem atendimento amanhã, dia 12/10')
  })
  it('atendimento de amanhã', () => {
    expect(montarMensagem({ ...base, data: dia('2026-10-10'), hojeISO: '2026-10-09' })).toContain('amanhã, dia 10/10')
  })
  it('atendimento de hoje', () => {
    expect(montarMensagem({ ...base, data: dia('2026-10-09'), hojeISO: '2026-10-09' })).toContain('hoje, dia 09/10')
  })
  it('na sexta, o lembrete de segunda diz segunda-feira (e não amanhã)', () => {
    const m = montarMensagem({ ...base, data: dia('2026-10-12'), hojeISO: '2026-10-09' })
    expect(m).toContain('segunda-feira, dia 12/10')
    expect(m).not.toContain('amanhã')
  })
})

describe('aviso de dia sem atendimento', () => {
  const dia = (iso: string) => new Date(`${iso}T12:00:00Z`)
  const base = { responsavel: 'Responsável Teste', aluno: 'Aluno A', data: dia('2026-10-12'), motivo: 'Feriado municipal', profissional: 'Profissional Teste' }
  it('diz o dia, o motivo e o próximo atendimento, sem link de confirmação', () => {
    const m = montarAvisoSemAtendimento({ ...base, proximo: { data: dia('2026-10-19'), hora: '08:50' } })
    expect(m).toContain('dia 12/10 não haverá atendimento (Feriado municipal)')
    expect(m).toContain('O próximo atendimento de Aluno A com Profissional Teste é dia 19/10, às 08:50.')
    expect(m).not.toContain('confirmar')
    expect(m).not.toContain('http')
  })
  it('sem próxima data conhecida não inventa', () => {
    const m = montarAvisoSemAtendimento({ ...base, proximo: null })
    expect(m).toContain('Avisaremos a data do próximo atendimento de Aluno A.')
  })
  it('sem responsável começa com Olá', () => {
    expect(montarAvisoSemAtendimento({ ...base, responsavel: null, proximo: null }).startsWith('Olá!')).toBe(true)
  })
})
