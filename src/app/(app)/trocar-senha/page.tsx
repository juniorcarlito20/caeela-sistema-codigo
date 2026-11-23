import Image from 'next/image'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { registrarAcesso } from '@/lib/registro'
import CampoSenha from '@/components/CampoSenha'

async function trocarSenha(formData: FormData) {
  'use server'
  const sessao = await auth()
  if (!sessao?.user?.id) redirect('/entrar')
  const nova = String(formData.get('nova') ?? '')
  const confirma = String(formData.get('confirma') ?? '')
  if (nova.length < 8 || nova !== confirma) {
    redirect('/trocar-senha?erro=1')
  }
  await prisma.usuario.update({
    where: { id: sessao.user.id },
    data: {
      senhaHash: await bcrypt.hash(nova, 10),
      precisaTrocarSenha: false,
    },
  })
  await registrarAcesso(sessao.user.id, 'TROCOU_PROPRIA_SENHA', sessao.user.name ?? 'usuário')
  await signOut({ redirectTo: '/entrar?senha=ok' })
}

export default async function PaginaTrocarSenha({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  const { erro } = await searchParams

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#eef5ff] via-white to-[#eafaf0] px-4 py-8">
      <span
        aria-hidden
        className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#0070F0] opacity-25"
      />
      <span
        aria-hidden
        className="absolute -bottom-12 right-[8%] h-32 w-32 rounded-full bg-[#2EA84A] opacity-25"
      />
      <div className="relative z-10 w-full max-w-[390px] rounded-xl border border-slate-200 bg-white px-6 py-7 text-center shadow-[0_12px_40px_rgba(10,99,201,0.18)]">
        <Image
          src="/logo-caeela.png"
          alt="Logo do CAEELA"
          width={96}
          height={96}
          priority
          className="mx-auto mb-2 h-[96px] w-[96px] object-contain"
        />
        <h1 className="mb-1 text-xl font-extrabold text-slate-800">
          Crie sua senha
        </h1>
        <p className="mb-5 text-sm text-slate-500">
          Olá, {sessao.user.name}! Esta é sua senha provisória. Defina uma
          senha nova com 8 caracteres ou mais para começar a usar o sistema.
        </p>
        {erro && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-left text-sm font-bold text-[#B3261E]"
          >
            A senha precisa ter 8 caracteres ou mais e ser igual nos dois
            campos.
          </p>
        )}
        <form action={trocarSenha} className="w-full text-left">
          <div className="mb-4">
            <label
              htmlFor="nova"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Nova senha
            </label>
            <CampoSenha
              id="nova"
              name="nova"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="8 caracteres ou mais"
            />
          </div>
          <div className="mb-5">
            <label
              htmlFor="confirma"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Repita a nova senha
            </label>
            <CampoSenha
              id="confirma"
              name="confirma"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Repita a senha"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0A63C9] px-6 py-3 text-sm font-bold text-white"
          >
            Salvar senha e entrar
          </button>
        </form>
      </div>
    </main>
  )
}
