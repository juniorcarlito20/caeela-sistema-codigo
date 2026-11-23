'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type DocumentoTela = {
  id: string
  tipo: string
  rotulo: string
  descricao: string | null
  nomeArquivo: string
  data: string
  enviadoPor: string
  url: string
  pdf: boolean
}

export default function GradeDocumentos({
  documentos,
  podeExcluir,
}: {
  documentos: DocumentoTela[]
  podeExcluir: boolean
}) {
  const router = useRouter()
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir ${nome}? Ele fica 30 dias na lixeira e a direção pode restaurar.`)) {
      return
    }
    setErro('')
    const resposta = await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    if (!resposta.ok) {
      setErro('Não foi possível excluir. Tente de novo.')
      return
    }
    router.refresh()
  }

  if (documentos.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Nenhum documento guardado ainda. Fotografe o primeiro acima.
      </p>
    )
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mb-3 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {documentos.map((d) => (
          <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            {d.pdf ? (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="block min-h-[44px]"
                aria-label={`Abrir ${d.rotulo} em nova aba`}
              >
                <span className="block text-3xl" aria-hidden>
                  📄
                </span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setAmpliada(d.url)}
                className="block min-h-[44px] w-full"
                aria-label={`Ampliar ${d.rotulo}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.url}
                  alt={d.rotulo}
                  loading="lazy"
                  className="mx-auto h-20 w-full rounded-lg object-cover"
                />
              </button>
            )}
            <p className="mt-2 text-[13px] font-bold">{d.rotulo}</p>
            {d.descricao && <p className="text-[11.5px] text-slate-600">{d.descricao}</p>}
            <p className="text-[11.5px] text-slate-500">
              {d.data} · {d.enviadoPor}
            </p>
            {podeExcluir && (
              <button
                type="button"
                onClick={() => excluir(d.id, d.rotulo)}
                className="mt-1 inline-flex min-h-[44px] items-center px-2 text-xs font-bold text-[#B3261E]"
              >
                Excluir
              </button>
            )}
          </div>
        ))}
      </div>
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-label="Documento ampliado"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada}
            alt="Documento ampliado"
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
          />
        </div>
      )}
    </>
  )
}
