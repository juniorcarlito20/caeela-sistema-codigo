'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function FiltroSituacaoAluno({
  opcoes,
  valorAtual,
}: {
  opcoes: { valor: string; rotulo: string }[]
  valorAtual: string
}) {
  const router = useRouter()
  const parametros = useSearchParams()

  function mudar(valor: string) {
    const novos = new URLSearchParams(parametros.toString())
    if (valor === '') {
      novos.delete('situacao')
    } else {
      novos.set('situacao', valor)
    }
    router.push(`/alunos?${novos.toString()}`)
  }

  return (
    <select
      name="situacao"
      value={valorAtual}
      onChange={(e) => mudar(e.target.value)}
      className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
    >
      <option value="">Todas, menos desligados</option>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  )
}
