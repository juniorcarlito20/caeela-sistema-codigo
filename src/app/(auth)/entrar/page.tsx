import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import FormularioEntrar from '@/components/FormularioEntrar'

export default async function PaginaEntrar() {
  const sessao = await auth()
  if (sessao?.user) {
    redirect(
      sessao.user.precisaTrocarSenha
        ? '/trocar-senha'
        : sessao.user.perfil === 'ADMIN'
          ? '/painel'
          : '/agenda',
    )
  }

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
      <span
        aria-hidden
        className="absolute right-[30%] top-6 h-20 w-20 rounded-full bg-[#F0C000] opacity-25"
      />
      <div className="relative z-10 w-full max-w-[390px] rounded-xl border border-slate-200 bg-white px-6 py-7 text-center shadow-[0_12px_40px_rgba(10,99,201,0.18)]">
        <Image
          src="/logo-caeela.png"
          alt="Logo do CAEELA"
          width={120}
          height={120}
          priority
          className="mx-auto mb-2 h-[120px] w-[120px] object-contain"
        />
        <p className="text-[26px] font-black tracking-[4px] text-[#0070F0]">
          CAEELA
        </p>
        <p className="mb-5 text-[11.5px] tracking-[1px] text-slate-500">
          ACOLHER, INCLUIR E EDUCAR
        </p>
        <Suspense>
          <FormularioEntrar />
        </Suspense>
        <p className="mt-4 text-xs text-slate-500">
          Esqueceu a senha? Fale com a direção do centro.
        </p>
        <Image
          src="/brasao-secretaria.png"
          alt="Demonstração"
          width={190}
          height={74}
          className="mx-auto mt-5 h-auto w-[190px] object-contain opacity-90"
        />
      </div>
    </main>
  )
}
