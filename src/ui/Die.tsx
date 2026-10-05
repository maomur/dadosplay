// Dado 3D en CSS. Al tirarlo da varias vueltas en el aire y frena con la cara que ha salido.
import { useEffect, useMemo, useRef } from 'react'

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[27, 22], [73, 22], [27, 50], [73, 50], [27, 78], [73, 78]],
}

/** Posición de cada cara (caras opuestas suman 7) y giro que la deja mirando al frente */
const FACES: { value: number; place: string; show: [number, number] }[] = [
  { value: 1, place: 'rotateY(0deg)', show: [0, 0] },
  { value: 6, place: 'rotateY(180deg)', show: [0, 180] },
  { value: 2, place: 'rotateY(90deg)', show: [0, -90] },
  { value: 5, place: 'rotateY(-90deg)', show: [0, 90] },
  { value: 3, place: 'rotateX(90deg)', show: [-90, 0] },
  { value: 4, place: 'rotateX(-90deg)', show: [90, 0] },
]

function Face({ value, place }: { value: number; place: string }) {
  return (
    <>
      <div className="die-fill" style={{ transform: `${place} translateZ(calc(var(--die) / 2 - 2px))` }} />
      <div className="die-face" style={{ transform: `${place} translateZ(calc(var(--die) / 2))` }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          {PIPS[value].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9.5" fill={value === 1 ? '#B0442D' : '#1A1A2E'} />
          ))}
        </svg>
      </div>
    </>
  )
}

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export function Die3D({ value, seq, index }: { value: number; seq: number; index: number }) {
  const transform = useMemo(() => {
    const [sx, sy] = FACES.find((f) => f.value === value)!.show
    const r = (k: number) => rand(seq * 7 + index * 13 + k)
    const turnsX = seq * 3 + 2 + Math.floor(r(1) * 2)
    const turnsY = seq * 3 + 2 + Math.floor(r(2) * 3)
    const turnsZ = seq === 0 ? 0 : 1 + Math.floor(r(3) * 2)
    const tilt = seq === 0 ? 0 : (r(4) - 0.5) * 8
    return `rotateZ(${360 * turnsZ + tilt}deg) rotateX(${sx + 360 * turnsX - 7}deg) rotateY(${sy + 360 * turnsY}deg)`
  }, [value, seq, index])

  const hop = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (seq === 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const dur = 960 + index * 40
    const dir = index % 2 === 0 ? -1 : 1
    hop.current?.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${dir * 10}%, -85%)`, offset: 0.28 },
        { transform: `translate(${dir * -3}%, 0)`, offset: 0.58 },
        { transform: `translate(${dir * -2}%, -18%)`, offset: 0.72 },
        { transform: 'translate(0, 0)', offset: 0.86 },
        { transform: 'translate(0, -4%)', offset: 0.93 },
        { transform: 'translate(0, 0)' },
      ],
      { duration: dur, easing: 'cubic-bezier(.3,.6,.4,1)' },
    )
    shadow.current?.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(.4)', opacity: 0.3, offset: 0.28 },
        { transform: 'scale(1.05)', opacity: 1, offset: 0.58 },
        { transform: 'scale(.8)', opacity: 0.7, offset: 0.72 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: dur, easing: 'cubic-bezier(.3,.6,.4,1)' },
    )
  }, [seq, index])

  return (
    <div className="die-scene">
      <div ref={hop} className="die-hop">
        <div className="die-cube" style={{ transform }}>
          {FACES.map((f) => (
            <Face key={f.value} value={f.value} place={f.place} />
          ))}
        </div>
      </div>
      <div ref={shadow} className="die-shadow" />
    </div>
  )
}
