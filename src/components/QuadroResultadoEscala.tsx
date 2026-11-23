import { quadroDeResultado, type Campo } from '@/domain/anamnese'

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// O resultado da escala num golpe de vista: uma barra por grupo (quantos itens "Bastante" ou
// "Demais"), a marca da referência do questionário e uma frase neutra. É triagem: o quadro nunca
// diz que há ou não há diagnóstico. Sem hooks: serve na tela de preencher e na de ler.
export default function QuadroResultadoEscala({
  campos, respostas,
}: { campos: Campo[]; respostas: Record<string, string> }) {
  const quadro = quadroDeResultado(campos, respostas)
  if (!quadro) return null
  const algumaResposta = quadro.grupos.some((g) => g.respondidas > 0)

  return (
    <section aria-label="Resultado da escala" className="rounded-xl border border-[#0A63C9]/30 bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-[#0A63C9]">Resultado da escala (triagem)</h2>
      {!algumaResposta ? (
        <p className="mt-1 text-[13px] text-slate-500">O resultado aparece aqui conforme você responde.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-4">
            {quadro.grupos.map((g) => {
              const largura = g.total > 0 ? (g.altos / g.total) * 100 : 0
              const marca = g.minimo !== null && g.total > 0 ? (g.minimo / g.total) * 100 : null
              const atingida = g.referencia === 'atingida'
              return (
                <li key={g.nome}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
                    <strong>{g.nome}</strong>
                    <span className="text-slate-600">
                      <strong className="text-[#16243b]">{g.altos} de {g.total}</strong> itens “Bastante” ou “Demais”
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${g.nome}: ${g.altos} de ${g.total} itens${marca !== null ? `, referência ${g.minimo}` : ''}`}
                    className="relative mt-1.5 h-4 rounded-full bg-slate-100"
                  >
                    <div
                      className={`h-4 rounded-full ${atingida ? 'bg-[#F0C000]' : 'bg-[#0A63C9]'}`}
                      style={{ width: `${largura}%` }}
                    />
                    {marca !== null && (
                      <div
                        title={`Referência do questionário: ${g.minimo} itens`}
                        className="absolute -top-[3px] h-[22px] w-[2px] bg-slate-700"
                        style={{ left: `${marca}%` }}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {g.minimo !== null ? (
                      <>
                        A marca ┃ é a referência ({g.minimo} itens)
                        {atingida && <strong className="text-[#8a6100]"> · atingida</strong>}
                        {g.referencia === 'incompleta' && ' · faltam respostas neste grupo'}
                      </>
                    ) : (
                      'Sem referência definida no questionário'
                    )}
                    {' · '}Soma {g.soma} de {g.somaMaxima} · Média {g.media === null ? '—' : num(g.media)}
                  </p>
                </li>
              )
            })}
          </ul>
          {quadro.sintese && (
            <p className="mt-3 rounded-lg bg-[#f4f7fc] px-3 py-2 text-[13.5px] font-bold text-[#16243b]">{quadro.sintese}</p>
          )}
          <p className="mt-2 text-[11.5px] text-slate-500">
            Escala de triagem: não faz diagnóstico. O diagnóstico exige avaliação clínica completa.
          </p>
        </>
      )}
    </section>
  )
}
