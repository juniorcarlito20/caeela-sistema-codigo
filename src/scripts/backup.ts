import { spawn } from 'node:child_process'
import { createGzip } from 'node:zlib'
import { createWriteStream, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { PrismaClient } from '@prisma/client'
import { enviarArquivo } from '@/lib/storage'

export const PASTA_BACKUPS = 'backups'
export const RETENCAO_DIAS = 30

export const nomeDoArquivo = (agora: Date) =>
  `caeela-${agora.toISOString().slice(0, 10)}.sql.gz`

export function chavesAntigas(chaves: string[], agora: Date, dias = RETENCAO_DIAS): string[] {
  const limite = new Date(agora.getTime() - dias * 86400000)
  return chaves.filter((c) => {
    const m = c.match(/(\d{4}-\d{2}-\d{2})/)
    return m ? new Date(m[1]) < limite : false
  })
}

// Escolhe o dump mais recente entre nomes no padrão. Qualquer outro nome
// (inclusive tentativa de caminho como ../../x) é ignorado — a rota de
// download nunca monta caminho com o que o usuário manda.
export function escolherBackup(nomes: string[]): string | null {
  const validos = nomes.filter((n) => /^caeela-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(n))
  if (validos.length === 0) return null
  return validos.sort().at(-1)!
}

function rodarDump(url: string): { stream: NodeJS.ReadableStream; saida: Promise<void> } {
  const filho = spawn('pg_dump', [url], { stdio: ['ignore', 'pipe', 'pipe'] })
  let erro = ''
  filho.stderr?.on('data', (d: Buffer) => {
    erro += d.toString()
  })
  const saida = new Promise<void>((resolve, reject) => {
    filho.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') {
        reject(
          new Error(
            'Não achei o pg_dump nesta máquina. Instale as ferramentas de cliente do PostgreSQL (pacote postgresql-client) e tente de novo.',
          ),
        )
      } else {
        reject(e)
      }
    })
    filho.on('close', (codigo) => {
      if (codigo === 0) resolve()
      else reject(new Error(`pg_dump falhou (código ${codigo}): ${erro.trim()}`))
    })
  })
  // O consumidor sempre aguarda `saida`; este catch só evita que uma
  // rejeição tardia vire exceção não tratada e esconda a mensagem real.
  saida.catch(() => {})
  if (!filho.stdout) throw new Error('pg_dump não devolveu dados.')
  return { stream: filho.stdout, saida }
}

// Segunda cópia fora do provedor (Google Drive da instituição). Fica para a
// Tarefa 17, quando houver conta configurada: hoje a função existe mas ninguém
// chama — na época ela vai receber (caminhoLocal, nome). Ver docs/decisoes.md.
export async function enviarParaDrive(): Promise<void> {
  throw new Error(
    'Envio ao Google Drive desligado: falta configurar a conta da instituição (Tarefa 17).',
  )
}

export async function executarBackup(prisma = new PrismaClient()): Promise<string> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Defina o DATABASE_URL no arquivo .env antes do backup.')
  const agora = new Date()
  const nome = nomeDoArquivo(agora)

  const pasta = join(process.cwd(), '.arquivos', PASTA_BACKUPS)
  await fs.mkdir(pasta, { recursive: true })
  const destino = join(pasta, nome)
  try {
    const saidaArquivo = createWriteStream(destino)
    const { stream, saida } = rodarDump(url)
    await pipeline(stream, createGzip(), saidaArquivo)
    await saida
  } catch (e) {
    await fs.unlink(destino).catch(() => {})
    throw e
  }

  if (process.env.BUCKET_NOME) {
    const corpo = await fs.readFile(destino)
    await enviarArquivo(`${PASTA_BACKUPS}/${nome}`, corpo, 'application/gzip')
  }

  const arquivos = await fs.readdir(pasta)
  for (const velho of chavesAntigas(arquivos, agora)) {
    await fs.unlink(join(pasta, velho)).catch(() => {})
  }

  await prisma.configuracao.upsert({
    where: { id: 'unica' },
    update: { ultimoBackupEm: agora, ultimoBackupOk: true },
    create: { id: 'unica', ultimoBackupEm: agora, ultimoBackupOk: true },
  })
  await prisma.$disconnect().catch(() => {})
  return destino
}

const executadoDireto =
  process.argv[1]?.endsWith('backup.ts') || process.argv[1]?.endsWith('backup.js')
if (executadoDireto) {
  executarBackup()
    .then((destino) => {
      console.log(`Backup pronto em ${destino}.`)
      process.exit(0)
    })
    .catch((e: Error) => {
      console.error(`Backup falhou: ${e.message}`)
      process.exit(1)
    })
}
