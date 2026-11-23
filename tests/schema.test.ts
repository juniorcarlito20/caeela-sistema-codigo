import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/schema.prisma', 'utf-8')

describe('schema', () => {
  it('permite vínculo com fim nulo (rotação)', () => {
    expect(schema).toMatch(/fim\s+DateTime\?/)
  })
  it('exige apenas nome no aluno', () => {
    expect(schema).toMatch(/nome\s+String\n/)
    expect(schema).toMatch(/cpf\s+String\?/)
    expect(schema).toMatch(/responsavel\s+String\?/)
  })
  it('tem as cinco situações do aluno', () => {
    expect(schema).toMatch(/enum SituacaoAluno \{[\s\S]*?ESPERA[\s\S]*?ATENDIMENTO[\s\S]*?PAUSA[\s\S]*?ALTA[\s\S]*?DESLIGADO[\s\S]*?\}/)
  })
  it('permite login sem e-mail', () => {
    expect(schema).toMatch(/usuario\s+String\s+@unique/)
    expect(schema).toMatch(/email\s+String\?\s+@unique/)
    expect(schema).toMatch(/precisaTrocarSenha Boolean @default\(true\)/)
  })
})
