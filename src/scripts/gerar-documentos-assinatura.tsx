// Gera os documentos que a instituição assina (Trabalho Final da Atividade Extensionista).
// Uso: npx vite-node src/scripts/gerar-documentos-assinatura.tsx
// Saída: docs/faculdade/para-assinar/*.pdf. Sem nenhum dado de aluno ou de criança: só texto
// institucional e linhas em branco pra preencher à mão.
import React from 'react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
// vite-node usa o JSX clássico; o Timbre do sistema espera o automático.
;(globalThis as unknown as { React: typeof React }).React = React
import { Timbre, carregarLogos, AZUL, type Logos } from '../lib/pdf/timbre'

const e = StyleSheet.create({
  pagina: { padding: 34, paddingBottom: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.45, color: '#111' },
  titulo: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 12, marginBottom: 3 },
  subtitulo: { fontSize: 9.5, textAlign: 'center', color: '#444', marginBottom: 10 },
  paragrafo: { marginBottom: 6, textAlign: 'justify' },
  negrito: { fontWeight: 'bold' },
  h2: { fontSize: 10.5, fontWeight: 'bold', color: AZUL, marginTop: 8, marginBottom: 3 },
  item: { flexDirection: 'row', marginBottom: 2, paddingLeft: 6 },
  marca: { width: 10 },
  linhaCampo: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 7 },
  rotulo: { fontSize: 9.5 },
  preencher: { flex: 1, borderBottomWidth: 0.8, borderBottomColor: '#555', marginLeft: 4, height: 11 },
  linhaTexto: { borderBottomWidth: 0.8, borderBottomColor: '#999', height: 17 },
  caixa: { width: 9, height: 9, borderWidth: 0.8, borderColor: '#333', marginRight: 4, marginTop: 2 },
  tabela: { borderWidth: 0.8, borderColor: '#666', marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: '#999' },
  th: { backgroundColor: '#eaf2fc', fontWeight: 'bold', fontSize: 9 },
  td: { padding: 3, fontSize: 9, borderRightWidth: 0.6, borderRightColor: '#999', minHeight: 20 },
  assinaturas: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 26, gap: 14 },
  assinatura: { flex: 1, alignItems: 'center' },
  traco: { width: '100%', borderTopWidth: 0.8, borderTopColor: '#222', marginBottom: 2 },
  papel: { fontSize: 8.5, textAlign: 'center', color: '#333' },
  rodape: { marginTop: 14, fontSize: 9.5, textAlign: 'right' },
  nota: { fontSize: 8.5, color: '#555', marginTop: 6 },
  escala: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  nota5: { width: 17, height: 15, borderWidth: 0.8, borderColor: '#333', textAlign: 'center', fontSize: 8, paddingTop: 2 },
})

function Campo({ rotulo }: { rotulo: string }) {
  return (
    <View style={e.linhaCampo}>
      <Text style={e.rotulo}>{rotulo}</Text>
      <View style={e.preencher} />
    </View>
  )
}

function Linhas({ n }: { n: number }) {
  return (
    <View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={e.linhaTexto} />
      ))}
    </View>
  )
}

function Item({ children, caixa = false }: { children: React.ReactNode; caixa?: boolean }) {
  return (
    <View style={e.item}>
      {caixa ? <View style={e.caixa} /> : <Text style={e.marca}>•</Text>}
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  )
}

function Assinaturas({ papeis }: { papeis: string[] }) {
  return (
    <View style={e.assinaturas}>
      {papeis.map((p) => (
        <View key={p} style={e.assinatura}>
          <View style={e.traco} />
          <Text style={e.papel}>{p}</Text>
        </View>
      ))}
    </View>
  )
}

function DataEmBranco() {
  return <Text style={e.rodape}>Licínio de Almeida – BA, _____ de ____________________ de 2026.</Text>
}

function Cabecalho({ logos, titulo, subtitulo }: { logos: Logos; titulo: string; subtitulo?: string }) {
  return (
    <View>
      <Timbre logos={logos} comBrasao={false} />
      <Text style={e.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={e.subtitulo}>{subtitulo}</Text> : null}
    </View>
  )
}

function Celula({ larg, children, titulo = false }: { larg: string; children?: React.ReactNode; titulo?: boolean }) {
  return (
    <View style={[e.td, { width: larg }, titulo ? e.th : {}]}>
      <Text>{children}</Text>
    </View>
  )
}

// 1. Declaração da instituição parceira ---------------------------------------------------
function Declaracao({ logos }: { logos: Logos }) {
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho logos={logos} titulo="DECLARAÇÃO DE PARCERIA E REALIZAÇÃO DE ATIVIDADE EXTENSIONISTA" />
      <Text style={[e.paragrafo, { marginTop: 8 }]}>
        Declaramos, para os devidos fins, que o estudante <Text style={e.negrito}>Carlito Rodrigues da Silva Junior</Text>,
        RU <Text style={e.negrito}>5690974</Text>, do curso de Tecnologia em Análise e Desenvolvimento de Sistemas do
        Centro Universitário Internacional Uninter, desenvolveu junto ao{' '}
        <Text style={e.negrito}>Centro de Atendimento Educacional Especializado de Licínio de Almeida – BA (CAEELA)</Text>{' '}
        a Atividade Extensionista intitulada <Text style={e.negrito}>“Sistema de gestão interna do CAEELA: agenda,
        presença, prontuário e documentos”</Text>, relacionada aos Objetivos de Desenvolvimento Sustentável 4 (Educação de
        qualidade) e 10 (Redução das desigualdades).
      </Text>
      <Text style={e.h2}>Atividades realizadas junto à instituição</Text>
      <Item>Visitas ao centro (21/09/2026 e 29/09/2026) e escuta da direção e da secretária do centro para levantar como o trabalho é feito hoje.</Item>
      <Item>Desenvolvimento de um sistema de gestão que organiza a agenda dos profissionais, o registro de presença e falta, a evolução e a anamnese dos alunos, a pasta de documentos, os relatórios em papel timbrado e os lembretes às famílias.</Item>
      <Item>Passagem da agenda que o centro mantinha em documento do Word para dentro do sistema.</Item>
      <Item>Publicação do sistema na internet e primeira entrega à direção, em 06/10/2026, com avaliação presencial junto à secretária.</Item>
      <Item>Ajustes pedidos pela equipe depois da entrega, como desfazer um encerramento feito por engano, histórico de quem alterou o quê e aviso de horários em conflito.</Item>
      <Text style={[e.paragrafo, { marginTop: 3, marginBottom: 2 }]}>Marcar o que já ocorreu até a data desta declaração:</Text>
      <Item caixa>Treinamento presencial da equipe no sistema (data: ____ / ____ / 2026).</Item>
      <Item caixa>Entrega do manual do usuário.</Item>
      <Text style={e.h2}>Condições</Text>
      <Text style={e.paragrafo}>
        A atividade foi realizada de forma voluntária, sem remuneração e sem custo de desenvolvimento para o CAEELA. Os dados
        pessoais de alunos, famílias e profissionais foram usados somente para a implantação do sistema, com a autorização
        da direção, e não constam do trabalho acadêmico nem de qualquer publicação. O sistema segue em uso pela instituição.
      </Text>
      <Campo rotulo="Período de realização: de 11/09/2026 até ____ / ____ / 2026.      Carga horária total: " />
      <Campo rotulo="Observações da instituição: " />
      <Linhas n={2} />
      <DataEmBranco />
      <Assinaturas papeis={['Direção do CAEELA\nNome, cargo e carimbo', 'Responsável pelo setor administrativo\nNome e cargo']} />
    </Page>
  )
}

// 2. Termo de entrega e aceite -----------------------------------------------------------
function TermoAceite({ logos }: { logos: Logos }) {
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho logos={logos} titulo="TERMO DE ENTREGA E ACEITE DO SISTEMA" subtitulo="Sistema de gestão interna do CAEELA" />
      <Text style={e.paragrafo}>
        A direção do CAEELA declara que recebeu, em <Text style={e.negrito}>06/10/2026</Text>, o sistema de gestão desenvolvido
        pelo estudante Carlito Rodrigues da Silva Junior (RU 5690974), que o testou junto com a equipe e que ele está
        disponível pela internet no endereço <Text style={e.negrito}>caeela.up.railway.app</Text>, com acesso por usuário e senha.
      </Text>
      <Text style={e.h2}>Funcionalidades entregues (marque o que foi conferido)</Text>
      <Item caixa>Agenda dos profissionais e grade do centro, com aviso quando dois horários batem.</Item>
      <Item caixa>Cadastro de alunos e de profissionais, com fila de espera e controle de alta, pausa e desligamento.</Item>
      <Item caixa>Registro de presença, falta e justificativa, com quem confirmou cada atendimento.</Item>
      <Item caixa>Evolução do aluno e anamnese digitais, vistas só por quem atende.</Item>
      <Item caixa>Pasta de documentos do aluno e relatórios e folha de presença em papel timbrado.</Item>
      <Item caixa>Lembretes às famílias por WhatsApp, com confirmação da família como aviso para a equipe.</Item>
      <Item caixa>Faltas e atestados dos profissionais, com relatório de frequência.</Item>
      <Item caixa>Rodízio de grupos em ciclo de 4 semanas (quinzenal e mensal).</Item>
      <Item caixa>Histórico de quem fez cada alteração no sistema, e cópia de segurança diária.</Item>
      <Text style={e.h2}>Ajustes pedidos pela equipe (preencher à mão)</Text>
      <Linhas n={3} />
      <Text style={e.h2}>Pendências combinadas e prazo</Text>
      <Linhas n={2} />
      <Text style={[e.paragrafo, { marginTop: 8 }]}>
        A direção declara estar de acordo com a entrega e com o uso do sistema pela instituição.
      </Text>
      <DataEmBranco />
      <Assinaturas papeis={['Direção do CAEELA\nNome e cargo', 'Secretária do CAEELA\nNome', 'Desenvolvedor\nCarlito Rodrigues da Silva Junior']} />
    </Page>
  )
}

// 3. Autorização de imagem e depoimento --------------------------------------------------
function AutorizacaoImagem({ logos }: { logos: Logos }) {
  const linhas = Array.from({ length: 15 }, (_, i) => i)
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho logos={logos} titulo="TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM E DEPOIMENTO" subtitulo="Atividade Extensionista · Uninter" />
      <Text style={e.paragrafo}>
        Eu, abaixo assinado(a), integrante da equipe do CAEELA, autorizo o estudante Carlito Rodrigues da Silva Junior
        (RU 5690974) a usar, <Text style={e.negrito}>exclusivamente no trabalho acadêmico da Atividade Extensionista da Uninter</Text>,
        as fotografias do treinamento e da implantação do sistema em que eu apareço e o meu depoimento sobre o antes e o
        depois do sistema.
      </Text>
      <Item>Não serão usadas imagens, nomes ou dados de crianças atendidas ou de suas famílias.</Item>
      <Item>As imagens e o depoimento não serão vendidos nem usados para outro fim que não o trabalho acadêmico.</Item>
      <Item>A autorização é voluntária, sem pagamento, e pode ser retirada a qualquer momento, por aviso ao estudante ou à direção.</Item>
      <View style={e.tabela}>
        <View style={e.tr}>
          <Celula larg="6%" titulo>Nº</Celula>
          <Celula larg="34%" titulo>Nome completo</Celula>
          <Celula larg="22%" titulo>Função</Celula>
          <Celula larg="26%" titulo>Assinatura</Celula>
          <Celula larg="12%" titulo>Data</Celula>
        </View>
        {linhas.map((i) => (
          <View key={i} style={e.tr}>
            <Celula larg="6%">{String(i + 1)}</Celula>
            <Celula larg="34%" />
            <Celula larg="22%" />
            <Celula larg="26%" />
            <Celula larg="12%" />
          </View>
        ))}
      </View>
      <Text style={e.nota}>Visto da direção do CAEELA: ______________________________________</Text>
    </Page>
  )
}

// 4. Avaliação do sistema pela equipe (depoimento) ---------------------------------------
const ITENS_AVALIACAO = [
  'Facilidade para aprender a usar',
  'Agenda dos profissionais e horários',
  'Registro de presença e falta',
  'Evolução, anamnese e documentos do aluno',
  'Lembretes às famílias por WhatsApp',
  'Relatórios e folha de presença em PDF',
  'Segurança dos dados e histórico de alterações',
  'Avaliação geral do sistema',
]
const TAREFAS = [
  'Montar ou conferir a agenda da semana',
  'Gerar o relatório ou a folha de presença do mês',
  'Achar a ficha e os documentos de um aluno',
]

function Avaliacao({ logos }: { logos: Logos }) {
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho logos={logos} titulo="AVALIAÇÃO DO SISTEMA PELA EQUIPE DO CAEELA" subtitulo="Preencher à mão · uma ficha por pessoa" />
      <Campo rotulo="Nome: " />
      <Campo rotulo="Função no CAEELA: " />
      <Text style={e.h2}>Notas de 1 (muito ruim) a 5 (muito bom) — circule uma</Text>
      {ITENS_AVALIACAO.map((it) => (
        <View key={it} style={[e.item, { justifyContent: 'space-between', marginBottom: 4 }]}>
          <Text>{it}</Text>
          <View style={e.escala}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={n} style={e.nota5}>{String(n)}</Text>
            ))}
          </View>
        </View>
      ))}
      <Text style={e.h2}>Tempo gasto, em minutos (antes do sistema × com o sistema)</Text>
      <View style={e.tabela}>
        <View style={e.tr}>
          <Celula larg="60%" titulo>Tarefa</Celula>
          <Celula larg="20%" titulo>Antes</Celula>
          <Celula larg="20%" titulo>Agora</Celula>
        </View>
        {TAREFAS.map((t) => (
          <View key={t} style={e.tr}>
            <Celula larg="60%">{t}</Celula>
            <Celula larg="20%" />
            <Celula larg="20%" />
          </View>
        ))}
      </View>
      <Text style={e.h2}>Como era antes do sistema?</Text>
      <Linhas n={2} />
      <Text style={e.h2}>Como é agora?</Text>
      <Linhas n={2} />
      <Text style={e.h2}>O que ainda precisa melhorar?</Text>
      <Linhas n={2} />
      <View style={[e.item, { marginTop: 8 }]}>
        <View style={e.caixa} />
        <Text style={{ flex: 1 }}>Autorizo usar este depoimento, com meu nome e minha função, no trabalho acadêmico do estudante.</Text>
      </View>
      <Assinaturas papeis={['Assinatura', 'Data']} />
    </Page>
  )
}

// 5. Lista de presença do treinamento ----------------------------------------------------
function ListaPresenca({ logos }: { logos: Logos }) {
  const linhas = Array.from({ length: 13 }, (_, i) => i)
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho logos={logos} titulo="LISTA DE PRESENÇA — TREINAMENTO DA EQUIPE NO SISTEMA" subtitulo="Atividade Extensionista · Uninter" />
      <Campo rotulo="Data: ____ / ____ / 2026     Horário: das ______ às ______     Local: " />
      <Campo rotulo="Responsável pelo treinamento: Carlito Rodrigues da Silva Junior (RU 5690974)" />
      <Text style={e.h2}>Conteúdo trabalhado (marque)</Text>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Item caixa>Entrar no sistema e trocar a senha</Item>
          <Item caixa>Ver a agenda e registrar presença e falta</Item>
          <Item caixa>Escrever a evolução e a anamnese</Item>
        </View>
        <View style={{ flex: 1 }}>
          <Item caixa>Enviar documentos do aluno</Item>
          <Item caixa>Lembretes por WhatsApp</Item>
          <Item caixa>Encaminhar aluno, rodízio e conflitos</Item>
        </View>
      </View>
      <View style={e.tabela}>
        <View style={e.tr}>
          <Celula larg="6%" titulo>Nº</Celula>
          <Celula larg="38%" titulo>Nome completo</Celula>
          <Celula larg="24%" titulo>Função</Celula>
          <Celula larg="32%" titulo>Assinatura</Celula>
        </View>
        {linhas.map((i) => (
          <View key={i} style={e.tr}>
            <Celula larg="6%">{String(i + 1)}</Celula>
            <Celula larg="38%" />
            <Celula larg="24%" />
            <Celula larg="32%" />
          </View>
        ))}
      </View>
      <Assinaturas papeis={['Responsável pelo treinamento', 'Direção do CAEELA']} />
    </Page>
  )
}

// Roteiro pro estudante (não é pra assinar) -----------------------------------------------
function Roteiro() {
  return (
    <Document>
      <Page size="A4" style={e.pagina}>
        <Text style={[e.titulo, { marginTop: 0 }]}>ROTEIRO DA VISITA AO CAEELA — terça-feira, 13/10/2026</Text>
        <Text style={e.subtitulo}>Só pra você (não é pra assinar). Só o que serve ao centro; nada disso é exigido pela faculdade.</Text>
        <Text style={e.h2}>1. Levar</Text>
        <Item caixa>O manual do usuário impresso (para a equipe).</Item>
        <Item>
          Os documentos para assinatura são opcionais: use só se a direção quiser um comprovante.
        </Item>
        <Text style={e.h2}>2. Resolver lá</Text>
        <Item caixa>Ativar o Rafael e a Thaynara (fonoaudiólogos) em Profissionais e definir a senha provisória deles.</Item>
        <Item caixa>Pedir para a secretária olhar o aviso “horários em conflito” no topo do Painel e ajustar do jeito dela.</Item>
        <Item caixa>Perguntar qual grupo dos fonos atende nesta semana (botão “Marcar como esta semana”, na ficha de cada um).</Item>
        <Item caixa>Cadastrar o e-mail de quem não tem, para ter duas formas de entrar.</Item>
        <Item caixa>Anotar o que a equipe pedir de ajuste e me trazer.</Item>
        <Text style={e.nota}>
          Para a faculdade, o trabalho final só pede: diagrama da metodologia, uma forma de prova dos resultados e
          três aprendizados. Quando você quiser, eu monto o rascunho no formato do modelo oficial.
        </Text>
      </Page>
    </Document>
  )
}

// Manual do usuário em PDF, gerado a partir de docs/manual-do-usuario.md ------------------
// O PDF usa fonte sem emoji: tira os símbolos (o texto já diz o nome de cada botão).
const EMOJIS = /[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu
const limpar = (s: string) =>
  s
    .replace(EMOJIS, '')
    .replace(/\*\*([^*]+)\*\*/g, (_, dentro: string) => `**${dentro.trim()}**`)
    .replace(/ {2,}/g, ' ')
    .trim()

function Inline({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return (
    <Text>
      {partes.map((parte, i) =>
        parte.startsWith('**') ? (
          <Text key={i} style={e.negrito}>{parte.slice(2, -2)}</Text>
        ) : parte.startsWith('`') ? (
          <Text key={i} style={{ fontFamily: 'Courier' }}>{parte.slice(1, -1)}</Text>
        ) : (
          parte
        ),
      )}
    </Text>
  )
}

function Manual({ logos, md }: { logos: Logos; md: string }) {
  const blocos = md.split(/\r?\n/).map(limpar).filter((l) => l.length > 0)
  const titulo = blocos.find((l) => l.startsWith('# '))?.slice(2) ?? 'Manual'
  return (
    <Document>
      <Page size="A4" style={[e.pagina, { paddingBottom: 46 }]}>
        <Timbre logos={logos} comBrasao={false} />
        <Text style={e.titulo}>{titulo}</Text>
        {blocos.filter((l) => !l.startsWith('# ')).map((l, i) => {
          if (l.startsWith('## ')) {
            return <Text key={i} style={[e.h2, { fontSize: 11.5, marginTop: 12 }]} minPresenceAhead={50}>{l.slice(3)}</Text>
          }
          if (l.startsWith('> ')) {
            return <Text key={i} style={[e.nota, { backgroundColor: '#f4f7fc', padding: 5, marginBottom: 4 }]}>{l.slice(2)}</Text>
          }
          const n = l.match(/^(\d+)\.\s+(.*)$/)
          if (n) {
            return (
              <View key={i} style={[e.item, { marginBottom: 3 }]} wrap={false}>
                <Text style={{ width: 16, fontWeight: 'bold', color: AZUL }}>{n[1]}.</Text>
                <View style={{ flex: 1 }}><Inline texto={n[2]} /></View>
              </View>
            )
          }
          return <View key={i} style={{ marginBottom: 5 }}><Inline texto={l} /></View>
        })}
        <Text
          fixed
          style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#666' }}
          render={({ pageNumber, totalPages }) => `Manual do usuário — CAEELA · página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  )
}

async function contarPaginas(buf: Buffer): Promise<number> {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

async function main() {
  const logos = await carregarLogos()
  const pasta = join(process.cwd(), 'docs', 'faculdade', 'para-assinar')
  mkdirSync(pasta, { recursive: true })
  const docs: [string, React.ReactElement][] = [
    ['1-Declaracao-de-parceria', <Declaracao key="d" logos={logos} />],
    ['2-Termo-de-entrega-e-aceite', <TermoAceite key="t" logos={logos} />],
    ['3-Autorizacao-de-imagem-e-depoimento', <AutorizacaoImagem key="a" logos={logos} />],
    ['4-Avaliacao-do-sistema-pela-equipe', <Avaliacao key="v" logos={logos} />],
    ['5-Lista-de-presenca-do-treinamento', <ListaPresenca key="l" logos={logos} />],
  ]
  for (const [nome, pagina] of docs) {
    const buf = await renderToBuffer(<Document>{pagina}</Document>)
    console.log(`${nome}: ${await contarPaginas(buf)} página(s)`)
  }
  const todos = await renderToBuffer(<Document>{docs.map(([, p]) => p)}</Document>)
  writeFileSync(join(pasta, 'CAEELA-Documentos-para-assinatura.pdf'), todos)
  writeFileSync(join(pasta, 'Roteiro-da-visita-13-10.pdf'), await renderToBuffer(<Roteiro />))
  const md = readFileSync(join(process.cwd(), 'docs', 'manual-do-usuario.md'), 'utf8')
  const manualPdf = await renderToBuffer(<Manual logos={logos} md={md} />)
  writeFileSync(join(process.cwd(), 'docs', 'Manual-do-usuario-CAEELA.pdf'), manualPdf)
  console.log(`Manual do usuário: ${await contarPaginas(manualPdf)} páginas.`)
  console.log(`Pacote completo: ${await contarPaginas(todos)} páginas. Salvo em ${pasta}`)
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
