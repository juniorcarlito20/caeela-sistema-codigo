import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Campo } from '@/domain/anamnese'

// Redação do Anexo 1 de Mattos et al., Rev Psiquiatr RS 2006;28(3):290-7 (ortografia atualizada).
// Este teste trava o texto: não "corrija" a redação sem a profissional.
const ITENS = [
  '1. Não consegue prestar muita atenção a detalhes ou comete erros por descuido nos trabalhos da escola ou tarefas',
  '2. Tem dificuldade de manter a atenção em tarefas ou atividades de lazer',
  '3. Parece não estar ouvindo quando se fala diretamente com ele',
  '4. Não segue instruções até o fim e não termina deveres da escola, tarefas ou obrigações',
  '5. Tem dificuldade para organizar tarefas e atividades',
  '6. Evita, não gosta ou se envolve contra a vontade em tarefas que exigem esforço mental prolongado',
  '7. Perde coisas necessárias para atividades (por exemplo: brinquedos, deveres da escola, lápis ou livros)',
  '8. Distrai-se com estímulos externos',
  '9. É esquecido em atividades do dia a dia',
  '10. Mexe com as mãos ou os pés ou se remexe na cadeira',
  '11. Sai do lugar na sala de aula ou em outras situações em que se espera que fique sentado',
  '12. Corre de um lado para outro ou sobe demais nas coisas em situações em que isto é inapropriado',
  '13. Tem dificuldade em brincar ou envolver-se em atividades de lazer de forma calma',
  '14. Não para ou frequentemente está a “mil por hora”',
  '15. Fala em excesso',
  '16. Responde as perguntas de forma precipitada antes de elas terem sido terminadas',
  '17. Tem dificuldade de esperar sua vez',
  '18. Interrompe os outros ou se intromete (por exemplo, mete-se nas conversas/jogos)',
  '19. Descontrola-se',
  '20. Discute com adultos',
  '21. Desafia ativamente ou se recusa a atender pedidos ou regras de adultos',
  '22. Faz coisas de propósito que incomodam outras pessoas',
  '23. Culpa os outros pelos seus erros ou mau comportamento',
  '24. É irritável ou facilmente incomodado pelos outros',
  '25. É zangado e ressentido',
  '26. É maldoso ou vingativo',
]

const modelo = JSON.parse(readFileSync(join('src', 'db', 'modelos', 'snap-iv.json'), 'utf-8')) as {
  nome: string
  area?: string | null
  campos: Campo[]
}
const itens = modelo.campos.filter((c) => c.tipo === 'escala')

describe('modelo SNAP-IV (26 itens)', () => {
  it('tem o nome certo e não prende a uma área (serve a todos)', () => {
    expect(modelo.nome).toBe('Escala SNAP-IV (26 itens)')
    expect(modelo.area ?? null).toBeNull()
  })
  it('tem os 26 itens, na ordem e com a redação do instrumento', () => {
    expect(itens.map((c) => c.rotulo)).toEqual(ITENS)
  })
  it('cada item tem as 4 respostas, na ordem que vale 0 a 3', () => {
    for (const c of itens) {
      expect(c.opcoes, c.id).toEqual(['Nem um pouco', 'Só um pouco', 'Bastante', 'Demais'])
    }
  })
  it('os grupos têm 9, 9 e 8 itens, cada um com o seu resumo', () => {
    const grupos = modelo.campos.filter((c) => c.tipo === 'resumo')
    expect(grupos.map((g) => g.secao)).toEqual([
      'Desatenção (itens 1 a 9)',
      'Hiperatividade e impulsividade (itens 10 a 18)',
      'Oposição e desafio (itens 19 a 26)',
    ])
    expect(grupos.map((g) => itens.filter((c) => c.secao === g.secao).length)).toEqual([9, 9, 8])
  })
  it('a referência de 6 itens vale só para desatenção e hiperatividade', () => {
    const [d, h, o] = modelo.campos.filter((c) => c.tipo === 'resumo')
    expect(d.minimo).toBe(6)
    expect(h.minimo).toBe(6)
    expect(o.minimo).toBeUndefined()
  })
  it('os ids são únicos e a seção de aplicação pede data e quem respondeu', () => {
    const ids = modelo.campos.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('data_aplicacao')
    expect(ids).toContain('quem_respondeu')
    expect(modelo.campos.some((c) => c.tipo === 'aviso')).toBe(true)
  })
})
