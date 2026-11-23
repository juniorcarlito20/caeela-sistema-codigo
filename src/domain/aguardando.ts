// src/domain/aguardando.ts
// Sobras da importação deixaram alguns alunos com DOIS atendimentos abertos com o mesmo
// profissional: um com horário e outro vazio. O vazio não é "aguardando horário" — o aluno
// já tem horário. Esta função tira esses vazios repetidos da tela (sem mexer nos dados).
//   chave: o que identifica "o mesmo par" na lista (o aluno, na agenda do profissional; o
//   profissional, na ficha do aluno).
export function semVazioRepetido<T extends { horarios: unknown[] }>(vinculos: T[], chave: (v: T) => string): T[] {
  const comHorario = new Set(vinculos.filter((v) => v.horarios.length > 0).map(chave))
  const vazioVisto = new Set<string>()
  return vinculos.filter((v) => {
    if (v.horarios.length > 0) return true
    const k = chave(v)
    if (comHorario.has(k) || vazioVisto.has(k)) return false
    vazioVisto.add(k)
    return true
  })
}
