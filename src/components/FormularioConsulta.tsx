'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ENCAMINHAMENTOS,
  LIMITE_REGISTRO_CONSULTA,
  ROTULO_ENCAMINHAMENTO,
  ROTULO_TIPO_CONSULTA,
  type CamposDoRegistro,
  type TipoConsultaRegistro,
} from '@/domain/consultas'

const classeCampo =
  'min-h-[56px] w-full rounded-lg border-[1.5px] border-slate-300 px-3 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#0A63C9] focus:outline-none'
const classeRotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500'
const classeOpcao =
  'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-800 has-[:checked]:border-[#0A63C9] has-[:checked]:bg-[#e6f0ff]'

export type RegistroInicial = {
  situacao: 'REALIZADO' | 'FALTOU'
  tipo: TipoConsultaRegistro
  presentes: string
  registro: string
  encaminhamentos: string[]
  proximoPasso: string
  retornoData: string
  retornoHora: string
}

// Formulário do registro de uma consulta avulsa. Se já existe registro, vem preenchido e salva
// como edição. O texto do registro é longo (aceita colar uma transcrição) e a caixa cresce com ele.
export default function FormularioConsulta({
  atendimentoId,
  inicial,
  hojeISO,
  campos,
  linkSugestoes,
}: {
  atendimentoId: string
  inicial: RegistroInicial | null
  hojeISO: string
  campos: CamposDoRegistro
  linkSugestoes: string
}) {
  const router = useRouter()
  const [situacao, setSituacao] = useState<'REALIZADO' | 'FALTOU'>(inicial?.situacao ?? 'REALIZADO')
  const [tipo, setTipo] = useState<TipoConsultaRegistro>(
    inicial && campos.tipos.includes(inicial.tipo) ? inicial.tipo : campos.tipos[0],
  )
  const [presentes, setPresentes] = useState(inicial?.presentes ?? '')
  const [registro, setRegistro] = useState(inicial?.registro ?? '')
  const [encaminhamentos, setEncaminhamentos] = useState<string[]>(inicial?.encaminhamentos ?? [])
  const [proximoPasso, setProximoPasso] = useState(inicial?.proximoPasso ?? '')
  const [retornoData, setRetornoData] = useState(inicial?.retornoData ?? '')
  const [retornoHora, setRetornoHora] = useState(inicial?.retornoHora ?? '')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const caixa = useRef<HTMLTextAreaElement>(null)

  // A caixa do registro cresce junto com o texto (o mínimo vem de rows e da classe min-h).
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [registro])

  function alternar(codigo: string) {
    setEncaminhamentos((atual) => (atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo]))
  }

  async function salvar() {
    setErro('')
    if (situacao === 'REALIZADO' && registro.trim() === '') {
      setErro('Escreva o registro da consulta.')
      return
    }
    if (registro.length > LIMITE_REGISTRO_CONSULTA) {
      setErro('O registro passou de 100.000 caracteres. Divida em duas partes.')
      return
    }
    if (retornoData !== '' && retornoHora === '') {
      setErro('Informe a hora do retorno.')
      return
    }
    if (retornoData === '' && retornoHora !== '') {
      setErro('Informe a data do retorno.')
      return
    }
    setEnviando(true)
    try {
      const resposta = await fetch(`/api/consultas/${atendimentoId}/registro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situacao,
          tipo,
          presentes,
          registro,
          encaminhamentos: campos.encaminhamentos ? encaminhamentos : [],
          proximoPasso,
          retornoData: retornoData || null,
          retornoHora: retornoHora || null,
        }),
      })
      const resultado = (await resposta.json().catch(() => ({}))) as { erro?: string }
      if (!resposta.ok) {
        setErro(resultado.erro ?? 'Não foi possível salvar. Tente de novo.')
        setEnviando(false)
        return
      }
      router.push('/consultas?ok=1')
      router.refresh()
    } catch {
      setErro('Não foi possível salvar. Verifique a internet e tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {erro && (
        <p role="alert" className="rounded-lg border border-[#B3261E]/30 bg-[#B3261E]/10 px-4 py-3 text-sm font-bold text-[#B3261E]">
          {erro}
        </p>
      )}

      <fieldset>
        <legend className={classeRotulo}>Aconteceu?</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(
            [
              ['REALIZADO', 'Sim, a consulta aconteceu'],
              ['FALTOU', 'A pessoa faltou'],
            ] as const
          ).map(([valor, rotulo]) => (
            <label key={valor} className={`${classeOpcao} sm:flex-1`}>
              <input
                type="radio"
                name="consulta-situacao"
                value={valor}
                checked={situacao === valor}
                onChange={() => setSituacao(valor)}
              />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={classeRotulo}>Tipo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {campos.tipos.map((t) => (
            <label key={t} className={classeOpcao}>
              <input type="radio" name="consulta-tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
              {ROTULO_TIPO_CONSULTA[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="consulta-presentes" className={classeRotulo}>
          Quem estava presente <span className="font-normal normal-case">(opcional)</span>
        </label>
        <input
          id="consulta-presentes"
          type="text"
          maxLength={300}
          value={presentes}
          onChange={(e) => setPresentes(e.target.value)}
          placeholder="Ex.: mãe e a criança"
          className={classeCampo}
        />
      </div>

      <div>
        <label htmlFor="consulta-registro" className={classeRotulo}>
          Registro da consulta{' '}
          <span className="font-normal normal-case">
            {situacao === 'REALIZADO' ? '(obrigatório)' : '(opcional)'}
          </span>
        </label>
        <textarea
          id="consulta-registro"
          ref={caixa}
          rows={12}
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
          placeholder="Escreva ou cole aqui o que foi conversado"
          className={`${classeCampo} min-h-[18rem] resize-y overflow-hidden`}
        />
        <p
          className={`mt-1 text-right text-[11.5px] ${registro.length > LIMITE_REGISTRO_CONSULTA ? 'font-bold text-[#B3261E]' : 'text-slate-400'}`}
        >
          {registro.length.toLocaleString('pt-BR')} de {LIMITE_REGISTRO_CONSULTA.toLocaleString('pt-BR')}
        </p>
      </div>

      {campos.encaminhamentos && (
        <fieldset>
          <legend className={classeRotulo}>
            Encaminhamentos <span className="font-normal normal-case">(marque os que houver)</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ENCAMINHAMENTOS.map((e) => (
              <label key={e} className={classeOpcao}>
                <input type="checkbox" checked={encaminhamentos.includes(e)} onChange={() => alternar(e)} />
                {ROTULO_ENCAMINHAMENTO[e]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="consulta-proximo" className={classeRotulo}>
          Próximo passo <span className="font-normal normal-case">(opcional)</span>
        </label>
        <input
          id="consulta-proximo"
          type="text"
          maxLength={1000}
          value={proximoPasso}
          onChange={(e) => setProximoPasso(e.target.value)}
          placeholder={campos.exemploProximoPasso}
          className={classeCampo}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13.5px] text-slate-700">
        Precisa de outro profissional do centro, de um exame ou de uma consulta fora?{' '}
        <a href={linkSugestoes} target="_blank" rel="noopener" className="font-bold text-[#0A63C9] underline">
          Faça uma sugestão à direção
        </a>{' '}
        <span className="text-slate-500">(abre em outra aba, sem perder o que você escreveu aqui)</span>
      </div>

      <fieldset>
        <legend className={classeRotulo}>
          Retorno <span className="font-normal normal-case">(opcional: marca a próxima consulta sozinho)</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[150px] flex-1">
            <label htmlFor="consulta-retorno-data" className="mb-1 block text-[12px] text-slate-500">
              Data
            </label>
            <input
              id="consulta-retorno-data"
              type="date"
              min={hojeISO}
              value={retornoData}
              onChange={(e) => setRetornoData(e.target.value)}
              className={classeCampo}
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label htmlFor="consulta-retorno-hora" className="mb-1 block text-[12px] text-slate-500">
              Hora {retornoData !== '' && '(obrigatória)'}
            </label>
            <input
              id="consulta-retorno-hora"
              type="time"
              value={retornoHora}
              onChange={(e) => setRetornoHora(e.target.value)}
              className={classeCampo}
            />
          </div>
        </div>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3">
        <button
          type="button"
          disabled={enviando}
          onClick={salvar}
          className="mx-auto flex min-h-[44px] w-full max-w-[560px] items-center justify-center rounded-lg bg-[#2EA84A] px-4 py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar registro'}
        </button>
      </div>
    </div>
  )
}
