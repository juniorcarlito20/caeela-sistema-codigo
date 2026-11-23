// tests/acesso.test.ts
import { describe, it, expect } from 'vitest'
import {
  paginaInicial, secretariaPodeAbrir, abasPermitidas, abasDaFicha, soCamposDaSecretaria, motivoParaNaoTrocarPerfil, ROTULO_PERFIL,
} from '@/domain/acesso'

describe('paginaInicial', () => {
  it('cada perfil começa na sua tela', () => {
    expect(paginaInicial('ADMIN')).toBe('/painel')
    expect(paginaInicial('PROFISSIONAL')).toBe('/agenda')
    expect(paginaInicial('SECRETARIA')).toBe('/lembretes')
  })
  it('rótulos', () => {
    expect(ROTULO_PERFIL.SECRETARIA).toBe('Secretaria')
  })
})

describe('secretariaPodeAbrir — páginas', () => {
  it.each(['/', '/lembretes', '/equipe', '/equipe/abc123', '/busca', '/trocar-senha', '/alunos', '/alunos/abc123'])('libera %s', (c) => {
    expect(secretariaPodeAbrir(c, 'GET')).toBe(true)
  })
  it.each([
    '/painel', '/painel/grade', '/alunos/novo', '/alunos/novo/', '/alunos/abc/anamnese/xyz', '/alunos/abc/qualquer',
    '/profissionais', '/profissionais/abc',
    '/agendas', '/agenda', '/registro-acessos', '/lixeira', '/conflitos', '/ausencias', '/atendimento/abc',
    '/anamneses', '/equipe/abc/outra',
  ])('barra %s', (c) => {
    expect(secretariaPodeAbrir(c, 'GET')).toBe(false)
  })
  it('as ações de servidor (POST) das páginas liberadas também passam (ex.: Sair, trocar senha)', () => {
    expect(secretariaPodeAbrir('/lembretes', 'POST')).toBe(true)
    expect(secretariaPodeAbrir('/trocar-senha', 'POST')).toBe(true)
  })
})

describe('secretariaPodeAbrir — API', () => {
  it('libera só o que ela usa, com o método certo', () => {
    expect(secretariaPodeAbrir('/api/lembretes', 'POST')).toBe(true)
    expect(secretariaPodeAbrir('/api/atendimentos', 'POST')).toBe(true)
    expect(secretariaPodeAbrir('/api/alunos/abc', 'PATCH')).toBe(true)
    expect(secretariaPodeAbrir('/api/busca', 'GET')).toBe(true)
  })
  it('marca e desmarca dia sem atendimento', () => {
    expect(secretariaPodeAbrir('/api/dias-sem-atendimento', 'POST')).toBe(true)
    expect(secretariaPodeAbrir('/api/dias-sem-atendimento', 'DELETE')).toBe(true)
    expect(secretariaPodeAbrir('/api/dias-sem-atendimento', 'GET')).toBe(false)
  })
  it('barra método trocado e rotas vizinhas', () => {
    expect(secretariaPodeAbrir('/api/alunos/abc', 'GET')).toBe(false)
    expect(secretariaPodeAbrir('/api/alunos/abc', 'DELETE')).toBe(false)
    expect(secretariaPodeAbrir('/api/alunos', 'POST')).toBe(false)
    expect(secretariaPodeAbrir('/api/alunos/abc/pausa', 'PATCH')).toBe(false)
    expect(secretariaPodeAbrir('/api/atendimentos/abc', 'PATCH')).toBe(false)
    expect(secretariaPodeAbrir('/api/horarios/abc', 'PATCH')).toBe(false)
    expect(secretariaPodeAbrir('/api/vinculos', 'POST')).toBe(false)
    expect(secretariaPodeAbrir('/api/evolucoes', 'POST')).toBe(false)
    expect(secretariaPodeAbrir('/api/documentos', 'POST')).toBe(false)
    expect(secretariaPodeAbrir('/api/arquivos/x/y', 'GET')).toBe(false)
    expect(secretariaPodeAbrir('/api/presencas/mensal', 'GET')).toBe(false)
    expect(secretariaPodeAbrir('/api/backup/baixar', 'GET')).toBe(false)
  })

  it('não libera horário de aluno', () => {
    expect(secretariaPodeAbrir('/api/horarios/abc', 'DELETE')).toBe(false)
  })

  it('não abre as sugestões à direção (página nem rotas)', () => {
    expect(secretariaPodeAbrir('/sugestoes', 'GET')).toBe(false)
    expect(secretariaPodeAbrir('/api/sugestoes', 'POST')).toBe(false)
    expect(secretariaPodeAbrir('/api/sugestoes/abc', 'PATCH')).toBe(false)
  })
})

describe('abasPermitidas', () => {
  it('a Secretaria só consulta o cadastro: aba Dados', () => {
    expect(abasPermitidas('SECRETARIA')).toEqual(['dados'])
  })
  it('Direção e Profissional têm todas as abas', () => {
    for (const perfil of ['ADMIN', 'PROFISSIONAL'] as const) {
      expect([...abasPermitidas(perfil)].sort()).toEqual(
        ['anamnese', 'consultas', 'dados', 'documentos', 'evolucao', 'relatorios', 'sugestoes'],
      )
    }
  })
})

describe('abasDaFicha', () => {
  it('a aba Consultas só aparece quando há consulta avulsa', () => {
    expect(abasDaFicha('PROFISSIONAL', false)).not.toContain('consultas')
    expect(abasDaFicha('PROFISSIONAL', true)).toContain('consultas')
    expect(abasDaFicha('ADMIN', true)).toContain('consultas')
  })
  it('a Secretaria nunca vê a aba Consultas', () => {
    expect(abasDaFicha('SECRETARIA', true)).toEqual(['dados'])
    expect(abasDaFicha('SECRETARIA', false)).toEqual(['dados'])
  })
})

describe('soCamposDaSecretaria', () => {
  it('só o WhatsApp', () => {
    expect(soCamposDaSecretaria(['whatsapp'])).toBe(true)
    expect(soCamposDaSecretaria(['whatsapp', 'nome'])).toBe(false)
    expect(soCamposDaSecretaria(['responsavel'])).toBe(false)
    expect(soCamposDaSecretaria([])).toBe(false)
  })
})

describe('motivoParaNaoTrocarPerfil', () => {
  const base = {
    quemEditaId: 'd1', alvoId: 'u1', perfilAtual: 'PROFISSIONAL' as const, perfilNovo: 'SECRETARIA' as const,
    alunosVigentes: 0, contasDeDirecaoAtivas: 2,
  }
  it('libera a troca comum', () => {
    expect(motivoParaNaoTrocarPerfil(base)).toBeNull()
  })
  it('ninguém troca o próprio tipo', () => {
    expect(motivoParaNaoTrocarPerfil({ ...base, alvoId: 'd1' })).toMatch(/próprio/)
  })
  it('profissional com aluno vigente continua profissional', () => {
    expect(motivoParaNaoTrocarPerfil({ ...base, alunosVigentes: 3 })).toMatch(/3 alunos/)
  })
  it('a última conta de direção não deixa de ser direção', () => {
    expect(motivoParaNaoTrocarPerfil({ ...base, perfilAtual: 'ADMIN', contasDeDirecaoAtivas: 1 })).toMatch(/direção/)
    expect(motivoParaNaoTrocarPerfil({ ...base, perfilAtual: 'ADMIN', contasDeDirecaoAtivas: 2 })).toBeNull()
  })
  it('sem mudança, sem trava', () => {
    expect(motivoParaNaoTrocarPerfil({ ...base, perfilNovo: 'PROFISSIONAL', alunosVigentes: 5 })).toBeNull()
  })
})
