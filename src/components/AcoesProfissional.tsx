'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { alternarSituacao, excluirProfissional, gerarSenhaProvisoria } from '@/app/(app)/profissionais/acoes'
import type { Perfil } from '@/domain/acesso'
import { DESCRICAO_TIPO_AGENDA, ROTULO_TIPO_AGENDA, TIPOS_AGENDA, type TipoAgenda } from '@/domain/tipoAgenda'

type Area = { id: string; nome: string }

export default function AcoesProfissional({
  id,
  nome,
  ativo,
  perfilAtual,
  vinculosAtivos = 0,
  areas,
  areaIdAtual,
  usuarioAtual,
  emailAtual,
  telefoneAtual,
  tipoAgendaAtual = 'FIXA',
}: {
  id: string
  nome: string
  ativo: boolean
  perfilAtual: Perfil
  vinculosAtivos?: number
  areas: Area[]
  areaIdAtual: string | null
  usuarioAtual: string
  emailAtual: string | null
  telefoneAtual: string | null
  tipoAgendaAtual?: TipoAgenda
}) {
  const router = useRouter()
  const [senhaNova, setSenhaNova] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(nome)
  const [usuarioEdit, setUsuarioEdit] = useState(usuarioAtual)
  const [areaEdit, setAreaEdit] = useState(areaIdAtual ?? '')
  const [emailEdit, setEmailEdit] = useState(emailAtual ?? '')
  const [telefoneEdit, setTelefoneEdit] = useState(telefoneAtual ?? '')
  const [perfilEdit, setPerfilEdit] = useState<Perfil>(perfilAtual)
  const [tipoAgendaEdit, setTipoAgendaEdit] = useState<TipoAgenda>(tipoAgendaAtual)

  async function mudarSituacao() {
    if (ativo) {
      const aviso =
        vinculosAtivos > 0
          ? `${nome} ainda atende ${vinculosAtivos} ${vinculosAtivos === 1 ? 'aluno' : 'alunos'}. Desativar agora deixa ${vinculosAtivos === 1 ? 'esse atendimento' : 'esses atendimentos'} sem profissional ativo — transfira em Agendas antes, se possível. Desativar mesmo assim?`
          : `Desativar ${nome}? A pessoa perde o acesso, mas o histórico dela fica guardado.`
      if (!window.confirm(aviso)) return
    }
    setErro('')
    setOcupado(true)
    try {
      await alternarSituacao(id, !ativo)
      router.refresh()
    } catch {
      setErro('Não foi possível salvar. Tente de novo.')
    }
    setOcupado(false)
  }

  async function novaSenha() {
    if (!window.confirm(`Gerar nova senha provisória para ${nome}? A senha atual dela deixa de funcionar.`)) {
      return
    }
    setErro('')
    setSenhaNova(null)
    setOcupado(true)
    const r = await gerarSenhaProvisoria(id)
    setOcupado(false)
    if (r.erro || !r.senha) {
      setErro(r.erro ?? 'Não foi possível gerar a senha. Tente de novo.')
      return
    }
    setSenhaNova(r.senha)
  }

  async function excluir() {
    setErro('')
    setOcupado(true)
    try {
      const r = await excluirProfissional(id)
      if (r.erro) {
        setErro(r.erro)
        setConfirmandoExclusao(false)
      } else {
        router.refresh()
      }
    } catch {
      setErro('Não foi possível excluir. Tente de novo.')
    }
    setOcupado(false)
  }

  async function salvarEdicao() {
    setErro('')
    setOcupado(true)
    const resposta = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nomeEdit,
        usuario: usuarioEdit,
        areaId: areaEdit === '' ? null : areaEdit,
        email: emailEdit.trim() === '' ? null : emailEdit,
        telefone: telefoneEdit.trim() === '' ? null : telefoneEdit,
        perfil: perfilEdit,
        tipoAgenda: perfilEdit === 'PROFISSIONAL' ? tipoAgendaEdit : 'FIXA',
      }),
    })
    const corpo = (await resposta.json()) as { erro?: string }
    setOcupado(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    setEditando(false)
    router.refresh()
  }

  if (editando) {
    return (
      <div className="flex w-[200px] flex-col gap-1">
        <input
          value={nomeEdit}
          onChange={(e) => setNomeEdit(e.target.value)}
          aria-label="Nome completo"
          placeholder="Nome completo"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        <input
          value={usuarioEdit}
          onChange={(e) => setUsuarioEdit(e.target.value.toLowerCase())}
          aria-label="Usuário de login"
          placeholder="Usuário de login"
          autoCapitalize="none"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        {usuarioEdit.trim() !== usuarioAtual && (
          <p className="text-[11px] text-slate-500">
            A pessoa passa a entrar com o usuário novo. Avise ela.
          </p>
        )}
        <select
          value={areaEdit}
          onChange={(e) => setAreaEdit(e.target.value)}
          aria-label="Área"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        >
          <option value="">Sem área definida</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <input
          type="email"
          value={emailEdit}
          onChange={(e) => setEmailEdit(e.target.value)}
          aria-label="E-mail"
          placeholder="E-mail (opcional)"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        <input
          type="tel"
          value={telefoneEdit}
          onChange={(e) => setTelefoneEdit(e.target.value)}
          aria-label="Telefone"
          placeholder="Telefone (opcional)"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        />
        <select
          value={perfilEdit}
          onChange={(e) => setPerfilEdit(e.target.value as Perfil)}
          aria-label="Tipo de acesso"
          className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
        >
          <option value="PROFISSIONAL">Profissional</option>
          <option value="SECRETARIA">Secretaria (agendamentos)</option>
          <option value="ADMIN">Direção (vê tudo)</option>
        </select>
        {perfilEdit !== perfilAtual && (
          <p className="text-[11px] text-slate-500">O novo acesso vale a partir da próxima vez que a pessoa entrar.</p>
        )}
        {perfilEdit === 'PROFISSIONAL' && (
          <select
            value={tipoAgendaEdit}
            onChange={(e) => setTipoAgendaEdit(e.target.value as TipoAgenda)}
            aria-label="Tipo de agenda"
            className="min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          >
            {TIPOS_AGENDA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_AGENDA[t]}
              </option>
            ))}
          </select>
        )}
        {perfilEdit === 'PROFISSIONAL' && (
          <p className="max-w-[320px] text-[11px] text-slate-500">{DESCRICAO_TIPO_AGENDA[tipoAgendaEdit]}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={salvarEdicao}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {ocupado ? '…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="inline-flex min-h-[44px] items-center px-2 text-xs text-slate-500"
          >
            Fechar
          </button>
        </div>
        {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setEditando(true)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-2 text-xs font-bold text-[#0A63C9] disabled:opacity-60"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={mudarSituacao}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#B3261E] bg-white px-3 py-2 text-xs font-bold text-[#B3261E] disabled:opacity-60"
        >
          {ativo ? 'Desativar' : 'Reativar'}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={novaSenha}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-3 py-2 text-xs font-bold text-[#0A63C9] disabled:opacity-60"
        >
          Nova senha
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => {
            setErro('')
            setConfirmandoExclusao(true)
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
        >
          Excluir
        </button>
      </div>
      {confirmandoExclusao && (
        <div className="w-full max-w-[280px] rounded-lg border-[1.5px] border-[#B3261E] bg-[#fdecea] p-2 text-[12.5px] text-[#B3261E]">
          <p>
            Excluir <strong>{nome.split(' ')[0]}</strong>? A pessoa some das listas e não entra mais no sistema. O
            histórico dela fica guardado, e a direção pode restaurar pela Lixeira.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={excluir}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#B3261E] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {ocupado ? 'Excluindo…' : 'Excluir'}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setConfirmandoExclusao(false)}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p role="alert" className="text-xs font-bold text-[#B3261E]">{erro}</p>}
      {senhaNova && (
        <p role="status" className="rounded-lg bg-[#F0C000]/20 px-3 py-2 text-xs text-slate-800">
          Senha provisória de {nome}: <strong>{senhaNova}</strong>
          <br />
          Anote e entregue à pessoa. Ela vai criar a própria senha no primeiro acesso.
        </p>
      )}
    </div>
  )
}
