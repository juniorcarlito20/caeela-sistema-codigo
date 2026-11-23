'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import SignaturePad from 'signature_pad'

export type AssinaturaPadRef = {
  limpar: () => void
  vazia: () => boolean
  imagem: () => string | null
}

const ALTURA = 160

const AssinaturaPad = forwardRef<AssinaturaPadRef>(function AssinaturaPad(_, ref) {
  const molduraRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const moldura = molduraRef.current
    if (!canvas || !moldura) return

    const pad = new SignaturePad(canvas, {
      minWidth: 2.5,
      maxWidth: 2.5,
      penColor: 'rgb(22, 36, 59)',
    })
    padRef.current = pad

    function ajustar() {
      if (!canvas || !moldura || !padRef.current) return
      const largura = moldura.clientWidth
      const proporcao = window.devicePixelRatio || 1
      const dados = padRef.current.isEmpty() ? null : padRef.current.toData()
      canvas.style.width = `${largura}px`
      canvas.style.height = `${ALTURA}px`
      canvas.width = Math.round(largura * proporcao)
      canvas.height = Math.round(ALTURA * proporcao)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(proporcao, proporcao)
      padRef.current.clear()
      if (dados) padRef.current.fromData(dados)
    }

    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  useImperativeHandle(ref, () => ({
    limpar: () => padRef.current?.clear(),
    vazia: () => padRef.current?.isEmpty() ?? true,
    imagem: () =>
      padRef.current && !padRef.current.isEmpty()
        ? padRef.current.toDataURL('image/png')
        : null,
  }))

  return (
    <div ref={molduraRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-[#fbfcfe]"
        style={{ height: ALTURA }}
      />
    </div>
  )
})

export default AssinaturaPad
