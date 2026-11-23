import Link from 'next/link'
import AcoesSugestao from './AcoesSugestao'
import { FUSO } from '@/lib/fuso'
import { ROTULO_SITUACAO, rotuloTipo, type SugestaoTela } from '@/domain/sugestoes'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO })

// Uma sugestão numa lista: quem sugeriu, o texto, a situação e, se já foi fechada, a resposta
// da direção. `comAcoes` (só a direção) mostra os botões nas pendentes.
export default function CartaoSugestao({
  s, mostrarAluno, comAcoes,
}: { s: SugestaoTela; mostrarAluno: boolean; comAcoes: boolean }) {
  const tom =
    s.situacao === 'PENDENTE'
      ? 'bg-[#fff6d6] text-[#8a6100]'
      : s.situacao === 'RESOLVIDA'
        ? 'bg-[#e4f6e8] text-[#1c7a33]'
        : 'bg-slate-100 text-slate-500'
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {mostrarAluno && (
          <Link href={`/alunos/${s.alunoId}`} className="font-bold text-[#0A63C9]">
            {s.alunoNome}
          </Link>
        )}
        <strong>{rotuloTipo(s.tipo, s.areaNome)}</strong>
        <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${tom}`}>{ROTULO_SITUACAO[s.situacao]}</span>
      </div>
      <p className="text-[12.5px] text-slate-500">
        Sugerido por {s.autorNome} · {data(s.criadoEm)}
      </p>
      <p className="whitespace-pre-wrap">{s.texto}</p>
      {s.situacao !== 'PENDENTE' && (
        <div className={`rounded-lg px-3 py-2 text-[12.5px] ${s.situacao === 'RESOLVIDA' ? 'bg-[#e4f6e8]' : 'bg-slate-100'}`}>
          <strong>{s.situacao === 'RESOLVIDA' ? 'Resposta da direção' : 'Observação da direção'}:</strong>{' '}
          {s.observacaoDirecao ?? 'sem observação'}
          {s.fechadaEm && <span className="text-slate-500"> · {data(s.fechadaEm)}</span>}
        </div>
      )}
      {comAcoes && s.situacao === 'PENDENTE' && (
        <AcoesSugestao
          sugestaoId={s.id}
          linkFicha={s.tipo === 'PROFISSIONAL_DO_CENTRO' ? `/alunos/${s.alunoId}?aba=dados` : undefined}
        />
      )}
    </li>
  )
}
