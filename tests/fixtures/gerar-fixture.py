"""Gera tests/fixtures/agenda-ficticia.docx para testar o importador.

Nomes 100% inventados e CPFs inválidos de propósito. NUNCA usar dados reais aqui.
Cobre os formatos da agenda verdadeira (a ordem da lista é a ordem no documento,
o que importa para testar herança de cabeçalho entre tabelas vizinhas):
- formato NOVO: título como parágrafo separado antes da tabela;
- formato ANTIGO: título como a própria primeira linha da tabela (célula
  mesclada, 'titulo_na_tabela': True), seguida da linha de cabeçalho de coluna
  (MATUTINO/.../CPF/RESPONSÁVEL);
- sub-tabela de rotação: título só "GRUPO 0N" ('titulo_na_tabela': True),
  herdando dia/profissional/área da tabela completa anterior.
Colunas de dado: ordem / horário / aluno / CPF / responsável.
"""
from docx import Document
from docx.shared import Pt

doc = Document()
doc.add_heading('Agenda fictícia — uso em teste', level=1)

tabelas = [
    {
        'cabecalho': '(SEGUNDA FEIRA) NEUZA FISIOTERAPEUTA',
        'linhas': [
            ('1', '07 h 30 min', 'Fabio Fictício', '11122233344', 'Mãe do Fabio', '(77) 90000-0001'),
            ('2', '08:50', 'Gina  Fictícia', '', 'Pai da Gina', ''),  # espaço duplo + sem CPF
            ('3', '08:50', 'Hugo Fictício', '---', '', ''),  # mesmo horário: conflito de propósito
            ('4', '', 'Iara Fictícia', '', '', ''),  # sem hora: ignorada
            ('5', '09:30', 'João Fictício', '12345', '', '(77) 90000-0002'),  # CPF inválido
            ('', '', '', '', '', ''),  # linha vazia: ignorada
            ('6', '10:10', 'Joao Ficticio', '', '', ''),  # mesmo aluno sem acento: reaproveita
        ],
    },
    {
        'cabecalho': '(TERÇA FEIRA) ADAILTON NUTRICINISTA GRUPO 02 TE',
        'linhas': [
            ('1', '08:10', 'Lia Fictícia', '', '', '(77) 90000-0003'),
            ('2', '08:10', 'Mauro Fictício', '', '', ''),
        ],
    },
    {
        'cabecalho': '(SEGUNDA-FEIRA) ROSA FICTÍCIA – FONOAUDIOLOGIA – CAEELA',
        'linhas': [
            ('1', '13 h', 'Nina Fictícia', '', 'Mãe da Nina', '(77) 90000-0004'),
            ('2', '13 h 40 min', 'Otto Fictício', '', '', ''),
            ('3', '', '', '', '', ''),  # linha em branco: horário vago, ignorada
        ],
    },
    {
        'cabecalho': '(QUINTA-FEIRA) CARLA MENDES – NUTRIÇÃO – ESCOLA MUNICIPAL CENTRO – GRUPO 01',
        'linhas': [
            ('1', '10 h 10 min', 'Sara Fictícia', '', 'Mãe da Sara', '(77) 90000-0005'),
        ],
    },
    {
        'cabecalho': '(QUARTA FEIRA) TELMA PSICOLOGA',
        'titulo_na_tabela': True,
        'linhas': [
            ('1', '07 h 30 min', 'Paulo Fictício', '22233344455', 'Mãe do Paulo'),
            ('2', '08:10', 'Quitéria Fictícia', '', ''),
        ],
    },
    {
        'cabecalho': '(TERÇA-FEIRA) ROSA NUTRICIONISTA GRUPO 01 TERAPIA',
        'linhas': [
            ('1', '08:10', 'Sofia Fictícia', '', '', ''),
        ],
    },
    {
        # Sub-tabela de rotação: sem parágrafo, sem dia — herda tudo da Rosa acima.
        'cabecalho': 'GRUPO 02',
        'titulo_na_tabela': True,
        'linhas': [
            ('1', '08:10', 'Tiago Fictício', '', ''),
            ('2', '09:30', 'Úrsula Fictícia', '', ''),
        ],
    },
    {
        'cabecalho': 'OBSERVAÇÕES',
        'linhas': [
            ('', 'trazer garrafa de água', '', '', '', ''),
        ],
    },
]

for tab in tabelas:
    if tab.get('titulo_na_tabela'):
        # SEM doc.add_paragraph antes: o título é a própria primeira linha
        # da tabela (célula mesclada cobrindo as colunas).
        tabela = doc.add_table(rows=2 + len(tab['linhas']), cols=5)
        primeira = tabela.rows[0].cells[0]
        primeira.merge(tabela.rows[0].cells[4])
        primeira.text = tab['cabecalho']
        for i, titulo in enumerate(['MATUTINO', 'MATUTINO', 'MATUTINO', 'CPF', 'RESPONSÁVEL']):
            tabela.rows[1].cells[i].text = titulo
        for n, lin in enumerate(tab['linhas'], start=2):
            for i, valor in enumerate(lin):
                tabela.rows[n].cells[i].text = valor
        continue
    doc.add_paragraph(tab['cabecalho'])
    tabela = doc.add_table(rows=1 + len(tab['linhas']), cols=6)
    for i, titulo in enumerate(['Nº', 'Horário', 'Aluno', 'CPF', 'Responsável', 'Contato (WhatsApp)']):
        tabela.rows[0].cells[i].text = titulo
    for n, lin in enumerate(tab['linhas'], start=1):
        for i, valor in enumerate(lin):
            tabela.rows[n].cells[i].text = valor

for p in doc.paragraphs:
    for r in p.runs:
        r.font.size = Pt(11)

doc.save('tests/fixtures/agenda-ficticia.docx')
print('Fixture salva em tests/fixtures/agenda-ficticia.docx')
