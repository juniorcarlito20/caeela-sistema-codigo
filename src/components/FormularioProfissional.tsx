'use client'

import { useRef, useState } from 'react'
import { DESCRICAO_TIPO_AGENDA, ROTULO_TIPO_AGENDA, TIPOS_AGENDA, type TipoAgenda } from '@/domain/tipoAgenda'
import { useRouter } from 'next/navigation'

type Area = { id: string; nome: string }

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function baseSugerida(nome: string, area: string): string {
  const primeiro = semAcento(nome).split(/\s+/).filter(Boolean)[0] ?? ''
  const areaBase = semAcento(area).split(/\s+/).filter(Boolean)[0] ?? ''
  const limpo = (s: string) => s.replace(/[^a-z0-9]/g, '')
  if (!primeiro) return ''
  return areaBase ? `${limpo(primeiro)}.${limpo(areaBase)}` : limpo(primeiro)
}

export default function FormularioProfissional({
  areas,
  usuariosEmUso,
}: {
  areas: Area[]
  usuariosEmUso: string[]
}) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [area, setArea] = useState('')
  const [areaNova, setAreaNova] = useState('')
  const [usuario, setUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [perfil, setPerfil] = useState('PROFISSIONAL')
  const [tipoAgenda, setTipoAgenda] = useState<TipoAgenda>('FIXA')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const ultimaSugestao = useRef('')

  function sugerir(nomeAtual: string, nomeArea: string) {
    let base = baseSugerida(nomeAtual, nomeArea)
    if (!base) return
    const emUso = new Set(usuariosEmUso.map((u) => u.toLowerCase()))
    if (emUso.has(base)) {
      let n = 2
      while (emUso.has(`${base}${n}`)) n++
      base = `${base}${n}`
    }
    ultimaSugestao.current = base
    setUsuario(base)
  }

  function nomeDaAreaAtual(areaId: string, areaNovaAtual: string) {
    if (areaId === '__nova__') return areaNovaAtual
    return areas.find((a) => a.id === areaId)?.nome ?? ''
  }

  function aoMudarNome(v: string) {
    setNome(v)
    if (usuario === '' || usuario === ultimaSugestao.current) sugerir(v, nomeDaAreaAtual(area, areaNova) || (perfil === 'SECRETARIA' ? 'secretaria' : ''))
  }

  function aoMudarArea(v: string) {
    setArea(v)
    if (usuario === '' || usuario === ultimaSugestao.current) sugerir(nome, nomeDaAreaAtual(v, areaNova) || (perfil === 'SECRETARIA' ? 'secretaria' : ''))
  }

  function aoMudarPerfil(v: string) {
    setPerfil(v)
    if (usuario === '' || usuario === ultimaSugestao.current) sugerir(nome, nomeDaAreaAtual(area, areaNova) || (v === 'SECRETARIA' ? 'secretaria' : ''))
  }

  function aoMudarAreaNova(v: string) {
    setAreaNova(v)
    if (usuario === '' || usuario === ultimaSugestao.current) sugerir(nome, v)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setOk('')
    setEnviando(true)
    const resposta = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        usuario,
        email: email.trim() === '' ? null : email,
        telefone: telefone.trim() === '' ? null : telefone,
        areaId: area === '' || area === '__nova__' ? null : area,
        areaNome: area === '__nova__' ? areaNova.trim() : null,
        perfil,
        tipoAgenda: perfil === 'PROFISSIONAL' ? tipoAgenda : 'FIXA',
        senha,
      }),
    })
    const corpo = (await resposta.json()) as { erro?: string; usuario?: string }
    setEnviando(false)
    if (!resposta.ok) {
      setErro(corpo.erro ?? 'Não foi possível salvar. Tente de novo.')
      return
    }
    setOk(`Acesso criado: ${corpo.usuario}. Entregue a senha provisória à pessoa.`)
    setNome('')
    setUsuario('')
    setEmail('')
    setTelefone('')
    setSenha('')
    setTipoAgenda('FIXA')
    if (area === '__nova__') setArea('')
    setAreaNova('')
    ultimaSugestao.current = ''
    router.refresh()
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white"
      >
        + Novo profissional
      </button>
    )
  }

  return (
    <form
      onSubmit={salvar}
      className="mb-6 rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-1 text-base font-extrabold text-slate-800">
        Novo profissional
      </h2>
      <p className="mb-4 text-[13px] text-slate-500">
        A pessoa entra com a senha provisória e cria a própria senha no
        primeiro acesso.
      </p>
      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="mb-4 rounded-lg border border-[#2EA84A]/30 bg-[#2EA84A]/10 px-4 py-3 text-sm font-bold text-[#1c7a33]">
          {ok}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="novo-nome" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Nome completo
          </label>
          <input
            id="novo-nome"
            required
            minLength={3}
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value)}
            placeholder="Nome completo do profissional"
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="novo-area" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Área
          </label>
          <select
            id="novo-area"
            value={area}
            onChange={(e) => aoMudarArea(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          >
            <option value="">Sem área definida</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
            <option value="__nova__">+ Outra função (digitar)…</option>
          </select>
          {area === '__nova__' && (
            <input
              autoFocus
              required
              value={areaNova}
              onChange={(e) => aoMudarAreaNova(e.target.value)}
              placeholder="Ex.: Coordenação, Motorista, Cozinheira…"
              className="mt-2 min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
            />
          )}
        </div>
        <div>
          <label htmlFor="novo-usuario" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Usuário (sugerido automaticamente, pode editar)
          </label>
          <input
            id="novo-usuario"
            required
            minLength={3}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase())}
            placeholder="Gerado a partir do nome e da área"
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="novo-email" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            E-mail <span className="font-normal normal-case">(opcional)</span>
          </label>
          <input
            id="novo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Opcional"
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="novo-telefone" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Telefone <span className="font-normal normal-case">(opcional, só contato)</span>
          </label>
          <input
            id="novo-telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Opcional"
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="novo-perfil" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Perfil
          </label>
          <select
            id="novo-perfil"
            value={perfil}
            onChange={(e) => aoMudarPerfil(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none"
          >
            <option value="PROFISSIONAL">Profissional</option>
            <option value="SECRETARIA">Secretaria (agendamentos: lembretes e agendas, sem ficha de aluno)</option>
            <option value="ADMIN">Direção (vê tudo)</option>
          </select>
        </div>
        <div>
          <label htmlFor="novo-senha" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Senha provisória (6 caracteres ou mais)
          </label>
          <input
            id="novo-senha"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Ex.: caeela123"
            className="min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none"
          />
        </div>
        {perfil === 'PROFISSIONAL' && (
          <fieldset className="md:col-span-2">
            <legend className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Tipo de agenda
            </legend>
            <div className="grid gap-2 md:grid-cols-3">
              {TIPOS_AGENDA.map((t) => (
                <label
                  key={t}
                  className="flex min-h-[44px] cursor-pointer gap-2 rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 has-[:checked]:border-[#0A63C9] has-[:checked]:bg-[#e6f0ff]"
                >
                  <input
                    type="radio"
                    name="novo-tipo-agenda"
                    value={t}
                    checked={tipoAgenda === t}
                    onChange={() => setTipoAgenda(t)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-bold">{ROTULO_TIPO_AGENDA[t]}</span>
                    <span className="block text-[12.5px] text-slate-500">{DESCRICAO_TIPO_AGENDA[t]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2EA84A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Criar acesso'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-5 py-2.5 text-sm font-bold text-[#0A63C9]"
        >
          Fechar
        </button>
      </div>
    </form>
  )
}
