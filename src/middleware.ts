import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { paginaInicial, secretariaPodeAbrir } from '@/domain/acesso'

// Caminhos públicos: login, confirmação da família, autenticação e arquivos estáticos.
function caminhoPublico(pathname: string): boolean {
  return (
    pathname === '/entrar' ||
    pathname.startsWith('/confirmar') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/confirmar') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  if (caminhoPublico(pathname)) return NextResponse.next()

  if (!req.auth?.user) {
    const url = req.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (req.auth.user.precisaTrocarSenha && pathname !== '/trocar-senha') {
    const url = req.nextUrl.clone()
    url.pathname = '/trocar-senha'
    return NextResponse.redirect(url)
  }

  if (!req.auth.user.precisaTrocarSenha && pathname === '/trocar-senha') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Secretaria (agendamentos): só abre o que está na lista dela.
  if (req.auth.user.perfil === 'SECRETARIA' && !secretariaPodeAbrir(pathname, req.method)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ erro: 'Seu acesso não permite isso.' }, { status: 403 })
    }
    const url = req.nextUrl.clone()
    url.pathname = paginaInicial('SECRETARIA')
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] }
