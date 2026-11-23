import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StyleSheet, Text, View, Image } from '@react-pdf/renderer'

export const AZUL = '#0A63C9'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function dataPorExtenso(data = new Date()): string {
  return `Licínio de Almeida – BA, ${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}.`
}

export type Logos = { logo: string; brasao: string }

// Lê os logos do disco e devolve como data URL para embutir no PDF.
export async function carregarLogos(): Promise<Logos> {
  const pasta = join(process.cwd(), 'public')
  const [logo, brasao] = await Promise.all([
    readFile(join(pasta, 'logo-caeela.png')),
    readFile(join(pasta, 'brasao-secretaria.png')),
  ])
  return {
    logo: `data:image/png;base64,${logo.toString('base64')}`,
    brasao: `data:image/png;base64,${brasao.toString('base64')}`,
  }
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: AZUL,
  },
  logo: { width: 52, height: 52 },
  brasao: { width: 110, height: 42 },
  centro: { flex: 1, textAlign: 'center' },
  nome: { fontSize: 9, fontWeight: 'bold', lineHeight: 1.4 },
  email: { fontSize: 8, color: '#444' },
  rodape: { fontSize: 9, textAlign: 'right', marginTop: 18 },
})

// Cabeçalho igual ao papel timbrado do centro.
export function Timbre({ logos, comBrasao = true }: { logos: Logos; comBrasao?: boolean }) {
  return (
    <View style={estilos.topo}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image style={estilos.logo} src={logos.logo} />
      <View style={estilos.centro}>
        <Text style={estilos.nome}>
          CENTRO DE ATENDIMENTO EDUCACIONAL ESPECIALIZADO{'\n'}DE LICÍNIO DE ALMEIDA
        </Text>
        <Text style={estilos.email}>Caeel2024@gmail.com</Text>
      </View>
      {comBrasao ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image style={estilos.brasao} src={logos.brasao} />
      ) : (
        <View style={estilos.logo} />
      )}
    </View>
  )
}

export function RodapeCidade({ data = new Date() }: { data?: Date }) {
  return <Text style={estilos.rodape}>{dataPorExtenso(data)}</Text>
}
