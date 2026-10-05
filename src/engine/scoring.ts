// Puntuación de la hoja clásica de 13 casillas. Funciones puras.

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'fiveKind', 'chance'] as const
export const CATEGORIES = [...UPPER, ...LOWER] as const
export type Category = (typeof CATEGORIES)[number]
export type UpperCategory = (typeof UPPER)[number]

export const UPPER_BONUS_AT = 63
export const UPPER_BONUS = 35
export const FULL_HOUSE = 25
export const SMALL_STRAIGHT = 30
export const LARGE_STRAIGHT = 40
export const FIVE_KIND = 50
export const FIVE_KIND_BONUS = 100

export type Dice = [number, number, number, number, number]
export type Scores = Record<Category, number | null>

/** Cara que corresponde a cada casilla de arriba */
export const FACE: Record<UpperCategory, number> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 }

export const isUpper = (c: Category): c is UpperCategory => (UPPER as readonly string[]).includes(c)

export function counts(dice: readonly number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const d of dice) c[d]++
  return c
}

export const sum = (dice: readonly number[]) => dice.reduce((a, b) => a + b, 0)

export const isFiveKind = (dice: readonly number[]) => counts(dice).some((n) => n === 5)

function hasRun(dice: readonly number[], len: number): boolean {
  const c = counts(dice)
  let run = 0
  for (let f = 1; f <= 6; f++) {
    run = c[f] > 0 ? run + 1 : 0
    if (run >= len) return true
  }
  return false
}

/** Puntos que valen estos dados en una casilla, sin comodín */
export function rawScore(cat: Category, dice: readonly number[]): number {
  const c = counts(dice)
  if (isUpper(cat)) return c[FACE[cat]] * FACE[cat]
  switch (cat) {
    case 'threeKind': return c.some((n) => n >= 3) ? sum(dice) : 0
    case 'fourKind': return c.some((n) => n >= 4) ? sum(dice) : 0
    case 'fullHouse': return c.includes(3) && c.includes(2) ? FULL_HOUSE : 0
    case 'smallStraight': return hasRun(dice, 4) ? SMALL_STRAIGHT : 0
    case 'largeStraight': return hasRun(dice, 5) ? LARGE_STRAIGHT : 0
    case 'fiveKind': return isFiveKind(dice) ? FIVE_KIND : 0
    case 'chance': return sum(dice)
  }
}

/**
 * Regla del comodín (oficial): si sacas cinco iguales y la casilla de cinco iguales
 * ya está apuntada (con 50 o con 0), debes usar la casilla de arriba de esa cara si
 * está libre; si no, cualquier casilla de abajo vale sus puntos completos; si tampoco
 * queda ninguna, una de arriba con 0.
 */
export function isJoker(scores: Scores, dice: readonly number[]): boolean {
  return isFiveKind(dice) && scores.fiveKind !== null
}

export function allowedCategories(scores: Scores, dice: readonly number[]): Category[] {
  const open = CATEGORIES.filter((c) => scores[c] === null)
  if (!isJoker(scores, dice)) return open
  const upper = (['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const)[dice[0] - 1]
  if (scores[upper] === null) return [upper]
  const lower = open.filter((c) => !isUpper(c))
  return lower.length ? lower : open
}

/** Puntos que se apuntarían en esa casilla con estos dados (aplica el comodín) */
export function scoreFor(cat: Category, dice: readonly number[], scores: Scores): number {
  if (isJoker(scores, dice) && !isUpper(cat)) {
    if (cat === 'fullHouse') return FULL_HOUSE
    if (cat === 'smallStraight') return SMALL_STRAIGHT
    if (cat === 'largeStraight') return LARGE_STRAIGHT
  }
  return rawScore(cat, dice)
}

export const emptyScores = (): Scores =>
  Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Scores

export function upperSum(scores: Scores): number {
  return UPPER.reduce((a, c) => a + (scores[c] ?? 0), 0)
}

export function upperBonus(scores: Scores): number {
  return upperSum(scores) >= UPPER_BONUS_AT ? UPPER_BONUS : 0
}

export function lowerSum(scores: Scores): number {
  return LOWER.reduce((a, c) => a + (scores[c] ?? 0), 0)
}

export function total(scores: Scores, fiveKindBonus: number): number {
  return upperSum(scores) + upperBonus(scores) + lowerSum(scores) + fiveKindBonus
}

export const filled = (scores: Scores) => CATEGORIES.every((c) => scores[c] !== null)
