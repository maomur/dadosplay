// Bot: decide qué dados guardar con simulaciones (Monte Carlo) y dónde apuntar
// comparando los puntos con lo que esa casilla suele valer de media.
import type { Action } from './reducer'
import { nextRandom } from './rng'
import { allowedCategories, FACE, isUpper, scoreFor, upperSum, UPPER_BONUS_AT, type Category, type Dice, type Scores } from './scoring'
import type { GameState } from './state'
import { hasRolled } from './validate'

/** Lo que suele valer cada casilla en una partida bien jugada (coste de gastarla) */
const AVG: Record<Category, number> = {
  ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2,
  threeKind: 21.7, fourKind: 13.1, fullHouse: 22.6, smallStraight: 29.5, largeStraight: 32.7, fiveKind: 16.9, chance: 22,
}

/** Utilidad de apuntar estos dados en esa casilla */
export function utility(cat: Category, dice: readonly number[], scores: Scores, round: number): number {
  const pts = scoreFor(cat, dice, scores)
  let u = pts - AVG[cat]
  if (isUpper(cat)) {
    const face = FACE[cat]
    // Ir por encima de 3 dados de esa cara acerca el bonus de 35
    const par = face * 3
    const before = upperSum(scores)
    u += (pts - par) * 0.7
    if (before < UPPER_BONUS_AT && before + pts >= UPPER_BONUS_AT) u += 20
  }
  if (cat === 'chance' && round < 10) u -= 5
  if (cat === 'fiveKind' && pts === 0 && round < 9) u -= 8
  return u
}

function bestCategory(dice: readonly number[], scores: Scores, round: number): { cat: Category; u: number } {
  let best: { cat: Category; u: number } | null = null
  for (const cat of allowedCategories(scores, dice)) {
    const u = utility(cat, dice, scores, round)
    if (!best || u > best.u) best = { cat, u }
  }
  return best!
}

const SAMPLES = 80

/** Mejor máscara de dados a guardar (true = guardar). Determinista: misma partida, misma decisión */
export function bestHold(s: GameState): boolean[] {
  const p = s.players[s.current]
  let seed = (s.rng ^ 0x9e3779b9) >>> 0
  const rand = () => {
    const [r, n] = nextRandom(seed)
    seed = n
    return r
  }
  let best = { mask: 31, ev: -Infinity }
  for (let mask = 0; mask < 32; mask++) {
    let total = 0
    if (mask === 31) {
      total = bestCategory(s.dice, p.scores, s.round).u * SAMPLES
    } else {
      for (let k = 0; k < SAMPLES; k++) {
        const d = [...s.dice] as Dice
        for (let i = 0; i < 5; i++) if (!(mask & (1 << i))) d[i] = 1 + Math.floor(rand() * 6)
        total += bestCategory(d, p.scores, s.round).u
      }
      // Con dos tiradas por delante, rehacer tiene algo más de valor
      if (s.rollsLeft >= 2) total += SAMPLES * 1.5
    }
    const ev = total / SAMPLES
    if (ev > best.ev + 0.01) best = { mask, ev }
  }
  return [0, 1, 2, 3, 4].map((i) => !!(best.mask & (1 << i)))
}

export function decideBot(s: GameState): Action | null {
  if (s.phase !== 'turn') return null
  const p = s.players[s.current]
  if (!hasRolled(s)) return { type: 'roll' }
  if (s.rollsLeft > 0) {
    const want = bestHold(s)
    if (!want.every(Boolean)) {
      const i = want.findIndex((w, k) => w !== s.held[k])
      if (i >= 0) return { type: 'toggleHold', index: i }
      return { type: 'roll' }
    }
  }
  return { type: 'score', category: bestCategory(s.dice, p.scores, s.round).cat }
}

/** Quién debe actuar ahora */
export const actorId = (s: GameState) => (s.phase === 'turn' ? s.players[s.current].id : null)
