import Link from 'next/link'
import { horasDaGrade, temSlot, type Slot } from '@/domain/grade'

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex']

export type SlotOcupado = {
  nome: string
  rotulo: string
  alunoId?: string // permite linkar pra ficha do aluno
}

// Quantos horários de atendimento o profissional tem na semana. Cada horário conta um só, tenha
// uma criança ou um grupo: o grupo é montado com o "+" e não tem tamanho fixo.
export function totalDeVagasNaSemana(slots: Slot[]): number {
  return slots.length
}

// `ocupados`: quem atende em cada lugar da grade (dia-hora); num horário de grupo, mais de uma criança.
export function livresNaSemana(
  slots: Slot[],
  ocupados: Map<string, SlotOcupado[]>,
  indisponiveisNaoOcupados = 0,
): number {
  const usadas = [...ocupados.values()].filter((lista) => lista.length > 0).length
  return Math.max(0, totalDeVagasNaSemana(slots) - usadas - indisponiveisNaoOcupados)
}

export default function GradeSemanal({
  ocupados,
  slots,
}: {
  ocupados: Map<string, SlotOcupado[]>
  slots: Slot[]
}) {
  if (ocupados.size === 0) {
    return (
      <p className="mt-1 text-[13px] text-slate-500">
        Nenhum horário marcado — agenda toda livre.
      </p>
    )
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-center text-[12.5px]">
        <thead>
          <tr>
            <th className="w-[64px] px-1 py-1 text-left text-[11px] uppercase text-slate-500">
              Hora
            </th>
            {DIAS.slice(1).map((d) => (
              <th key={d} className="px-1 py-1 text-[11px] uppercase text-slate-500">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horasDaGrade(slots).map((h) => (
            <tr key={h} className="border-t border-slate-100">
              <td className="px-1 py-1 text-left font-bold">{h}</td>
              {[1, 2, 3, 4, 5].map((d) => {
                const lista = ocupados.get(`${d}-${h}`) ?? []
                if (lista.length === 0 && !temSlot(slots, d, h)) {
                  return (
                    <td key={d} className="px-1 py-1 text-[15px] text-slate-300" title="Sem atendimento neste horário">
                      ·
                    </td>
                  )
                }
                if (lista.length === 0) {
                  return (
                    <td key={d} className="px-1 py-1">
                      <span className="inline-flex min-h-[32px] min-w-[44px] items-center justify-center rounded-full bg-[#e4f6e8] px-2 py-0.5 text-[11px] font-bold text-[#1c7a33]">
                        {h}
                      </span>
                    </td>
                  )
                }
                return (
                  <td key={d} className="px-1 py-1">
                    <div className="flex flex-col items-center gap-1">
                      {lista.map((oc, i) => {
                        const conteudo = (
                          <>
                            <span className="inline-flex min-h-[32px] min-w-[44px] items-center justify-center rounded-full bg-[#e6f0ff] px-2 py-0.5 text-[11px] font-bold text-[#0A63C9]">
                              {oc.nome}
                            </span>
                            {oc.rotulo !== '' && (
                              <span className="block text-[10px] font-bold text-slate-400">{oc.rotulo}</span>
                            )}
                          </>
                        )
                        return (
                          <div key={`${oc.alunoId ?? oc.nome}-${i}`}>
                            {oc.alunoId ? <Link href={`/alunos/${oc.alunoId}`}>{conteudo}</Link> : conteudo}
                          </div>
                        )
                      })}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
