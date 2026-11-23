import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import Cabecalho from '@/components/Cabecalho'
import { formatarDataHora } from '@/lib/fuso'
import { lerMudanca } from '@/domain/desfazer'
import DesfazerAlteracaoBotao from '@/components/DesfazerAlteracaoBotao'

const ACOES: Record<string, string> = {
  // Alunos
  CADASTROU_ALUNO: 'Cadastrou aluno',
  EDITOU_ALUNO: 'Editou dados do aluno',
  MOVEU_PARA_ESPERA: 'Moveu aluno para a fila de espera',
  AJUSTOU_RETORNO_PAUSA: 'Ajustou a previsão de retorno da pausa',
  ENCAMINHOU_ALUNO: 'Encaminhou aluno para um profissional',
  SUGERIU_ENCAMINHAMENTO: 'Fez uma sugestão à direção',
  RESOLVEU_SUGESTAO: 'Resolveu uma sugestão de profissional',
  DESCARTOU_SUGESTAO: 'Descartou uma sugestão de profissional',
  TRANSFERIU_ALUNO: 'Transferiu aluno entre profissionais',
  ENCERROU_ATENDIMENTO: 'Encerrou atendimento (alta, desligamento ou pausa)',
  DESLIGOU_ALUNO: 'Desligou aluno (todos os atendimentos de uma vez)',
  DESFEZ_ENCERRAMENTO: 'Desfez encerramento',
  REGISTROU_PROVIDENCIA_FALTAS: 'Registrou providência de faltas',
  RESTAUROU_DA_LIXEIRA: 'Restaurou da lixeira',
  CADASTROU_PESSOA_DE_FORA: 'Cadastrou pessoa de fora do centro',
  // Agenda e horários
  MOVEU_HORARIO: 'Moveu horário',
  TIROU_DO_HORARIO: 'Liberou o horário de um aluno (continua aguardando horário)',
  EDITOU_HORARIO: 'Editou grupo ou periodicidade de horário',
  EDITOU_SEMANAS: 'Mudou as semanas de um aluno',
  NOVA_SEMANA: 'Criou uma semana nova na agenda',
  REMOVEU_SEMANA: 'Removeu uma semana da agenda',
  MOVEU_ALUNO_GRUPO: 'Moveu aluno de grupo (ou para atendimento individual)',
  TROCOU_ALUNOS: 'Trocou dois alunos de lugar',
  EDITOU_HORARIOS_ATENDIMENTO: 'Editou os horários de atendimento de um profissional',
  DESFEZ_ALTERACAO: 'Desfez uma alteração de agenda',
  TROCOU_HORARIOS: 'Trocou dois horários de lugar',
  TROCOU_SEMANA_GRUPO: 'Trocou a semana ativa de um grupo',
  AJUSTOU_SEMANA: 'Acertou a semana atual da agenda',
  MARCOU_DIA_SEM_ATENDIMENTO: 'Marcou um dia sem atendimento',
  DESMARCOU_DIA_SEM_ATENDIMENTO: 'Desmarcou um dia sem atendimento',
  PREPAROU_AVISO_SEM_ATENDIMENTO: 'Preparou aviso de dia sem atendimento',
  MARCOU_INDISPONIVEL: 'Marcou horário como indisponível',
  LIBEROU_HORARIO: 'Liberou horário indisponível',
  BLOQUEOU_DIA: 'Bloqueou um dia inteiro',
  LIBEROU_DIA: 'Liberou um dia inteiro',
  REGISTROU_AUSENCIA: 'Registrou ausência de profissional',
  EDITOU_AUSENCIA: 'Editou ausência de profissional',
  APAGOU_AUSENCIA: 'Apagou ausência de profissional',
  MARCOU_CONSULTA: 'Marcou consulta',
  DESMARCOU_CONSULTA: 'Desmarcou consulta',
  REGISTROU_CONSULTA: 'Registrou consulta',
  // Atendimento e prontuário
  REGISTROU_PRESENCA: 'Registrou presença ou falta',
  ESCREVEU_EVOLUCAO: 'Escreveu evolução',
  EDITOU_EVOLUCAO: 'Editou evolução',
  PREENCHEU_ANAMNESE: 'Preencheu anamnese',
  EDITOU_ANAMNESE: 'Editou anamnese',
  ENVIOU_DOCUMENTO: 'Enviou documento',
  EXCLUIU_DOCUMENTO: 'Excluiu documento',
  EXCLUIU_RELATORIO: 'Excluiu relatório',
  PREPAROU_LEMBRETE: 'Preparou lembrete de WhatsApp',
  // Profissionais e acessos
  CRIOU_ACESSO: 'Criou acesso ao sistema',
  EDITOU_PROFISSIONAL: 'Editou dados de profissional',
  TROCOU_PERFIL: 'Trocou o tipo de acesso de alguém',
  MUDOU_TIPO_AGENDA: 'Mudou o tipo de agenda de um profissional',
  ATIVOU_PROFISSIONAL: 'Ativou profissional',
  DESATIVOU_PROFISSIONAL: 'Desativou profissional',
  EXCLUIU_PROFISSIONAL: 'Excluiu profissional',
  GEROU_SENHA_PROVISORIA: 'Gerou senha provisória',
  TROCOU_PROPRIA_SENHA: 'Trocou a própria senha',
  // Consultas
  ABRIU_EVOLUCAO: 'Abriu evolução',
  ABRIU_CONSULTA: 'Abriu registro de consulta',
  ABRIU_ANAMNESE: 'Abriu anamnese',
  ABRIU_DOCUMENTO: 'Abriu documento',
  ABRIU_RELATORIO: 'Abriu relatório',
  GEROU_RELATORIO: 'Gerou relatório',
  BAIXOU_BACKUP: 'Baixou backup',
}

const GRUPOS: Record<string, string[]> = {
  'Alunos e atendimentos encerrados': [
    'CADASTROU_ALUNO', 'EDITOU_ALUNO', 'MOVEU_PARA_ESPERA', 'AJUSTOU_RETORNO_PAUSA',
    'ENCAMINHOU_ALUNO', 'TRANSFERIU_ALUNO', 'ENCERROU_ATENDIMENTO', 'DESLIGOU_ALUNO', 'DESFEZ_ENCERRAMENTO',
    'RESTAUROU_DA_LIXEIRA', 'CADASTROU_PESSOA_DE_FORA',
  ],
  'Sugestões dos profissionais': [
    'SUGERIU_ENCAMINHAMENTO', 'RESOLVEU_SUGESTAO', 'DESCARTOU_SUGESTAO',
  ],
  'Agenda e horários': [
    'MOVEU_HORARIO', 'TIROU_DO_HORARIO', 'EDITOU_HORARIO', 'EDITOU_SEMANAS', 'NOVA_SEMANA', 'REMOVEU_SEMANA', 'MOVEU_ALUNO_GRUPO', 'TROCOU_ALUNOS', 'EDITOU_HORARIOS_ATENDIMENTO', 'DESFEZ_ALTERACAO', 'TROCOU_HORARIOS', 'TROCOU_SEMANA_GRUPO', 'AJUSTOU_SEMANA', 'MARCOU_DIA_SEM_ATENDIMENTO', 'DESMARCOU_DIA_SEM_ATENDIMENTO',
    'MARCOU_INDISPONIVEL', 'LIBEROU_HORARIO', 'BLOQUEOU_DIA', 'LIBEROU_DIA',
    'REGISTROU_AUSENCIA', 'EDITOU_AUSENCIA', 'APAGOU_AUSENCIA',
    'MARCOU_CONSULTA', 'DESMARCOU_CONSULTA',
  ],
  'Atendimento e prontuário': [
    'REGISTROU_PRESENCA', 'REGISTROU_CONSULTA', 'ESCREVEU_EVOLUCAO', 'EDITOU_EVOLUCAO', 'PREENCHEU_ANAMNESE',
    'EDITOU_ANAMNESE', 'ENVIOU_DOCUMENTO', 'EXCLUIU_DOCUMENTO', 'EXCLUIU_RELATORIO', 'PREPAROU_LEMBRETE', 'PREPAROU_AVISO_SEM_ATENDIMENTO',
    'REGISTROU_PROVIDENCIA_FALTAS',
  ],
  'Profissionais e acessos': [
    'CRIOU_ACESSO', 'EDITOU_PROFISSIONAL', 'TROCOU_PERFIL', 'MUDOU_TIPO_AGENDA', 'ATIVOU_PROFISSIONAL', 'DESATIVOU_PROFISSIONAL', 'EXCLUIU_PROFISSIONAL',
    'GEROU_SENHA_PROVISORIA', 'TROCOU_PROPRIA_SENHA',
  ],
  'Quem abriu prontuários e relatórios': [
    'ABRIU_EVOLUCAO', 'ABRIU_CONSULTA', 'ABRIU_ANAMNESE', 'ABRIU_DOCUMENTO', 'GEROU_RELATORIO', 'ABRIU_RELATORIO', 'BAIXOU_BACKUP',
  ],
}

function parseDia(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [a, m, d] = v.split('-').map(Number)
  const data = new Date(a, m - 1, d, 12, 0, 0)
  return Number.isNaN(data.getTime()) ? null : data
}

export default async function PaginaRegistroAcessos({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; de?: string; ate?: string; tipo?: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user) redirect('/entrar')
  if (sessao.user.perfil !== 'ADMIN') redirect('/agenda')

  const { usuario, de, ate, tipo } = await searchParams
  const deData = parseDia(de)
  const ateData = parseDia(ate)

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })

  const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]))
  const acessos = await prisma.registroAcesso.findMany({
    where: {
      ...(usuario ? { usuarioId: usuario } : {}),
      ...(tipo && GRUPOS[tipo] ? { acao: { in: GRUPOS[tipo] } } : {}),
      ...(deData || ateData
        ? {
            criadoEm: {
              ...(deData ? { gte: deData } : {}),
              ...(ateData
                ? { lt: new Date(ateData.getTime() + 86400000) }
                : {}),
            },
          }
        : {}),
    },
    include: { usuario: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
    take: 200,
  })

  return (
    <div className="fundo-caeela min-h-screen bg-[#f4f7fc] text-[#16243b]">
      <Cabecalho nome={sessao.user.name ?? ''} detalhe="Direção" itemAtivo="Histórico" />
      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <h1 className="text-xl font-extrabold">Histórico</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Quem fez o quê e quando: alta ou desligamento, alterações de dados do aluno, ajustes
          de semana do rodízio e quem abriu prontuários. Mostra os 200 registros mais recentes.
          Mudanças de agenda feitas a partir de agora têm o botão <b>↩ Desfazer</b>.
        </p>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="reg-usuario" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Usuário
            </label>
            <select
              id="reg-usuario"
              name="usuario"
              defaultValue={usuario ?? ''}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reg-tipo" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Tipo
            </label>
            <select
              id="reg-tipo"
              name="tipo"
              defaultValue={tipo ?? ''}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            >
              <option value="">Todos</option>
              {Object.keys(GRUPOS).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reg-de" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              De
            </label>
            <input
              id="reg-de"
              type="date"
              name="de"
              defaultValue={de ?? ''}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reg-ate" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Até
            </label>
            <input
              id="reg-ate"
              type="date"
              name="ate"
              defaultValue={ate ?? ''}
              className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white"
          >
            Filtrar
          </button>
        </form>
        {acessos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Nenhum acesso registrado neste filtro.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#f4f7fc] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Quem</th>
                  <th className="px-3 py-2">O quê</th>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {acessos.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold">{a.usuario.nome}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {ACOES[a.acao] ?? a.acao} · {a.alvo}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatarDataHora(a.criadoEm)}
                    </td>
                    <td className="px-3 py-2">
                      {a.desfeitoEm ? (
                        <span className="text-[12px] text-slate-500">
                          Desfeito por {nomePorId.get(a.desfeitoPorId ?? '') ?? 'alguém'} em {formatarDataHora(a.desfeitoEm)}
                        </span>
                      ) : a.mudanca && lerMudanca(a.mudanca) ? (
                        <DesfazerAlteracaoBotao registroId={a.id} />
                      ) : a.mudanca ? (
                        <span className="text-[12px] text-slate-400">anterior à agenda em semanas</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
