import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscar } from '@/lib/busca'

export async function GET(req: Request) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.json({ erro: 'Entre para buscar.' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ erro: 'Digite ao menos 2 letras.' }, { status: 400 })
  }

  const resultado = await buscar(
    { id: sessao.user.id, perfil: sessao.user.perfil },
    q,
  )
  return NextResponse.json(resultado)
}
