import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/db/prisma'
import type { Perfil } from '@/domain/acesso'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      perfil: Perfil
      areaId: string | null
      precisaTrocarSenha: boolean
    } & DefaultSession['user']
  }
  interface User {
    perfil: Perfil
    areaId: string | null
    precisaTrocarSenha: boolean
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    perfil?: Perfil
    areaId?: string | null
    precisaTrocarSenha?: boolean
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Permite acessar por IP na rede local (celular, tablet), não só por "localhost".
  // Em produção o domínio real é fixo, então isso não abre brecha nenhuma lá.
  trustHost: true,
  pages: { signIn: '/entrar' },
  // Computador compartilhado entre profissionais: se alguém esquecer de clicar
  // em "Sair", a sessão expira sozinha em até um turno de trabalho.
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        login: { label: 'Usuário ou e-mail' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(dados) {
        const login = String(dados?.login ?? '').toLowerCase().trim()
        const senha = String(dados?.senha ?? '')
        if (!login || !senha) return null
        const usuario = await prisma.usuario.findFirst({
          where: login.includes('@') ? { email: login } : { usuario: login },
        })
        if (!usuario || !usuario.ativo || usuario.excluidoEm) return null
        const ok = await bcrypt.compare(senha, usuario.senhaHash)
        if (!ok) return null
        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
          areaId: usuario.areaId,
          precisaTrocarSenha: usuario.precisaTrocarSenha,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.perfil = user.perfil
        token.areaId = user.areaId
        token.precisaTrocarSenha = user.precisaTrocarSenha
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub ?? ''
      session.user.perfil = token.perfil ?? 'PROFISSIONAL'
      session.user.areaId = token.areaId ?? null
      session.user.precisaTrocarSenha = token.precisaTrocarSenha ?? false
      return session
    },
  },
})
