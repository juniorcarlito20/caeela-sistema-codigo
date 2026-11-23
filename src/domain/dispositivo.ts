// Resume o user-agent em algo curto e legível para o rodapé do atendimento.
export function resumoDispositivo(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Celular Android'
  if (/Windows/i.test(ua)) return 'Computador Windows'
  if (/Macintosh/i.test(ua)) return 'Computador Mac'
  if (/Linux/i.test(ua)) return 'Computador Linux'
  if (/CrOS/i.test(ua)) return 'Chromebook'
  return 'Dispositivo não identificado'
}
