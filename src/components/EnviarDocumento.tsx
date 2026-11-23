'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import {
  LIMITE_DESCRICAO,
  ROTULOS_TIPO,
  TIPOS_DOCUMENTO,
  validarDescricao,
  validarEnvio,
  type TipoDocumento,
} from '@/domain/documentos'

function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function EnviarDocumento({ alunoId }: { alunoId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('LAUDO')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pronto, setPronto] = useState<File | null>(null)
  const [info, setInfo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [preparando, setPreparando] = useState(false)

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0] ?? null
    setErro('')
    setInfo('')
    setPronto(null)
    setArquivo(original)
    if (!original) return
    if (original.type.startsWith('image/')) {
      setPreparando(true)
      try {
        const comprimido = await imageCompression(original, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        })
        const final = new File([comprimido], original.name, { type: original.type })
        setPronto(final)
        setInfo(`${tamanhoLegivel(original.size)} → ${tamanhoLegivel(final.size)}`)
      } catch {
        setErro('Não consegui preparar a foto. Tente de novo.')
        setArquivo(null)
      }
      setPreparando(false)
    } else {
      setPronto(original)
    }
  }

  function cancelar() {
    setArquivo(null)
    setPronto(null)
    setInfo('')
    setErro('')
    setDescricao('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function enviar() {
    setErro('')
    const final = pronto ?? arquivo
    if (!final) {
      setErro('Toque em Fotografar novo e escolha o arquivo.')
      return
    }
    const problema = validarEnvio({ tamanhoBytes: final.size, mime: final.type })
    if (problema) {
      setErro(problema)
      return
    }
    const problemaDescricao = validarDescricao(descricao)
    if (problemaDescricao) {
      setErro(problemaDescricao)
      return
    }
    setEnviando(true)
    try {
      const dados = new FormData()
      dados.set('alunoId', alunoId)
      dados.set('tipo', tipo)
      if (descricao.trim()) dados.set('descricao', descricao.trim())
      dados.set('arquivo', final, final.name)
      const resposta = await fetch('/api/documentos', { method: 'POST', body: dados })
      const corpo = (await resposta.json()) as { erro?: string }
      if (!resposta.ok) {
        setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
        setEnviando(false)
        return
      }
      cancelar()
      router.refresh()
    } catch {
      setErro('Não consegui enviar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={escolher}
        className="hidden"
        aria-label="Escolher foto ou PDF"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-[56px] w-full items-center justify-center rounded-lg border-2 border-dashed border-[#0A63C9] bg-[#eef5ff] px-4 py-3 text-base font-bold text-[#0A63C9]"
      >
        📷 Fotografar novo
      </button>
      {arquivo && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            <strong>{arquivo.name}</strong>
            {info && <span className="text-slate-500"> · {info}</span>}
            {preparando && <span className="text-slate-500"> · preparando…</span>}
          </p>
          <div>
            <label
              htmlFor="doc-tipo"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Tipo do documento
            </label>
            <select
              id="doc-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoDocumento)}
              className="min-h-[56px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-3 text-base text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>
                  {ROTULOS_TIPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="doc-descricao"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Descrição (opcional)
            </label>
            <input
              id="doc-descricao"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={LIMITE_DESCRICAO}
              placeholder="Ex.: Dra. Ana — fonoaudiologia"
              className="min-h-[56px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-3 text-base text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enviando || preparando}
              onClick={enviar}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviar documento'}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={cancelar}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-3 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
    </div>
  )
}
