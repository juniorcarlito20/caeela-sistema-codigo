import { imcDoCampo, type Campo } from '@/domain/anamnese'

// O IMC calculado sozinho a partir do peso e da altura já digitados. Sem hooks: serve na tela de
// preencher (muda enquanto se digita) e na de ler. Não guarda nada: é refeito sempre.
export default function ResultadoImc({
  campo, respostas,
}: { campo: Campo; respostas: Record<string, string> }) {
  const imc = imcDoCampo(campo, respostas)
  return (
    <div className="rounded-lg border border-[#0A63C9]/30 bg-[#f4f7fc] px-3 py-2.5">
      <p className="text-sm font-bold text-slate-700">{campo.rotulo}</p>
      {imc ? (
        <p className="text-[18px] font-extrabold text-[#0A63C9]" aria-live="polite">{imc.texto}</p>
      ) : (
        <p className="text-[13px] text-slate-500" aria-live="polite">
          Aparece aqui quando você preencher o peso e a altura.
        </p>
      )}
      {campo.nota && <p className="mt-1 text-[11.5px] text-slate-500">{campo.nota}</p>}
    </div>
  )
}
