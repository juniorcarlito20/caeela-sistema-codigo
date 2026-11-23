import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { Timbre, type Logos } from './timbre'

export type DadosFrequencia = {
  profissional: string
  area: string
  mes: string
  previstos: number
  ausentes: number
  justificados: number
  naoJustificados: number
  percentual: number
  porTipo: { tipo: string; dias: number }[]
  datas: { dia: string; tipo: string }[]
  geradoEm: Date
  logos: Logos
}

const estilos = StyleSheet.create({
  pagina: { padding: 36, fontFamily: 'Helvetica', fontSize: 10.5, lineHeight: 1.5, color: '#111' },
  titulo: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 14, marginBottom: 4 },
  subtitulo: { fontSize: 10.5, textAlign: 'center', marginBottom: 12 },
  faixa: { backgroundColor: '#f4f7fc', padding: 7, borderRadius: 4, marginBottom: 8 },
  linha: { marginBottom: 3 },
  datas: { marginTop: 8 },
  itemData: { marginBottom: 2 },
})

function Relatorio({ dados }: { dados: DadosFrequencia }) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Timbre logos={dados.logos} />
        <Text style={estilos.titulo}>FREQUÊNCIA DO PROFISSIONAL</Text>
        <Text style={estilos.subtitulo}>
          {dados.profissional} · {dados.area} · {dados.mes}
        </Text>
        <Text style={estilos.faixa}>
          <Text style={{ fontWeight: 'bold' }}>{dados.previstos}</Text> dias previstos ·{' '}
          <Text style={{ fontWeight: 'bold' }}>{dados.ausentes}</Text> ausentes (
          {dados.justificados} justificados, {dados.naoJustificados} não justificados) ·{' '}
          <Text style={{ fontWeight: 'bold' }}>{dados.percentual}%</Text> de presença
        </Text>
        {dados.porTipo.length > 0 && (
          <View>
            {dados.porTipo.map((t) => (
              <Text key={t.tipo} style={estilos.linha}>
                {t.tipo}: {t.dias} {t.dias === 1 ? 'dia' : 'dias'}
              </Text>
            ))}
          </View>
        )}
        <View style={estilos.datas}>
          {dados.datas.map((d, i) => (
            <Text key={`${d.dia}-${i}`} style={estilos.itemData}>
              {d.dia} · {d.tipo}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export async function gerarFrequenciaPDF(dados: DadosFrequencia): Promise<Buffer> {
  return renderToBuffer(<Relatorio dados={dados} />)
}
