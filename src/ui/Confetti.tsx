// Lluvia de confeti (trencadís de colores) en canvas, sin librerías.
import { useEffect, useRef } from 'react'

const COLORS = ['#FFC930', '#0B5CAD', '#B0442D', '#2E8B57', '#4FC3E8', '#E0458B', '#FFFFFF']

export function Confetti({ trigger, pieces = 160 }: { trigger: number; pieces?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    // Solo celebraciones recién ocurridas: al volver a montar (revancha, reconexión) no se repite
    if (!trigger || Date.now() - trigger > 1500) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = innerWidth
    const H = innerHeight
    c.width = W * dpr
    c.height = H * dpr
    ctx.scale(dpr, dpr)
    // Dos cañones desde abajo a los lados, como en una fiesta mayor
    const parts = Array.from({ length: pieces }, (_, i) => {
      const left = i % 2 === 0
      const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7
      const speed = 9 + Math.random() * 9
      return {
        x: left ? innerWidth * 0.1 : innerWidth * 0.9,
        y: innerHeight * 0.95,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 7,
        h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() < 0.3 ? 'tri' : 'rect',
      }
    })
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, W, H)
      for (const p of parts) {
        p.vy += 0.28
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - t / 2600)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 'tri') {
          ctx.beginPath()
          ctx.moveTo(0, -p.h)
          ctx.lineTo(p.w / 2, p.h / 2)
          ctx.lineTo(-p.w / 2, p.h / 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1)
        }
        ctx.restore()
      }
      if (t < 2700) raf = requestAnimationFrame(frame)
      else wipe()
    }
    // Vaciar el lienzo entero (redimensionarlo borra todo, aunque la pantalla haya cambiado de alto)
    const wipe = () => {
      c.width = 0
      c.height = 0
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      wipe()
    }
  }, [trigger, pieces])
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[65] h-full w-full" aria-hidden="true" />
}
