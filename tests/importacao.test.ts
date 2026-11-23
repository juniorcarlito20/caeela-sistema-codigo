import { describe, it, expect } from 'vitest'
import { interpretarCabecalho, interpretarContextoConsulta, interpretarContinuacaoDeGrupo, normalizarHora, normalizarCPF, normalizarNome } from '@/domain/importacao'
describe('cabeçalho da tabela', () => {
  it('extrai dia, profissional e área', () => {
    expect(interpretarCabecalho('(SEGUNDA FEIRA) JUCILENE FISIOTERAPEUTA')).toEqual({
      diaSemana: 1, profissional: 'Jucilene', area: 'Fisioterapia', grupo: null, local: null,
    })
  })
  it('entende atendimento em grupo', () => {
    expect(interpretarCabecalho('(TERÇA FEIRA) NAIARA NUTRICIONISTA GRUPO 02')).toEqual({
      diaSemana: 2, profissional: 'Naiara', area: 'Nutrição', grupo: 'Grupo 02', local: null,
    })
  })
  it('devolve nulo para cabeçalho desconhecido', () => {
    expect(interpretarCabecalho('OBSERVAÇÕES')).toBeNull()
  })
  it('lê o cabeçalho real com erro de digitação', () => {
    expect(interpretarCabecalho('(SEGUNDA FEIRA) JUCILENE FISIOTERAPEUTA')).toEqual({
      diaSemana: 1, profissional: 'Jucilene', area: 'Fisioterapia', grupo: null, local: null,
    })
  })
  it('entende grupo com erro de digitação na área', () => {
    expect(interpretarCabecalho('(TERÇA FEIRA) NAIARA NUTRICINISTA GRUPO 02 TE')).toEqual({
      diaSemana: 2, profissional: 'Naiara', area: 'Nutrição', grupo: 'Grupo 02', local: null,
    })
  })
  it('entende sigla espaçada de área', () => {
    expect(interpretarCabecalho('(QUINTA FEIRA) SINARA A T')).toEqual({
      diaSemana: 4, profissional: 'Sinara', area: 'Assistência Terapêutica', grupo: null, local: null,
    })
  })
  it('entende a sigla com ponto e espaço (A. T.)', () => {
    expect(interpretarCabecalho('(SEGUNDA FEIRA) SINARA A. T.')).toEqual({
      diaSemana: 1, profissional: 'Sinara', area: 'Assistência Terapêutica', grupo: null, local: null,
    })
  })
  it('entende o formato novo com traços, nome completo e local', () => {
    expect(interpretarCabecalho('(SEGUNDA-FEIRA) MARIA SOUZA – FONOAUDIOLOGIA – CAEELA')).toEqual({
      diaSemana: 1, profissional: 'Maria Souza', area: 'Fonoaudiologia', grupo: null, local: 'CAEELA',
    })
  })
  it('entende área e escola fora do centro', () => {
    expect(interpretarCabecalho('(TERÇA-FEIRA) JOÃO LIMA – PSICOPEDAGOGIA AEE – ESCOLA MUNICIPAL CENTRO')).toEqual({
      diaSemana: 2, profissional: 'João Lima', area: 'Psicopedagogia AEE', grupo: null, local: 'ESCOLA MUNICIPAL CENTRO',
    })
  })
  it('entende grupo no formato novo', () => {
    expect(interpretarCabecalho('(QUINTA-FEIRA) CARLA MENDES – NUTRIÇÃO – CAEELA – GRUPO 01')).toEqual({
      diaSemana: 4, profissional: 'Carla Mendes', area: 'Nutrição', grupo: 'Grupo 01', local: 'CAEELA',
    })
  })
})

describe('continuação de grupo (sub-tabela de rotação)', () => {
  it('título só com o número do grupo vira "Grupo 0N"', () => {
    expect(interpretarContinuacaoDeGrupo('GRUPO 02')).toBe('Grupo 02')
    expect(interpretarContinuacaoDeGrupo('grupo 1')).toBe('Grupo 01')
    expect(interpretarContinuacaoDeGrupo('  GRUPO  3  ')).toBe('Grupo 03')
  })
  it('devolve nulo para o que não é só grupo', () => {
    expect(interpretarContinuacaoDeGrupo('GRUPO 02 TERAPIA')).toBeNull()
    expect(interpretarContinuacaoDeGrupo('OBSERVAÇÕES')).toBeNull()
    expect(interpretarContinuacaoDeGrupo('')).toBeNull()
    expect(interpretarContinuacaoDeGrupo('(TERÇA FEIRA) ROSA NUTRICIONISTA')).toBeNull()
  })
})

describe('local do atendimento', () => {
  it('título com local devolve o local', () => {
    expect(
      interpretarCabecalho('(TERÇA-FEIRA) JOÃO LIMA – PSICOPEDAGOGIA AEE – ESCOLA MUNICIPAL CENTRO'),
    ).toMatchObject({ local: 'ESCOLA MUNICIPAL CENTRO' })
  })
  it('título sem local devolve null (assume CAEELA)', () => {
    expect(interpretarCabecalho('(SEGUNDA FEIRA) JUCILENE FISIOTERAPEUTA')).toMatchObject({
      local: null,
    })
  })
  it('título com grupo e local devolve os dois', () => {
    expect(
      interpretarCabecalho('(QUINTA-FEIRA) CARLA MENDES – NUTRIÇÃO – CAEELA – GRUPO 01'),
    ).toMatchObject({ grupo: 'Grupo 01', local: 'CAEELA' })
  })
})
describe('normalizações', () => {
  it('padroniza hora escrita de várias formas', () => {
    expect(normalizarHora('07 h 30 min')).toBe('07:30')
    expect(normalizarHora('13 h')).toBe('13:00')
    expect(normalizarHora('08:10')).toBe('08:10')
    expect(normalizarHora('')).toBeNull()
  })
  it('aceita hora com minutos escritos por extenso', () => {
    expect(normalizarHora('15 h 00 min')).toBe('15:00')
  })
  it('valida o CPF pelo formato', () => {
    expect(normalizarCPF('123.456.789-09')).toBe('12345678909')
    expect(normalizarCPF('---')).toBeNull()
  })
  it('devolve nulo para CPF vazio, traço ou texto', () => {
    expect(normalizarCPF('')).toBeNull()
    expect(normalizarCPF(' - ')).toBeNull()
    expect(normalizarCPF('não informado')).toBeNull()
  })
})

describe('nome normalizado', () => {
  it('ignora acento, caixa e espaço duplo', () => {
    expect(normalizarNome('  JOSÉ   da Silva ')).toBe('jose da silva')
    expect(normalizarNome('Jose da Silva')).toBe('jose da silva')
  })
})

describe('extração do docx fictício', () => {  it('lê as tabelas, monta as linhas e ignora o resto sem derrubar', async () => {
    const mammoth = await import('mammoth')
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const { value: html } = await mammoth.convertToHtml({
      path: 'tests/fixtures/agenda-ficticia.docx',
    })
    const { linhas, ignoradas } = extrairLinhas(html)
    expect(linhas).toHaveLength(15)
    expect(linhas[0]).toMatchObject({
      profissional: 'Neuza', area: 'Fisioterapia', diaSemana: 1,
      hora: '07:30', aluno: 'Fabio Fictício', cpf: '11122233344',
      whatsapp: '(77) 90000-0001',
    })
    const grupo = linhas.filter((l) => l.grupo === 'Grupo 02' && l.profissional === 'Adailton')
    expect(grupo).toHaveLength(2)
    expect(grupo[0]).toMatchObject({ profissional: 'Adailton', area: 'Nutrição' })
    const rosa = linhas.filter((l) => l.profissional === 'Rosa Fictícia')
    expect(rosa).toHaveLength(2)
    expect(rosa[0]).toMatchObject({
      area: 'Fonoaudiologia', diaSemana: 1, hora: '13:00',
      aluno: 'Nina Fictícia', whatsapp: '(77) 90000-0004', local: 'CAEELA',
    })
    const escola = linhas.filter((l) => l.profissional === 'Carla Mendes')
    expect(escola).toHaveLength(1)
    expect(escola[0]).toMatchObject({
      area: 'Nutrição', diaSemana: 4, hora: '10:10', grupo: 'Grupo 01',
      aluno: 'Sara Fictícia', local: 'ESCOLA MUNICIPAL CENTRO',
    })
    // Formato ANTIGO de verdade: título dentro da própria tabela, sem parágrafo antes.
    const telma = linhas.filter((l) => l.profissional === 'Telma')
    expect(telma).toHaveLength(2)
    expect(telma[0]).toMatchObject({
      area: 'Psicologia', diaSemana: 3, hora: '07:30',
      aluno: 'Paulo Fictício', cpf: '22233344455',
    })
    expect(telma[1]).toMatchObject({ hora: '08:10', aluno: 'Quitéria Fictícia' })
    // A linha de cabeçalho de coluna (MATUTINO/...) não vira atendimento.
    expect(linhas.every((l) => l.aluno !== 'MATUTINO')).toBe(true)
    // Rotação: tabela completa seguida de sub-tabela só "GRUPO 02".
    const rosaNutri = linhas.filter((l) => l.profissional === 'Rosa' && l.area === 'Nutrição')
    expect(rosaNutri).toHaveLength(3)
    expect(rosaNutri[0]).toMatchObject({
      diaSemana: 2, hora: '08:10', aluno: 'Sofia Fictícia', grupo: 'Grupo 01',
    })
    const continuacao = rosaNutri.filter((l) => l.grupo === 'Grupo 02')
    expect(continuacao).toHaveLength(2)
    expect(continuacao[0]).toMatchObject({
      diaSemana: 2, hora: '08:10', aluno: 'Tiago Fictício', area: 'Nutrição',
    })
    expect(continuacao[1]).toMatchObject({ aluno: 'Úrsula Fictícia', hora: '09:30' })
    expect(ignoradas.join('\n')).toMatch(/cabeçalho não reconhecido/)
    expect(ignoradas.join('\n')).toMatch(/sem horário/)
    // O mammoth é carregado na hora; com a suíte toda rodando em paralelo ele passa do
    // limite de 5 s e o teste falha por tempo, não por conteúdo.
  }, 30000)
})

describe('vagas e tabelas-modelo', () => {
  const CAB = '<p>(SEGUNDA FEIRA) NEUZA FISIOTERAPEUTA</p>'
  const linha = (n: string, hora: string, aluno: string) =>
    `<tr><td><p>${n}</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td></td><td></td><td></td></tr>`
  const tabela = (corpo: string) =>
    `<table><tr><td><p>Nº</p></td><td><p>HORÁRIO</p></td><td><p>ALUNO</p></td><td><p>CPF</p></td><td><p>RESPONSÁVEL</p></td><td><p>CONTATO</p></td></tr>${corpo}</table>`

  it('linha com horário e sem aluno conta como vaga, não como ignorada', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(CAB + tabela(linha('03', '08 h 50 min', '')))
    expect(r.vagas).toBe(1)
    expect(r.linhas).toHaveLength(0)
    expect(r.ignoradas).toEqual([])
  })
  it('linha com aluno e sem horário continua ignorada', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(CAB + tabela(linha('04', '', 'Iara Fictícia')))
    expect(r.vagas).toBe(0)
    expect(r.linhas).toHaveLength(0)
    expect(r.ignoradas.join('\n')).toMatch(/sem horário/)
  })
  it('tabela de modelo em branco é identificada', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      '<p>(DIA DA SEMANA) NOME DO PROFISSIONAL – ESPECIALIDADE – LOCAL</p>' +
        tabela(linha('01', '07 h 30 min', '')),
    )
    expect(r.vagas).toBe(0)
    expect(r.linhas).toHaveLength(0)
    expect(r.ignoradas).toEqual(['tabela de modelo em branco, ignorada'])
  })
})

describe('formato antigo (título dentro da própria tabela)', () => {
  const dado = (n: string, hora: string, aluno: string) =>
    `<tr><td><p>${n}</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td></td><td></td></tr>`
  const antiga = (titulo: string, corpo: string) =>
    `<table><tr><td colspan="5"><p>${titulo}</p></td></tr>` +
    `<tr><td><p>MATUTINO</p></td><td><p>MATUTINO</p></td><td><p>MATUTINO</p></td>` +
    `<td><p>CPF</p></td><td><p>RESPONSÁVEL</p></td></tr>${corpo}</table>`

  it('lê o título da primeira linha e pula o cabeçalho MATUTINO', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(antiga('(QUARTA FEIRA) TELMA PSICOLOGA', dado('1', '07 h 30 min', 'Paulo Fictício')))
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({
      profissional: 'Telma', area: 'Psicologia', diaSemana: 3,
      hora: '07:30', aluno: 'Paulo Fictício',
    })
    expect(r.ignoradas).toEqual([])
  })
  it('reconhece VESPERTINO como cabeçalho de coluna', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const html =
      `<table><tr><td colspan="5"><p>(QUINTA FEIRA) RITA PSICOLOGA</p></td></tr>` +
      `<tr><td><p>VESPERTINO</p></td><td><p>VESPERTINO</p></td><td><p>VESPERTINO</p></td>` +
      `<td><p>CPF</p></td><td><p>RESPONSÁVEL</p></td></tr>` +
      dado('1', '13 h', 'Paulo Fictício') + `</table>`
    const r = extrairLinhas(html)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ profissional: 'Rita', diaSemana: 4, hora: '13:00' })
  })
  it('parágrafo de título não é reaproveitado pela tabela seguinte', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      '<p>(SEGUNDA FEIRA) NEUZA FISIOTERAPEUTA</p>' +
        `<table><tr><td><p>Nº</p></td><td><p>HORÁRIO</p></td><td><p>ALUNO</p></td></tr>` +
        dado('1', '07 h 30 min', 'Fabio Fictício') + `</table>` +
        antiga('texto que não é cabeçalho', dado('1', '08:10', 'Paulo Fictício')),
    )
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ profissional: 'Neuza', aluno: 'Fabio Fictício' })
    expect(r.ignoradas.join('\n')).toMatch(/cabeçalho não reconhecido/)
  })
})

describe('herança de cabeçalho (sub-tabela só "GRUPO N")', () => {
  const dado6 = (n: string, hora: string, aluno: string) =>
    `<tr><td><p>${n}</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td></td><td></td><td></td></tr>`
  const tabelaNova = (corpo: string) =>
    `<table><tr><td><p>Nº</p></td><td><p>HORÁRIO</p></td><td><p>ALUNO</p></td><td><p>CPF</p></td><td><p>RESPONSÁVEL</p></td><td><p>CONTATO</p></td></tr>${corpo}</table>`
  const subTabela = (corpo: string) =>
    `<table><tr><td colspan="5"><p>GRUPO 02</p></td></tr>` +
    `<tr><td><p>MATUTINO</p></td><td><p>MATUTINO</p></td><td><p>MATUTINO</p></td>` +
    `<td><p>CPF</p></td><td><p>RESPONSÁVEL</p></td></tr>${corpo}</table>`
  const dado5 = (n: string, hora: string, aluno: string) =>
    `<tr><td><p>${n}</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td></td><td></td></tr>`
  const CAB_ROSA = '<p>(TERÇA-FEIRA) ROSA NUTRICIONISTA GRUPO 01 TERAPIA</p>'

  it('sub-tabela herda dia, profissional e área, trocando só o grupo', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      CAB_ROSA + tabelaNova(dado6('1', '08:10', 'Sofia Fictícia')) +
        subTabela(dado5('1', '08:10', 'Tiago Fictício')),
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.linhas[0]).toMatchObject({
      profissional: 'Rosa', area: 'Nutrição', diaSemana: 2, grupo: 'Grupo 01',
    })
    expect(r.linhas[1]).toMatchObject({
      profissional: 'Rosa', area: 'Nutrição', diaSemana: 2,
      grupo: 'Grupo 02', hora: '08:10', aluno: 'Tiago Fictício',
    })
    expect(r.ignoradas).toEqual([])
  })
  it('"GRUPO 02" como parágrafo antes da tabela também herda', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      CAB_ROSA + tabelaNova(dado6('1', '08:10', 'Sofia Fictícia')) +
        '<p>GRUPO 02</p>' + tabelaNova(dado6('1', '09:30', 'Tiago Fictício')),
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.linhas[1]).toMatchObject({
      profissional: 'Rosa', diaSemana: 2, grupo: 'Grupo 02', aluno: 'Tiago Fictício',
    })
  })
  it('"GRUPO 02" no início do arquivo é ignorado, sem quebrar', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(subTabela(dado5('1', '08:10', 'Tiago Fictício')))
    expect(r.linhas).toHaveLength(0)
    expect(r.ignoradas.join('\n')).toMatch(/cabeçalho não reconhecido/)
  })
  it('continuação não vira base: o próximo grupo herda a última tabela completa', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      CAB_ROSA + tabelaNova(dado6('1', '08:10', 'Sofia Fictícia')) +
        subTabela(dado5('1', '08:10', 'Tiago Fictício')) +
        '<p>(QUARTA FEIRA) TELMA PSICOLOGA</p>' +
        tabelaNova(dado6('1', '07:30', 'Paulo Fictício')) +
        '<p>GRUPO 03</p>' + tabelaNova(dado6('1', '09:30', 'Úrsula Fictícia')),
    )
    expect(r.linhas).toHaveLength(4)
    expect(r.linhas[3]).toMatchObject({
      profissional: 'Telma', area: 'Psicologia', diaSemana: 3,
      grupo: 'Grupo 03', aluno: 'Úrsula Fictícia',
    })
  })
})

describe('formato "CONSULTA COM A ..." (título em parágrafos soltos antes da tabela)', () => {
  it('entende fonoaudióloga com grupo', () => {
    expect(
      interpretarContextoConsulta([
        'CONSULTA COM A FONOAUDIÓLOGA', 'SEGUNDA-FEIRA', 'MARIA FICTÍCIA SOUZA', 'GRUPO 1',
      ]),
    ).toEqual({
      diaSemana: 1, profissional: 'Maria Fictícia Souza', area: 'Fonoaudiologia',
      grupo: 'Grupo 01', local: null,
    })
  })
  it('entende o masculino, o dia sem hífen e a falta de grupo', () => {
    expect(
      interpretarContextoConsulta(['CONSULTA COM A FONOAUDIÓLOGO', 'QUINTA FEIRA', 'JOSÉ FICTÍCIO LIMA']),
    ).toMatchObject({ diaSemana: 4, profissional: 'José Fictício Lima', area: 'Fonoaudiologia', grupo: null })
  })
  it('"GRUPO: QUINTA-FEIRA" dá o dia e não vira número de grupo nem nome', () => {
    expect(
      interpretarContextoConsulta(['CONSULTA COM A FONOAUDIÓLOGA', 'GRUPO: QUINTA-FEIRA', 'ANA FICTÍCIA PRADO']),
    ).toMatchObject({ diaSemana: 4, profissional: 'Ana Fictícia Prado', grupo: null })
  })
  it('devolve nulo sem "CONSULTA COM", sem dia ou sem nome', () => {
    expect(interpretarContextoConsulta(['SEGUNDA-FEIRA', 'ANA FICTÍCIA PRADO'])).toBeNull()
    expect(interpretarContextoConsulta(['CONSULTA COM A FONOAUDIÓLOGA', 'ANA FICTÍCIA PRADO'])).toBeNull()
    expect(interpretarContextoConsulta(['CONSULTA COM A FONOAUDIÓLOGA', 'SEGUNDA-FEIRA'])).toBeNull()
  })

  const linha = (n: string, hora: string, aluno: string, cpf: string) =>
    `<tr><td><p>${n}</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td><p>${cpf}</p></td><td><p>Resp</p></td></tr>`
  const tabela = (corpo: string) =>
    `<table><tr><td><p>Matutino</p></td><td><p>CPF</p></td><td><p>Assinatura do responsável</p></td></tr>${corpo}</table>`

  it('lê a tabela, ignora a linha MATUTINO e não herda cabeçalho da nutricionista anterior', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      '<p>(QUINTA FEIRA) ROSA NUTRICIONISTA GRUPO 02 TERAPIA</p>' +
        tabela(linha('1', '08:10', 'Sofia Fictícia', '111.222.333-44')) +
        '<p>CONSULTA COM A FONOAUDIÓLOGO</p><p>QUARTA FEIRA</p><p>PEDRO FICTÍCIO RAMOS</p>' +
        tabela(linha('1', '07 h 30 min', 'Tiago Fictício', '222.333.444-55')),
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.linhas[0]).toMatchObject({ profissional: 'Rosa', area: 'Nutrição' })
    expect(r.linhas[1]).toMatchObject({
      profissional: 'Pedro Fictício Ramos', area: 'Fonoaudiologia', diaSemana: 3,
      hora: '07:30', aluno: 'Tiago Fictício', cpf: '22233344455', grupo: null,
    })
    expect(r.linhas[1].cicloSemanas).toBeUndefined()
  })

  it('Grupo 1 e Grupo 2 no mesmo dia viram rodízio quinzenal', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const cab = (g: string) =>
      `<p>CONSULTA COM A FONOAUDIÓLOGA</p><p>SEGUNDA-FEIRA</p><p>LÚCIA FICTÍCIA ALVES</p><p>GRUPO ${g}</p>`
    const r = extrairLinhas(
      cab('1') + tabela(linha('1', '08:10', 'Uma Fictícia', '333.444.555-66')) +
        cab('02') + tabela(linha('1', '08:10', 'Dois Fictício', '444.555.666-77')) +
        '<p>CONSULTA COM A FONOAUDIÓLOGA</p><p>TERÇA-FEIRA</p><p>LÚCIA FICTÍCIA ALVES</p>' +
        tabela(linha('1', '09:30', 'Tres Fictício', '555.666.777-88')),
    )
    expect(r.linhas).toHaveLength(3)
    expect(r.linhas[0]).toMatchObject({ grupo: 'Grupo 01', cicloSemanas: 2, cicloOffset: 0 })
    expect(r.linhas[1]).toMatchObject({ grupo: 'Grupo 02', cicloSemanas: 2, cicloOffset: 1 })
    expect(r.linhas[2].cicloSemanas).toBeUndefined()
  })

  it('parágrafo de dentro de célula não vira título de página', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      '<p>CONSULTA COM A FONOAUDIÓLOGA</p><p>SEGUNDA-FEIRA</p><p>LÚCIA FICTÍCIA ALVES</p>' +
        tabela(linha('1', '08:10', 'Uma Fictícia', '333.444.555-66')) +
        '<table><tr><td><p>SEXTA-FEIRA</p></td></tr></table>',
    )
    expect(r.linhas).toHaveLength(1)
    expect(r.ignoradas.join('\n')).toMatch(/cabeçalho não reconhecido/)
  })
})

describe('criança listada em todos os grupos do mesmo horário', () => {
  const linha = (hora: string, aluno: string, cpf: string) =>
    `<tr><td><p>1</p></td><td><p>${hora}</p></td><td><p>${aluno}</p></td><td><p>${cpf}</p></td><td><p>Resp</p></td></tr>`
  const tabela = (corpo: string) =>
    `<table><tr><td><p>Matutino</p></td><td><p>CPF</p></td><td><p>Assinatura</p></td></tr>${corpo}</table>`
  const cab = (g: string) =>
    `<p>CONSULTA COM A FONOAUDIÓLOGA</p><p>QUARTA-FEIRA</p><p>LÚCIA FICTÍCIA ALVES</p><p>GRUPO ${g}</p>`

  it('vira um horário semanal único; os demais seguem em rodízio', async () => {
    const { extrairLinhas } = await import('@/scripts/importar-agenda')
    const r = extrairLinhas(
      cab('1') + tabela(linha('08:10', 'Ana Fictícia', '111.222.333-44') + linha('08:50', 'Bia Fictícia', '222.333.444-55')) +
        cab('2') + tabela(linha('08:10', 'Ana Fictícia', '111.222.333-44') + linha('08:50', 'Caio Fictício', '333.444.555-66')),
    )
    expect(r.linhas).toHaveLength(3)
    const ana = r.linhas.filter((l) => l.aluno === 'Ana Fictícia')
    expect(ana).toHaveLength(1)
    expect(ana[0].grupo).toBeNull()
    expect(ana[0].cicloSemanas).toBeUndefined()
    const bia = r.linhas.find((l) => l.aluno === 'Bia Fictícia')!
    const caio = r.linhas.find((l) => l.aluno === 'Caio Fictício')!
    expect(bia).toMatchObject({ grupo: 'Grupo 01', cicloSemanas: 2, cicloOffset: 0 })
    expect(caio).toMatchObject({ grupo: 'Grupo 02', cicloSemanas: 2, cicloOffset: 1 })
  })
})
