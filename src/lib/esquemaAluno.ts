import { z } from 'zod'

const vazioViraNulo = (v: unknown) => {
  const texto = typeof v === 'string' ? v.trim() : ''
  return texto === '' ? null : texto
}

export const campoCpf = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || v.replace(/\D/g, '').length === 11, {
    message: 'Confira o CPF: ele precisa ter 11 números.',
  })
  .transform((v) => {
    const digitos = v.replace(/\D/g, '')
    return digitos === '' ? null : digitos
  })

export const campoNascimento = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || !Number.isNaN(new Date(`${v}T12:00:00`).getTime()), {
    message: 'Confira a data de nascimento.',
  })
  .transform((v) => (v === '' ? null : new Date(`${v}T12:00:00`)))

export const campoTextoOpcional = z.string().nullable().optional().transform(vazioViraNulo)

export const campoNome = z.string().trim().min(3, 'O nome precisa ter 3 letras ou mais.')
