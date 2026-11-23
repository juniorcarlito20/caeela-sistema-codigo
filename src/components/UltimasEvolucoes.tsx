import type { EvolucaoAnterior } from '@/domain/evolucao'

const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })

// As últimas evoluções da criança, logo acima do formulário: para lembrar o que foi feito da
// última vez sem abrir o prontuário. A mais recente vem aberta; as outras, num toque.
export default function UltimasEvolucoes({ itens, euId }: { itens: EvolucaoAnterior[]; euId: string }) {
  return (
    <section aria-label="Últimas evoluções" className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-[14px] font-extrabold">Últimas evoluções</h2>
      {itens.length === 0 ? (
        <p className="mt-1 text-[13px] text-slate-500">Ainda não há evolução anterior desta criança para você.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {itens.map((e, i) => (
            <details key={e.id} open={i === 0} className="rounded-lg border border-slate-100 bg-[#f4f7fc] px-3 py-2">
              <summary className="cursor-pointer text-[13px] font-bold text-[#0A63C9]">
                {dataBR(e.data)} às {e.hora}
                {e.autorId !== euId && <span className="font-normal text-slate-500"> · {e.autorNome}</span>}
              </summary>
              <dl className="mt-1.5 flex flex-col gap-1 text-[13px] text-slate-700">
                <div>
                  <dt className="inline font-bold">Atividade: </dt>
                  <dd className="inline whitespace-pre-wrap">{e.atividade}</dd>
                </div>
                <div>
                  <dt className="inline font-bold">Objetivo: </dt>
                  <dd className="inline whitespace-pre-wrap">{e.objetivo}</dd>
                </div>
                {e.observacoes && (
                  <div>
                    <dt className="inline font-bold">Observações: </dt>
                    <dd className="inline whitespace-pre-wrap">{e.observacoes}</dd>
                  </div>
                )}
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
