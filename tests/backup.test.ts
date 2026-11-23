import { describe, it, expect } from 'vitest'
import { nomeDoArquivo, chavesAntigas, escolherBackup } from '@/scripts/backup'

describe('backup', () => {
  it('nomeia por data e hora', () => {
    expect(nomeDoArquivo(new Date('2026-09-23T03:00:00Z'))).toBe('caeela-2026-09-23.sql.gz')
  })
  it('lista o que passou de 30 dias', () => {
    const chaves = ['backups/caeela-2026-08-01.sql.gz', 'backups/caeela-2026-09-20.sql.gz']
    expect(chavesAntigas(chaves, new Date('2026-09-23'))).toEqual(['backups/caeela-2026-08-01.sql.gz'])
  })
  it('ignora arquivo sem data no nome, nunca apaga', () => {
    const chaves = ['backups/leia-me.txt', 'backups/caeela-2026-09-20.sql.gz']
    expect(chavesAntigas(chaves, new Date('2026-09-23'))).toEqual([])
  })
  it('retenção configurável: com 7 dias apaga o de 8 e mantém o de 6', () => {
    const chaves = ['backups/caeela-2026-09-15.sql.gz', 'backups/caeela-2026-09-17.sql.gz']
    expect(chavesAntigas(chaves, new Date('2026-09-23'), 7)).toEqual([
      'backups/caeela-2026-09-15.sql.gz',
    ])
  })
  it('primeiro de janeiro sai com o ano certo', () => {
    expect(nomeDoArquivo(new Date('2026-01-01T03:00:00Z'))).toBe('caeela-2026-01-01.sql.gz')
  })
})

describe('escolha do backup para baixar', () => {
  it('pega o mais recente e ignora o resto', () => {
    expect(
      escolherBackup([
        'caeela-2026-09-20.sql.gz',
        'caeela-2026-09-22.sql.gz',
        'caeela-2026-09-21.sql.gz',
      ]),
    ).toBe('caeela-2026-09-22.sql.gz')
  })
  it('ignora nome fora do padrão, inclusive tentativa de caminho', () => {
    expect(
      escolherBackup(['../../etc/passwd', 'outro.txt', 'caeela-2026-09-22.sql.gz']),
    ).toBe('caeela-2026-09-22.sql.gz')
    expect(escolherBackup(['../../etc/passwd', 'outro.txt'])).toBeNull()
  })
})
