'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import CampoSenha from './CampoSenha'

export default function FormularioEntrar() {
  const router = useRouter()
  const parametros = useSearchParams()
  const [acesso, setAcesso] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const resposta = await signIn('credentials', {
      login: acesso,
      senha,
      redirect: false,
    })
    setEnviando(false)
    if (resposta?.error) {
      setErro('Usuário ou senha incorretos.')
      return
    }
    router.push(parametros.get('callbackUrl') ?? '/')
    router.refresh()
  }

  return (
    <form onSubmit={entrar} className="w-full">
      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]"
        >
          {erro}
        </p>
      )}
      <div className="mb-4 text-left">
        <label
          htmlFor="acesso"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
        >
          Usuário ou e-mail
        </label>
        <input
          id="acesso"
          name="acesso"
          type="text"
          autoComplete="username"
          required
          value={acesso}
          onChange={(e) => setAcesso(e.target.value)}
          placeholder="Seu usuário ou e-mail"
          className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
        />
      </div>
      <div className="mb-5 text-left">
        <label
          htmlFor="senha"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
        >
          Senha
        </label>
        <CampoSenha
          id="senha"
          name="senha"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Sua senha"
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0A63C9] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
