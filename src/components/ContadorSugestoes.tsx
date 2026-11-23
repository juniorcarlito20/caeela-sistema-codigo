import { prisma } from '@/db/prisma'
import { filtroAlunoAtivo } from '@/lib/sugestoes'

// Número de sugestões esperando a direção, ao lado do item "Sugestões" do menu. Nunca quebra o cabeçalho.
export default async function ContadorSugestoes() {
  let n = 0
  try {
    n = await prisma.sugestao.count({ where: { situacao: 'PENDENTE', ...filtroAlunoAtivo } })
  } catch {
    return null
  }
  if (n === 0) return null
  return (
    <span className="ml-1.5 inline-block min-w-[18px] rounded-full bg-[#B3261E] px-1.5 text-center text-[11px] font-bold leading-[18px] text-white">
      {n}
    </span>
  )
}
