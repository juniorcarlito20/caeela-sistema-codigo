// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { gerarRelatorioPDF } from '@/lib/pdf/relatorio'
import { carregarLogos } from '@/lib/pdf/timbre'

describe('PDF do relatório com anexo de anamnese', () => {
  it('gera o PDF com e sem anexo, e o com anexo é maior', async () => {
    const logos = await carregarLogos()
    const base = {
      aluno: 'Aluno A', matricula: '2026-0001', periodo: 'outubro de 2026', area: 'Psicopedagogia',
      profissional: 'Profissional Teste', tipo: 'ACOMPANHAMENTO' as const,
      resumo: { total: 4, realizados: 3, faltas: 1, justificadas: 0, cancelados: 0 },
      texto: 'Texto do relatório.', codigo: 'ABC12345', geradoEm: new Date('2026-10-21T12:00:00Z'), logos,
    }
    const sem = await gerarRelatorioPDF(base)
    const com = await gerarRelatorioPDF({
      ...base,
      anexos: [{
        modelo: 'Modelo de Teste', autor: 'Profissional Teste', data: new Date('2026-10-20T12:00:00Z'),
        secoes: [{ titulo: 'Grupo A', linhas: [{ rotulo: '1. Item um', resposta: 'Bastante' }], resumo: ['Soma: 2 de 3'] }],
      }],
    })
    const comQuadro = await gerarRelatorioPDF({
      ...base,
      anexos: [{
        modelo: 'Modelo de Teste', autor: 'Profissional Teste', data: new Date('2026-10-20T12:00:00Z'),
        secoes: [{ titulo: 'Grupo A', linhas: [{ rotulo: '1. Item um', resposta: 'Bastante' }], resumo: ['Soma: 2 de 3'] }],
        quadro: {
          grupos: [
            { nome: 'Desatenção', total: 9, respondidas: 9, altos: 7, soma: 15, somaMaxima: 27, media: 1.67, minimo: 6, referencia: 'atingida' },
            { nome: 'Oposição', total: 8, respondidas: 8, altos: 2, soma: 6, somaMaxima: 24, media: 0.75, minimo: null, referencia: null },
          ],
          sintese: 'Referência atingida em: desatenção.',
        },
      }],
    })
    expect(comQuadro.subarray(0, 4).toString()).toBe('%PDF')
    expect(comQuadro.length).toBeGreaterThan(com.length)
    expect(sem.subarray(0, 4).toString()).toBe('%PDF')
    expect(com.subarray(0, 4).toString()).toBe('%PDF')
    expect(com.length).toBeGreaterThan(sem.length)
  }, 30000)
})
