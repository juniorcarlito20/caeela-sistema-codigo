'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { AlunoEncontrado, ProfissionalEncontrado } from '@/lib/busca'

export default function BuscaRapida({ modo = 'normal' }: { modo?: 'normal' | 'secretaria' }) {
  const router = useRouter()
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [alunos, setAlunos] = useState<AlunoEncontrado[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalEncontrado[]>([])
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  useEffect(() => {
    if (termo.trim().length < 2) {
      setAlunos([])
      setProfissionais([])
      return
    }
    setCarregando(true)
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo.trim())}`)
        const corpo = await r.json()
        setAlunos(r.ok ? corpo.alunos : [])
        setProfissionais(r.ok ? corpo.profissionais : [])
      } catch {
        setAlunos([])
        setProfissionais([])
      }
      setCarregando(false)
    }, 300)
    return () => clearTimeout(id)
  }, [termo])

  function irPara(href: string) {
    setAberto(false)
    setTermo('')
    router.push(href)
  }

  const semResultado = !carregando && alunos.length === 0 && profissionais.length === 0

  return (
    <div ref={caixaRef} className="relative">
      <form action="/busca" method="get" role="search" className="flex items-center gap-1">
        <input
          type="search"
          name="q"
          minLength={2}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => setAberto(true)}
          placeholder="🔍 Buscar…"
          aria-label="Buscar aluno ou profissional"
          autoComplete="off"
          className="min-h-[44px] w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none md:w-56"
        />
      </form>
      {aberto && termo.trim().length >= 2 && (
        <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white text-left shadow-lg">
          {carregando && (
            <p className="px-3 py-2 text-xs text-slate-500">Buscando…</p>
          )}
          {semResultado && (
            <p className="px-3 py-2 text-xs text-slate-500">Nada encontrado.</p>
          )}
          {alunos.length > 0 && (
            <>
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Alunos
              </p>
              {alunos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => irPara(`/alunos/${a.id}`)}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f4f7fc]"
                >
                  <strong>{a.nome}</strong>{' '}
                  <span className="text-[11px] text-slate-400">· {a.matricula}</span>
                </button>
              ))}
            </>
          )}
          {profissionais.length > 0 && (
            <>
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Profissionais
              </p>
              {profissionais.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => irPara(modo === 'secretaria' ? `/equipe/${p.id}` : `/profissionais/${p.id}`)}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f4f7fc]"
                >
                  <strong>{p.nome}</strong>{' '}
                  <span className="text-[11px] text-slate-400">· {p.area}</span>
                </button>
              ))}
            </>
          )}
          {!semResultado && (
            <button
              type="button"
              onClick={() => irPara(`/busca?q=${encodeURIComponent(termo.trim())}`)}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-[12px] font-bold text-[#0A63C9]"
            >
              Ver todos os resultados →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
