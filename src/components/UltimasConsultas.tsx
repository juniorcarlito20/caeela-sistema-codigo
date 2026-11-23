import { ROTULO_TIPO_CONSULTA, type ConsultaAnterior, type TipoConsultaRegistro } from '@/domain/consultas'
import DetalheRegistroConsulta from '@/components/DetalheRegistroConsulta'

const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })

// As últimas consultas da pessoa com este profissional, logo acima do formulário: para lembrar o
// que foi conversado sem abrir a ficha. A mais recente vem aberta; as outras, num toque.
export default function UltimasConsultas({ itens, euId }: { itens: ConsultaAnterior[]; euId: string }) {
  return (
    <section aria-label="Últimas consultas" className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-[14px] font-extrabold">Últimas consultas</h2>
      {itens.length === 0 ? (
        <p className="mt-1 text-[13px] text-slate-500">Ainda não há consulta anterior desta pessoa para você.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {itens.map((c, i) => (
            <details key={c.id} open={i === 0} className="rounded-lg border border-slate-100 bg-[#f4f7fc] px-3 py-2">
              <summary className="cursor-pointer text-[13px] font-bold text-[#0A63C9]">
                {dataBR(c.data)} às {c.hora} · {ROTULO_TIPO_CONSULTA[c.tipo as TipoConsultaRegistro] ?? c.tipo}
                {c.autorId !== euId && <span className="font-normal text-slate-500"> · {c.autorNome}</span>}
              </summary>
              <div className="mt-1.5">
                <DetalheRegistroConsulta r={c} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
