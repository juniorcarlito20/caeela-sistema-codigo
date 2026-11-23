// tests/sugestoesComponentes.test.tsx
// Testes de tela das sugestões: o que a direção e o profissional veem e como a tela se comporta
// quando a internet cai.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const { fetchMock, refreshMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), refreshMock: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

import AcoesSugestao from '@/components/AcoesSugestao'
import SugestoesAluno from '@/components/SugestoesAluno'

const OBSERVACAO = 'Observação para quem sugeriu (opcional)'

describe('AcoesSugestao (botões da direção)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('a observação escrita para resolver não fica na hora de descartar', () => {
    render(<AcoesSugestao sugestaoId="s1" />)
    fireEvent.click(screen.getByText('Marcar como resolvida'))
    const area = screen.getByLabelText(OBSERVACAO) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'Aluno encaminhado à fonoaudióloga' } })
    fireEvent.click(screen.getByText('Descartar'))
    expect((screen.getByLabelText(OBSERVACAO) as HTMLTextAreaElement).value).toBe('')
  })

  it('clicar de novo no mesmo botão não apaga a observação', () => {
    render(<AcoesSugestao sugestaoId="s1" />)
    fireEvent.click(screen.getByText('Marcar como resolvida'))
    fireEvent.change(screen.getByLabelText(OBSERVACAO), { target: { value: 'Falo com a fono.' } })
    fireEvent.click(screen.getByText('Marcar como resolvida'))
    expect((screen.getByLabelText(OBSERVACAO) as HTMLTextAreaElement).value).toBe('Falo com a fono.')
  })

  it('sem internet mostra o erro e o botão volta a ficar clicável', async () => {
    fetchMock.mockRejectedValue(new Error('sem rede'))
    render(<AcoesSugestao sugestaoId="s1" />)
    fireEvent.click(screen.getByText('Marcar como resolvida'))
    fireEvent.click(screen.getByText('Salvar como resolvida'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não foi possível salvar'))
    expect((screen.getByText('Salvar como resolvida') as HTMLButtonElement).disabled).toBe(false)
  })

  it('salvar com sucesso guarda a observação e avisa a direção', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    render(<AcoesSugestao sugestaoId="s1" />)
    fireEvent.click(screen.getByText('Marcar como resolvida'))
    fireEvent.change(screen.getByLabelText(OBSERVACAO), { target: { value: 'Falo com a fono.' } })
    fireEvent.click(screen.getByText('Salvar como resolvida'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ acao: 'resolver', observacao: 'Falo com a fono.' })
  })
})

describe('SugestoesAluno (formulário do profissional)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sem internet mostra o erro em vez de travar o botão', async () => {
    fetchMock.mockRejectedValue(new Error('sem rede'))
    render(
      <SugestoesAluno
        alunoId="al1"
        alunoNome="Aluno A"
        areas={[{ id: 'ar1', nome: 'Fonoaudiologia' }]}
        podeSugerir
        ehDirecao={false}
        sugestoes={[]}
      />,
    )
    fireEvent.click(screen.getByText('+ Nova sugestão'))
    fireEvent.change(screen.getByLabelText('Qual área?'), { target: { value: 'ar1' } })
    fireEvent.change(screen.getByLabelText('Explique em poucas linhas'), {
      target: { value: 'Sugiro avaliação com a fonoaudióloga.' },
    })
    fireEvent.click(screen.getByText('Enviar à direção'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não foi possível enviar'))
    expect((screen.getByText('Enviar à direção') as HTMLButtonElement).disabled).toBe(false)
  })

  it('sem a área do profissional do centro, não envia', () => {
    render(
      <SugestoesAluno
        alunoId="al1"
        alunoNome="Aluno A"
        areas={[{ id: 'ar1', nome: 'Fonoaudiologia' }]}
        podeSugerir
        ehDirecao={false}
        sugestoes={[]}
      />,
    )
    fireEvent.click(screen.getByText('+ Nova sugestão'))
    fireEvent.change(screen.getByLabelText('Explique em poucas linhas'), {
      target: { value: 'Sugiro avaliação com a fonoaudióloga.' },
    })
    fireEvent.click(screen.getByText('Enviar à direção'))
    expect(screen.getByRole('alert').textContent).toContain('Escolha a área do profissional sugerido.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
