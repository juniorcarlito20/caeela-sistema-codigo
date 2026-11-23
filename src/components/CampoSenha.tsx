'use client'

import { useState } from 'react'

export default function CampoSenha({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
  value,
  onChange,
}: {
  id: string
  name: string
  autoComplete: string
  required?: boolean
  minLength?: number
  placeholder: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={mostrar ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 pr-14 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex min-h-[44px] w-12 items-center justify-center text-slate-500"
      >
        {mostrar ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
