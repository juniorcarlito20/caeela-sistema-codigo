import { ROTULO_ENCAMINHAMENTO, retornoParaCampos, type Encaminhamento } from '@/domain/consultas'

export type DadosRegistroConsulta = {
  presentes: string | null
  registro: string
  encaminhamentos: string[]
  proximoPasso: string | null
  retornoEm?: Date | null
}

// O texto de um registro de consulta (sem o tipo, que cada tela mostra do seu jeito).
export default function DetalheRegistroConsulta({ r }: { r: DadosRegistroConsulta }) {
  const retorno = retornoParaCampos(r.retornoEm ?? null)
  return (
    <dl className="flex flex-col gap-1 text-[13px] text-slate-700">
      {r.presentes && (
        <div>
          <dt className="inline font-bold">Presentes: </dt>
          <dd className="inline">{r.presentes}</dd>
        </div>
      )}
      <div>
        <dt className="inline font-bold">Registro: </dt>
        <dd className="inline whitespace-pre-wrap break-words">{r.registro === '' ? '—' : r.registro}</dd>
      </div>
      {r.encaminhamentos.length > 0 && (
        <div>
          <dt className="inline font-bold">Encaminhamentos: </dt>
          <dd className="inline">
            {r.encaminhamentos.map((e) => ROTULO_ENCAMINHAMENTO[e as Encaminhamento] ?? e).join(', ')}
          </dd>
        </div>
      )}
      {r.proximoPasso && (
        <div>
          <dt className="inline font-bold">Próximo passo: </dt>
          <dd className="inline whitespace-pre-wrap">{r.proximoPasso}</dd>
        </div>
      )}
      {retorno && (
        <div>
          <dt className="inline font-bold">Retorno: </dt>
          <dd className="inline">
            {retorno.dia.split('-').reverse().join('/')} às {retorno.hora}
          </dd>
        </div>
      )}
    </dl>
  )
}
