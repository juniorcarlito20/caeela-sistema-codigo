import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const chaveDeAssinatura = (atendimentoId: string) => `assinaturas/${atendimentoId}.png`

export const chaveDeDocumento = (alunoId: string, nome: string) => {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\-]/g, '_')
  return `alunos/${alunoId}/${Date.now()}-${limpo}`
}

// Sem BUCKET_NOME definido, grava no disco (desenvolvimento). Com a variável,
// usa o bucket S3 (produção). A interface é a mesma nos dois modos.
const USAR_S3 = !!process.env.BUCKET_NOME
const PASTA_LOCAL = join(process.cwd(), '.arquivos')

let s3: S3Client | null = null
function clienteS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.BUCKET_REGION ?? 'auto',
      endpoint: process.env.BUCKET_ENDPOINT,
      credentials: {
        accessKeyId: process.env.BUCKET_KEY ?? '',
        secretAccessKey: process.env.BUCKET_SECRET ?? '',
      },
    })
  }
  return s3
}

function caminhoLocal(chave: string): string {
  const partes = chave.split('/').filter((p) => p !== '' && p !== '.' && p !== '..')
  return join(PASTA_LOCAL, ...partes)
}

export async function enviarArquivo(chave: string, corpo: Buffer, tipo: string): Promise<string> {
  if (USAR_S3) {
    await clienteS3().send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NOME!,
        Key: chave,
        Body: corpo,
        ContentType: tipo,
      }),
    )
    return chave
  }
  const caminho = caminhoLocal(chave)
  await mkdir(dirname(caminho), { recursive: true })
  await writeFile(caminho, corpo)
  await writeFile(`${caminho}.tipo`, tipo, 'utf-8')
  return chave
}

export async function lerArquivo(
  chave: string,
): Promise<{ corpo: Buffer; tipo: string } | null> {
  if (USAR_S3) {
    const resposta = await clienteS3().send(
      new GetObjectCommand({ Bucket: process.env.BUCKET_NOME!, Key: chave }),
    )
    if (!resposta.Body) return null
    const bytes = await resposta.Body.transformToByteArray()
    return {
      corpo: Buffer.from(bytes),
      tipo: resposta.ContentType ?? 'application/octet-stream',
    }
  }
  try {
    const caminho = caminhoLocal(chave)
    const [corpo, tipo] = await Promise.all([
      readFile(caminho),
      readFile(`${caminho}.tipo`, 'utf-8').catch(() => 'application/octet-stream'),
    ])
    return { corpo, tipo: tipo.trim() }
  } catch {
    return null
  }
}

export async function urlDoArquivo(chave: string, segundos = 300): Promise<string> {
  if (USAR_S3) {
    return getSignedUrl(
      clienteS3(),
      new GetObjectCommand({ Bucket: process.env.BUCKET_NOME!, Key: chave }),
      { expiresIn: segundos },
    )
  }
  const rota = chave.split('/').map(encodeURIComponent).join('/')
  return `/api/arquivos/${rota}`
}

// Apaga de verdade (usado pela limpeza da lixeira, após os 30 dias).
export async function excluirArquivo(chave: string): Promise<void> {
  if (USAR_S3) {
    await clienteS3().send(
      new DeleteObjectCommand({ Bucket: process.env.BUCKET_NOME!, Key: chave }),
    )
    return
  }
  const caminho = caminhoLocal(chave)
  await unlink(caminho).catch(() => {})
  await unlink(`${caminho}.tipo`).catch(() => {})
}

// Lista as chaves sob um prefixo (só o nome final, sem pastas).
export async function listarArquivos(prefixo: string): Promise<string[]> {
  if (USAR_S3) {
    const resposta = await clienteS3().send(
      new ListObjectsV2Command({ Bucket: process.env.BUCKET_NOME!, Prefix: prefixo }),
    )
    return (resposta.Contents ?? [])
      .map((o) => (o.Key ?? '').slice(prefixo.length))
      .filter((n) => n !== '')
  }
  const { readdir } = await import('node:fs/promises')
  return readdir(join(PASTA_LOCAL, prefixo)).catch(() => [] as string[])
}
