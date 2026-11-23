import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/db/prisma'
import { primeiroNome } from '@/domain/lembrete'
import { isoDia } from '@/domain/diaSemAtendimento'
import { semAtendimentoNoDia } from '@/lib/diasSemAtendimento'

const HORAS_48 = 48 * 3600 * 1000

// Sem o título/descrição da raiz aqui: é esse texto que o WhatsApp mostra
// na prévia do link, em cima da mensagem — "CAEELA — Sistema de Gestão"
// repetido não ajuda a família, só ocupa espaço.
export const metadata: Metadata = {
  title: 'Confirmar presença',
  description: 'Confirme presença ou avise que não vai.',
}

export default async function PaginaConfirmar({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const lembrete = await prisma.lembrete.findUnique({
    where: { token },
    include: {
      atendimento: {
        include: { vinculo: { include: { aluno: true, profissional: true } } },
      },
    },
  })
  if (!lembrete) notFound()

  const expirado = lembrete.criadoEm.getTime() + HORAS_48 < Date.now()
  const aluno = primeiroNome(lembrete.atendimento.vinculo.aluno.nome)
  const dia = lembrete.atendimento.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const respondido = lembrete.confirmadoEm !== null
  const respostaFamilia = lembrete.resposta
  // O dia virou "sem atendimento" depois que o lembrete saiu: o link antigo não pode mais dizer
  // "tem atendimento".
  const semAtendimento = await semAtendimentoNoDia(isoDia(lembrete.atendimento.data))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center px-4 py-8 text-center text-[#16243b]">
      <Image
        src="/logo-caeela.png"
        alt="Logo do CAEELA"
        width={96}
        height={96}
        priority
        className="h-[96px] w-[96px] object-contain"
      />
      <p className="mt-1 text-xl font-black tracking-[4px] text-[#0070F0]">CAEELA</p>

      {semAtendimento ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-base font-bold">
          No dia {dia} não haverá atendimento ({semAtendimento}). O CAEELA avisa a data do próximo atendimento de {aluno}.
        </p>
      ) : expirado ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-base font-bold">
          Este link expirou. Fale com o CAEELA.
        </p>
      ) : respondido ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-base font-bold">
          {respostaFamilia === 'NAO_VAI'
            ? 'Aviso recebido. A equipe do CAEELA vai dar uma olhada. Obrigado por avisar!'
            : 'Combinado! Te esperamos no dia e horário certos.'}
        </p>
      ) : (
        <>
          <p className="mt-6 text-lg">
            <strong>{aluno}</strong> tem atendimento dia <strong>{dia}</strong>, às{' '}
            <strong>{lembrete.atendimento.hora}</strong>, com{' '}
            <strong>{lembrete.atendimento.vinculo.profissional.nome}</strong>.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <form action={`/api/confirmar/${token}`} method="post">
              <input type="hidden" name="resposta" value="sim" />
              <button
                type="submit"
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-xl bg-[#2EA84A] px-4 py-3 text-lg font-bold text-white"
              >
                Vou comparecer
              </button>
            </form>
            <form action={`/api/confirmar/${token}`} method="post">
              <input type="hidden" name="resposta" value="nao" />
              <button
                type="submit"
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-bold text-slate-600"
              >
                Avisar que não vou
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  )
}
