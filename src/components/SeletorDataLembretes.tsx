'use client'

import { useRouter } from 'next/navigation'

export default function SeletorDataLembretes({ valorAtual }: { valorAtual: string }) {
  const router = useRouter()

  return (
    <div>
      <label htmlFor="lem-dia" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Ou escolha outra data
      </label>
      <input
        id="lem-dia"
        type="date"
        defaultValue={valorAtual}
        onChange={(e) => {
          if (e.target.value) router.push(`/lembretes?data=${e.target.value}`)
        }}
        className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
      />
    </div>
  )
}
