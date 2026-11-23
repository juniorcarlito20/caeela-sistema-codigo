import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { Timbre, RodapeCidade, type Logos } from './timbre'
import type { AnexoAnamnese } from '@/domain/anexoAnamnese'

export type TipoRelatorioPDF = 'ACOMPANHAMENTO' | 'PAUSA' | 'ALTA'

const SUBTITULOS: Record<TipoRelatorioPDF, string> = {
  ACOMPANHAMENTO: 'DE ACOMPANHAMENTO',
  PAUSA: 'DE PAUSA NOS ATENDIMENTOS',
  ALTA: 'DE ALTA',
}

export type DadosRelatorio = {
  aluno: string
  matricula: string
  periodo: string
  area: string
  profissional: string
  tipo: TipoRelatorioPDF
  resumo: { total: number; realizados: number; faltas: number; justificadas: number; cancelados: number }
  texto: string
  codigo: string
  geradoEm: Date
  logos: Logos
  // Anamneses anexadas (depois da primeira folha). Vazio ou ausente: relatório sem anexo.
  anexos?: AnexoAnamnese[]
}

const estilos = StyleSheet.create({
  pagina: { padding: 36, fontFamily: 'Helvetica', fontSize: 10.5, lineHeight: 1.5, color: '#111' },
  titulo: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 14 },
  subtitulo: { fontSize: 10.5, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  linha: { marginBottom: 4 },
  faixa: {
    backgroundColor: '#f4f7fc',
    padding: 7,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  texto: { textAlign: 'justify', marginTop: 6 },
  assinaturas: { flexDirection: 'row', gap: 24, marginTop: 36, marginBottom: 4 },
  campo: { flex: 1, borderTopWidth: 1, borderTopColor: '#666', paddingTop: 3, fontSize: 9.5, textAlign: 'center' },
  verificacao: { fontSize: 8, color: '#666', textAlign: 'center', marginTop: 14 },
  anexoNota: { fontSize: 9.5, marginTop: 10, color: '#333' },
  secaoAnexo: { marginTop: 10 },
  tituloSecao: {
    fontSize: 11, fontWeight: 'bold', color: '#0A63C9', marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#c9d6ea', paddingBottom: 2,
  },
  linhaAnexo: { marginBottom: 3 },
  sigilo: { position: 'absolute', bottom: 16, left: 36, right: 36, fontSize: 8, color: '#666', textAlign: 'center' },
  quadro: { marginTop: 10, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#c9d6ea' },
  tituloQuadro: { fontSize: 11, fontWeight: 'bold', color: '#0A63C9' },
  linhaQuadro: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  trilho: { height: 8, marginTop: 3, borderRadius: 4, backgroundColor: '#e2e8f0' },
  barra: { height: 8, borderRadius: 4 },
  marca: { position: 'absolute', top: -2, width: 1.5, height: 12, backgroundColor: '#334155' },
  notaQuadro: { fontSize: 8.5, color: '#555', marginTop: 2 },
})

export function codigoVerificacao(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()
}

function DocumentoRelatorio({ dados }: { dados: DadosRelatorio }) {
  const anexos = dados.anexos ?? []
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Timbre logos={dados.logos} />
        <Text style={estilos.titulo}>RELATÓRIO</Text>
        <Text style={estilos.subtitulo}>{SUBTITULOS[dados.tipo]}</Text>
        <Text style={estilos.linha}>
          <Text style={{ fontWeight: 'bold' }}>Aluno: </Text>
          {dados.aluno} · <Text style={{ fontWeight: 'bold' }}>Matrícula: </Text>
          {dados.matricula}
        </Text>
        <Text style={estilos.linha}>
          <Text style={{ fontWeight: 'bold' }}>Período: </Text>
          {dados.periodo} · <Text style={{ fontWeight: 'bold' }}>Área: </Text>
          {dados.area} · <Text style={{ fontWeight: 'bold' }}>Profissional: </Text>
          {dados.profissional}
        </Text>
        <Text style={estilos.faixa}>
          <Text style={{ fontWeight: 'bold' }}>{dados.resumo.total}</Text> atendimentos ·{' '}
          <Text style={{ fontWeight: 'bold' }}>{dados.resumo.realizados}</Text> realizados ·{' '}
          <Text style={{ fontWeight: 'bold' }}>{dados.resumo.faltas}</Text>{' '}
          {dados.resumo.faltas === 1 ? 'falta' : 'faltas'} ·{' '}
          <Text style={{ fontWeight: 'bold' }}>{dados.resumo.justificadas}</Text> justificadas
          {dados.resumo.cancelados > 0
            ? ` · ${dados.resumo.cancelados} atendimentos cancelados pelo centro`
            : ''}
        </Text>
        <Text style={estilos.texto}>{dados.texto}</Text>
        {anexos.length > 0 && (
          <Text style={estilos.anexoNota}>
            Anexo(s): {anexos.map((a) => `${a.modelo} (preenchida em ${a.data.toLocaleDateString('pt-BR')})`).join('; ')}.
          </Text>
        )}
        <RodapeCidade data={dados.geradoEm} />
        <View style={estilos.assinaturas}>
          <Text style={estilos.campo}>Responsável</Text>
          <Text style={estilos.campo}>Profissional Responsável</Text>
        </View>
        <Text style={estilos.verificacao}>
          Documento gerado pelo sistema do CAEELA em{' '}
          {dados.geradoEm.toLocaleDateString('pt-BR')} — código de verificação {dados.codigo}
        </Text>
      </Page>
      {anexos.map((anexo, i) => (
        <Page key={i} size="A4" style={estilos.pagina}>
          <Timbre logos={dados.logos} />
          <Text style={estilos.titulo}>ANEXO · ANAMNESE</Text>
          <Text style={estilos.subtitulo}>{anexo.modelo}</Text>
          <Text style={estilos.linha}>
            <Text style={{ fontWeight: 'bold' }}>Aluno: </Text>
            {dados.aluno} · <Text style={{ fontWeight: 'bold' }}>Preenchida por: </Text>
            {anexo.autor} em {anexo.data.toLocaleDateString('pt-BR')}
          </Text>
          {anexo.quadro && (
            <View style={estilos.quadro} wrap={false}>
              <Text style={estilos.tituloQuadro}>Resultado da escala (triagem)</Text>
              {anexo.quadro.grupos.map((g) => {
                const largura = g.total > 0 ? (g.altos / g.total) * 100 : 0
                const marca = g.minimo !== null && g.total > 0 ? (g.minimo / g.total) * 100 : null
                const atingida = g.referencia === 'atingida'
                return (
                  <View key={g.nome}>
                    <View style={estilos.linhaQuadro}>
                      <Text style={{ fontWeight: 'bold' }}>{g.nome}</Text>
                      <Text>{g.altos} de {g.total} itens “Bastante” ou “Demais”</Text>
                    </View>
                    <View style={estilos.trilho}>
                      <View
                        style={[estilos.barra, { width: `${largura}%`, backgroundColor: atingida ? '#F0C000' : '#0A63C9' }]}
                      />
                      {marca !== null && <View style={[estilos.marca, { left: `${marca}%` }]} />}
                    </View>
                    <Text style={estilos.notaQuadro}>
                      {g.minimo !== null
                        ? `Marca = referência (${g.minimo} itens)${atingida ? ' · atingida' : g.referencia === 'incompleta' ? ' · faltam respostas' : ''}`
                        : 'Sem referência definida no questionário'}
                    </Text>
                  </View>
                )
              })}
              {anexo.quadro.sintese && (
                <Text style={{ fontWeight: 'bold', marginTop: 8 }}>{anexo.quadro.sintese}</Text>
              )}
              <Text style={estilos.notaQuadro}>
                Escala de triagem: não faz diagnóstico. O diagnóstico exige avaliação clínica completa.
              </Text>
            </View>
          )}
          {anexo.secoes.map((s) => (
            <View key={s.titulo} style={estilos.secaoAnexo}>
              <Text style={estilos.tituloSecao}>{s.titulo}</Text>
              {s.linhas.map((l, j) => (
                <Text key={j} style={estilos.linhaAnexo}>
                  <Text style={{ fontWeight: 'bold' }}>{l.rotulo}: </Text>
                  {l.resposta}
                </Text>
              ))}
              {s.resumo.length > 0 && (
                <View style={estilos.faixa}>
                  {s.resumo.map((t, j) => (
                    <Text key={j}>{t}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
          <Text style={estilos.sigilo} fixed>
            Documento com informações de saúde de criança. Uso restrito ao destinatário. · Código {dados.codigo}
          </Text>
        </Page>
      ))}
    </Document>
  )
}

export async function gerarRelatorioPDF(dados: DadosRelatorio): Promise<Buffer> {
  return renderToBuffer(<DocumentoRelatorio dados={dados} />)
}
