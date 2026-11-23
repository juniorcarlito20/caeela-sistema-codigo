import { NextResponse } from 'next/server'
import { limparLixeira } from '@/lib/lixeira'

// Rotina de limpeza definitiva (futura tarefa agendada). Protegida por segredo:
// só quem tem o LIMPEZA_SEGREDO chama.
export async function POST(req: Request) {
  const segredo = process.env.LIMPEZA_SEGREDO
  if (!segredo || req.headers.get('x-segredo-limpeza') !== segredo) {
    return NextResponse.json({ erro: 'Sem autorização.' }, { status: 403 })
  }
  const resultado = await limparLixeira()
  return NextResponse.json(resultado)
}
