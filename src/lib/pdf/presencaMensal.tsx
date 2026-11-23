import { Document, Page, StyleSheet, Text, View, Image, renderToBuffer } from '@react-pdf/renderer'
import { Timbre, RodapeCidade, type Logos } from './timbre'

export type LinhaPresenca = {
  data: string
  hora: string
  aluno: string
  situacao: string
  assinatura: string | null // data URL da imagem, ou nulo
  registradoPor: string | null // quem confirmou, quando não há assinatura
}

export type DadosPresencaMensal = {
  titulo: string
  resumo: { total: number; realizados: number; faltas: number; justificadas: number }
  linhas: LinhaPresenca[]
  geradoEm: Date
  logos: Logos
}

const estilos = StyleSheet.create({
  pagina: { padding: 32, fontFamily: 'Helvetica', fontSize: 9.5, lineHeight: 1.4, color: '#111' },
  titulo: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 12, marginBottom: 10 },
  tabela: { borderWidth: 1, borderColor: '#ccc', borderRadius: 2 },
  cab: { flexDirection: 'row', backgroundColor: '#f4f7fc', fontWeight: 'bold' },
  linha: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee' },
  cData: { width: '14%', padding: 4 },
  cHora: { width: '10%', padding: 4 },
  cAluno: { width: '34%', padding: 4 },
  cSit: { width: '16%', padding: 4 },
  cAss: { width: '26%', padding: 4 },
  mini: { width: 90, height: 26, objectFit: 'contain' },
  resumo: { marginTop: 10, fontSize: 10 },
  direcao: { marginTop: 40, flexDirection: 'row', gap: 24 },
  campo: { flex: 1, borderTopWidth: 1, borderTopColor: '#666', paddingTop: 3, fontSize: 9, textAlign: 'center' },
})

function rotuloSituacao(s: string): string {
  if (s === 'REALIZADO') return 'Realizado'
  if (s === 'FALTOU') return 'Faltou'
  if (s === 'JUSTIFICOU') return 'Justificou'
  if (s === 'CANCELADO') return 'Cancelado'
  return 'Agendado'
}

function Folha({ dados }: { dados: DadosPresencaMensal }) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Timbre logos={dados.logos} />
        <Text style={estilos.titulo}>{dados.titulo}</Text>
        <View style={estilos.tabela}>
          <View style={estilos.cab}>
            <Text style={estilos.cData}>Data</Text>
            <Text style={estilos.cHora}>Hora</Text>
            <Text style={estilos.cAluno}>Aluno</Text>
            <Text style={estilos.cSit}>Situação</Text>
            <Text style={estilos.cAss}>Assinatura</Text>
          </View>
          {dados.linhas.map((l, i) => (
            <View key={`${l.data}-${l.hora}-${l.aluno}-${i}`} style={estilos.linha}>
              <Text style={estilos.cData}>{l.data}</Text>
              <Text style={estilos.cHora}>{l.hora}</Text>
              <Text style={estilos.cAluno}>{l.aluno}</Text>
              <Text style={estilos.cSit}>{rotuloSituacao(l.situacao)}</Text>
              <View style={estilos.cAss}>
                {l.assinatura ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image style={estilos.mini} src={l.assinatura} />
                ) : l.registradoPor ? (
                  <Text>Registrado por {l.registradoPor}</Text>
                ) : (
                  <Text>—</Text>
                )}
              </View>
            </View>
          ))}
        </View>
        <Text style={estilos.resumo}>
          Total: {dados.resumo.total} · Realizados: {dados.resumo.realizados} · Faltas:{' '}
          {dados.resumo.faltas} · Justificadas: {dados.resumo.justificadas}
        </Text>
        <RodapeCidade data={dados.geradoEm} />
        <View style={estilos.direcao}>
          <Text style={estilos.campo}>Direção do CAEELA</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function gerarPresencaMensalPDF(dados: DadosPresencaMensal): Promise<Buffer> {
  return renderToBuffer(<Folha dados={dados} />)
}
