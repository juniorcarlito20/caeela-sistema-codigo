import { resumirEscala, type Campo } from '@/domain/anamnese'

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// Resumo de um grupo de itens 'escala': soma, média, itens "Bastante" ou "Demais" e, quando o
// questionário traz, a referência. É triagem: o texto nunca diz que há ou não há diagnóstico.
export default function ResumoEscala({
  campos, respostas, campo,
}: { campos: Campo[]; respostas: Record<string, string>; campo: Campo }) {
  const r = resumirEscala(campos, respostas, campo.secao)
  return (
    <div role="status" className="rounded-lg border border-[#0A63C9]/30 bg-[#e6f0ff] p-3 text-sm">
      <p className="font-extrabold text-[#0A63C9]">{campo.rotulo}</p>
      <ul className="mt-1 grid gap-0.5 text-slate-700 sm:grid-cols-2">
        <li>Respondidas: <strong>{r.respondidas} de {r.total}</strong></li>
        <li>Soma: <strong>{r.soma} de {r.somaMaxima}</strong></li>
        <li>Média por item: <strong>{r.media === null ? '—' : num(r.media)}</strong></li>
        <li>Itens “Bastante” ou “Demais”: <strong>{r.altos} de {r.total}</strong></li>
      </ul>
      {r.referencia === 'incompleta' && (
        <p className="mt-2 text-[12.5px] text-slate-600">
          Responda todos os itens do grupo para ver a referência de {r.minimo} itens.
        </p>
      )}
      {r.referencia === 'atingida' && (
        <p className="mt-2 rounded bg-[#fff6d6] px-2 py-1 text-[12.5px] font-bold text-[#8a6100]">
          Atinge a referência: {r.altos} itens “Bastante” ou “Demais” (referência: {r.minimo} ou mais).
        </p>
      )}
      {r.referencia === 'abaixo' && (
        <p className="mt-2 text-[12.5px] font-bold text-slate-600">Abaixo da referência de {r.minimo} itens.</p>
      )}
      {campo.nota && <p className="mt-2 text-[12px] text-slate-500">{campo.nota}</p>}
    </div>
  )
}
