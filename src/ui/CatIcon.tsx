// Mini icono de cada casilla: un dado pequeño o un símbolo sencillo
import type { Category } from '../engine/scoring'

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
}

function MiniDie({ n, x = 0, y = 0, s = 100, fill = '#fff' }: { n: number; x?: number; y?: number; s?: number; fill?: string }) {
  const k = s / 100
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={2 * k} y={2 * k} width={96 * k} height={96 * k} rx={20 * k} fill={fill} stroke="#1A1A2E" strokeOpacity=".35" strokeWidth={4 * k} />
      {PIPS[n].map(([px, py], i) => (
        <circle key={i} cx={px * k} cy={py * k} r={10 * k} fill={n === 1 ? '#B0442D' : '#1A1A2E'} />
      ))}
    </g>
  )
}

const FACE: Partial<Record<Category, number>> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 }

export function CatIcon({ cat }: { cat: Category }) {
  const face = FACE[cat]
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6 shrink-0" aria-hidden="true">
      {face ? (
        <MiniDie n={face} />
      ) : cat === 'threeKind' ? (
        <><MiniDie n={3} s={52} x={0} y={24} /><MiniDie n={3} s={52} x={24} y={24} /><MiniDie n={3} s={52} x={48} y={24} /></>
      ) : cat === 'fourKind' ? (
        <><MiniDie n={4} s={48} x={2} y={2} /><MiniDie n={4} s={48} x={50} y={2} /><MiniDie n={4} s={48} x={2} y={50} /><MiniDie n={4} s={48} x={50} y={50} /></>
      ) : cat === 'fullHouse' ? (
        <><path d="M50 8 L94 44 H80 V92 H20 V44 H6 Z" fill="#0B5CAD" /><rect x="42" y="62" width="16" height="30" fill="#FFC930" /></>
      ) : cat === 'smallStraight' ? (
        <g fill="#2E8B57"><rect x="6" y="64" width="18" height="28" rx="4" /><rect x="29" y="48" width="18" height="44" rx="4" /><rect x="52" y="32" width="18" height="60" rx="4" /><rect x="75" y="16" width="18" height="76" rx="4" /></g>
      ) : cat === 'largeStraight' ? (
        <g fill="#2E8B57"><rect x="4" y="70" width="14" height="22" rx="3" /><rect x="23" y="56" width="14" height="36" rx="3" /><rect x="42" y="42" width="14" height="50" rx="3" /><rect x="61" y="28" width="14" height="64" rx="3" /><rect x="80" y="12" width="14" height="80" rx="3" /></g>
      ) : cat === 'fiveKind' ? (
        <path d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z" fill="#FFC930" stroke="#B87A00" strokeWidth="4" strokeLinejoin="round" />
      ) : (
        <g><circle cx="50" cy="50" r="44" fill="#B0442D" /><text x="50" y="68" textAnchor="middle" fontSize="54" fontWeight="800" fill="#fff" fontFamily="Fredoka Variable, sans-serif">?</text></g>
      )}
    </svg>
  )
}
