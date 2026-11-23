'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const classeCampo =
  'min-h-[44px] w-full rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0A63C9] focus:outline-none'

type Modo = 'centro' | 'fora' | 'nova'
type Pessoa = { id: string; nome: string; deFora: boolean }
type Resultado = { id: string; nome: string; matricula: string; deFora: boolean }

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'centro', rotulo: 'Aluno do centro' },
  { id: 'fora', rotulo: 'Pessoa de fora já atendida' },
  { id: 'nova', rotulo: 'Cadastrar pessoa de fora' },
]

// Marca uma consulta avulsa. Sem `pessoa`, escolhe quem será atendido (aluno do centro, pessoa de
// fora já atendida ou cadastro novo). Com `pessoa`, é o "Marcar retorno": só pede dia e hora.
export default function MarcarConsulta({
  profissionalId,
  profissionalNome,
  rotulo,
  pessoa,
  diaMinimo,
  hojeISO,
  destaque = false,
  alinharDireita = false,
}: {
  profissionalId: string
  profissionalNome: string
  rotulo: string
  pessoa?: Pessoa
  // Profissional só pode marcar até 30 dias para trás (a direção, qualquer dia).
  diaMinimo?: string
  // Com hojeISO: se o dia escolhido já passou (atendimento lançado depois), ao marcar já abre a
  // tela de atender.
  hojeISO?: string
  destaque?: boolean
  // Na linha de uma pessoa, o botão fica no canto direito.
  alinharDireita?: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<Modo>('centro')
  const [escolhida, setEscolhida] = useState<Pessoa | null>(pessoa ?? null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [nome, setNome] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [ligadoAoAluno, setLigadoAoAluno] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pedido = useRef(0)

  function fechar() {
    setAberto(false)
    setErro('')
  }

  function trocarModo(novo: Modo) {
    setModo(novo)
    setEscolhida(null)
    setBusca('')
    setResultados(null)
    setErro('')
  }

  function digitar(texto: string, modoAtual: Modo) {
    setBusca(texto)
    if (temporizador.current) clearTimeout(temporizador.current)
    if (texto.trim().length < 2) {
      setResultados(null)
      return
    }
    const numero = ++pedido.current
    temporizador.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/consultas/pessoas?modo=${modoAtual}&q=${encodeURIComponent(texto.trim())}`)
        const corpo = (await r.json().catch(() => ({}))) as { pessoas?: Resultado[] }
        if (numero === pedido.current) setResultados(r.ok ? (corpo.pessoas ?? []) : [])
      } catch {
        if (numero === pedido.current) setResultados([])
      }
    }, 300)
  }

  async function marcar() {
    setErro('')
    if (!data) {
      setErro('Informe o dia da consulta.')
      return
    }
    if (diaMinimo && data < diaMinimo) {
      setErro('Só dá para lançar até 30 dias atrás. Fale com a direção.')
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      setErro('Informe a hora da consulta.')
      return
    }
    const corpo: Record<string, unknown> = { profissionalId, data, hora }
    if (!pessoa && modo === 'nova') {
      if (nome.trim().length < 3) {
        setErro('O nome precisa ter 3 letras ou mais.')
        return
      }
      corpo.novaPessoa = {
        nome: nome.trim(),
        nascimento: nascimento || null,
        whatsapp,
        responsavel,
        ligadoAoAluno,
        observacoes,
      }
    } else {
      if (!escolhida) {
        setErro('Escolha a pessoa.')
        return
      }
      corpo.alunoId = escolhida.id
    }
    setEnviando(true)
    try {
      const r = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const resposta = (await r.json().catch(() => ({}))) as { erro?: string; id?: string }
      if (!r.ok) {
        setErro(resposta.erro ?? 'Não foi possível marcar. Tente de novo.')
        setEnviando(false)
        return
      }
      if (hojeISO && data < hojeISO && resposta.id) {
        router.push(`/consultas/${resposta.id}`)
        return
      }
      setAberto(false)
      setData('')
      setHora('')
      setNome('')
      setNascimento('')
      setWhatsapp('')
      setResponsavel('')
      setLigadoAoAluno('')
      setObservacoes('')
      if (!pessoa) trocarModo(modo)
      router.refresh()
    } catch {
      setErro('Não foi possível marcar. Verifique a internet e tente de novo.')
    }
    setEnviando(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`${
          destaque
            ? 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-4 py-2 text-sm font-bold text-white'
            : 'inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-[#0A63C9] bg-white px-4 py-2 text-sm font-bold text-[#0A63C9]'
        }${alinharDireita ? ' ml-auto' : ''}`}
      >
        {rotulo}
      </button>
    )
  }

  return (
    <div className="flex w-full basis-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-[#16243b]">
      <p className="font-extrabold">
        {pessoa ? `Marcar retorno de ${pessoa.nome}` : 'Marcar consulta'} · {profissionalNome}
      </p>

      {!pessoa && (
        <fieldset>
          <legend className="text-[12px] font-bold text-slate-600">Quem será atendido</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={modo === m.id}
                onClick={() => trocarModo(m.id)}
                className={
                  modo === m.id
                    ? 'min-h-[44px] rounded-lg bg-[#0A63C9] px-3 py-2 text-[13px] font-bold text-white'
                    : 'min-h-[44px] rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-[13px] font-bold text-slate-600'
                }
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!pessoa && modo !== 'nova' && (
        <div>
          {escolhida ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#e6f0ff] px-3 py-2">
              <strong>{escolhida.nome}</strong>
              <button
                type="button"
                onClick={() => setEscolhida(null)}
                className="ml-auto min-h-[44px] px-2 text-[13px] font-bold text-[#0A63C9]"
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              <label htmlFor={`consulta-busca-${profissionalId}`} className="mb-1 block text-[12px] font-bold text-slate-600">
                {modo === 'centro' ? 'Buscar aluno (nome ou matrícula)' : 'Buscar pessoa de fora (nome, matrícula ou telefone)'}
              </label>
              <input
                id={`consulta-busca-${profissionalId}`}
                type="search"
                value={busca}
                onChange={(e) => digitar(e.target.value, modo)}
                autoComplete="off"
                className={classeCampo}
              />
              {resultados !== null && (
                <ul className="mt-2 flex flex-col gap-1">
                  {resultados.length === 0 && <li className="text-[13px] text-slate-500">Ninguém encontrado.</li>}
                  {resultados.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEscolhida({ id: p.id, nome: p.nome, deFora: p.deFora })
                          setResultados(null)
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-bold">{p.nome}</span>
                        <span className="text-[12px] text-slate-500">{p.matricula}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {!pessoa && modo === 'nova' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            Nome (obrigatório)
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={classeCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            Nascimento (opcional)
            <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className={classeCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            WhatsApp (opcional)
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={classeCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            Responsável (opcional)
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={classeCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            Ligado ao aluno (opcional, ex.: mãe de um aluno)
            <input value={ligadoAoAluno} onChange={(e) => setLigadoAoAluno(e.target.value)} className={classeCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
            Observação (opcional)
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className={`${classeCampo} min-h-[72px]`}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[12px] font-bold text-slate-600">
          Dia
          <input type="date" value={data} min={diaMinimo} onChange={(e) => setData(e.target.value)} className={classeCampo} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[12px] font-bold text-slate-600">
          Hora
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={classeCampo} />
        </label>
      </div>
      {hojeISO && data !== '' && data < hojeISO && (
        <p className="text-[12.5px] font-bold text-[#0A63C9]">
          Dia que já passou: ao marcar, a tela de atender abre em seguida para você lançar o atendimento.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-[13px] font-bold text-[#B3261E]">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={marcar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Marcando…' : 'Marcar'}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={fechar}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
