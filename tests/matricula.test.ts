import { describe, it, expect } from 'vitest'
import { proximaMatricula, pendenciasDoAluno, rotuloSituacao, gerarMatriculaUnica } from '@/domain/matricula'

describe('matrícula', () => {
  it('começa em 0001 no ano', () => {
    expect(proximaMatricula(2026)).toBe('2026-0001')
  })
  it('incrementa a última do mesmo ano', () => {
    expect(proximaMatricula(2026, '2026-0041')).toBe('2026-0042')
  })
  it('reinicia a contagem ao virar o ano', () => {
    expect(proximaMatricula(2027, '2026-0157')).toBe('2027-0001')
  })
  it('vira a dezena sem perder o zero', () => {
    expect(proximaMatricula(2026, '2026-0009')).toBe('2026-0010')
  })
})

describe('pendências', () => {
  it('aponta o que falta preencher', () => {
    expect(pendenciasDoAluno({ cpf: null, responsavel: null, whatsapp: null }))
      .toEqual(['sem CPF', 'sem responsável', 'sem WhatsApp'])
  })
  it('não aponta nada quando está completo', () => {
    expect(pendenciasDoAluno({ cpf: '000', responsavel: 'Ana', whatsapp: '77' })).toEqual([])
  })
  it('aponta só o WhatsApp quando é o único que falta', () => {
    expect(pendenciasDoAluno({ cpf: '00000000000', responsavel: 'Ana', whatsapp: null }))
      .toEqual(['sem WhatsApp'])
  })
})

describe('rótulo da situação', () => {
  it('fala a língua da secretaria', () => {
    expect(rotuloSituacao('ESPERA')).toBe('Lista de espera')
    expect(rotuloSituacao('ATENDIMENTO')).toBe('Em atendimento')
    expect(rotuloSituacao('PAUSA')).toBe('Em pausa')
    expect(rotuloSituacao('ALTA')).toBe('Alta')
    expect(rotuloSituacao('DESLIGADO')).toBe('Desligado')
  })
})

describe('matrícula única com repetição', () => {
  const duplicada = () => {
    const e = { code: 'P2002', meta: { target: ['matricula'] } }
    throw e
  }
  it('tenta de novo quando a matrícula já foi usada', async () => {
    let chamadas = 0
    const usadas: string[] = []
    const r = await gerarMatriculaUnica(
      2026,
      async () => '2026-0041',
      async (m) => {
        chamadas++
        usadas.push(m)
        if (chamadas < 3) duplicada()
        return { matricula: m }
      },
    )
    expect(r).toEqual({ matricula: '2026-0042' })
    expect(chamadas).toBe(3)
    expect(usadas).toEqual(['2026-0042', '2026-0042', '2026-0042'])
  })
  it('desiste após 5 tentativas', async () => {
    let chamadas = 0
    await expect(
      gerarMatriculaUnica(2026, async () => '2026-0001', async () => {
        chamadas++
        duplicada()
      }),
    ).rejects.toThrow('Não consegui gerar a matrícula. Tente de novo.')
    expect(chamadas).toBe(5)
  })
  it('não tenta de novo quando o erro é outro', async () => {
    let chamadas = 0
    await expect(
      gerarMatriculaUnica(2026, async () => '2026-0001', async () => {
        chamadas++
        throw new Error('banco fora do ar')
      }),
    ).rejects.toThrow('banco fora do ar')
    expect(chamadas).toBe(1)
  })
})
