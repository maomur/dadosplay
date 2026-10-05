import type { Action } from './reducer'
import { allowedCategories } from './scoring'
import { ROLLS_PER_TURN, type GameState } from './state'

export type Check = { ok: true } | { ok: false; reason: string; vars?: Record<string, string | number> }
const OK: Check = { ok: true }
const no = (reason: string, vars?: Record<string, string | number>): Check => ({ ok: false, reason, vars })

/** Ya tiró al menos una vez en este turno */
export const hasRolled = (s: GameState) => s.rollsLeft < ROLLS_PER_TURN

export function canRoll(s: GameState): Check {
  if (s.phase !== 'turn') return no('why.gameOver')
  if (s.rollsLeft <= 0) return no('why.noRolls')
  if (hasRolled(s) && s.held.every(Boolean)) return no('why.allHeld')
  return OK
}

export function canHold(s: GameState, index: number): Check {
  if (s.phase !== 'turn') return no('why.gameOver')
  if (index < 0 || index > 4) return no('why.invalid')
  if (!hasRolled(s)) return no('why.rollFirst')
  if (s.rollsLeft <= 0) return no('why.noRollsHold')
  return OK
}

export function canScore(s: GameState, category: string): Check {
  if (s.phase !== 'turn') return no('why.gameOver')
  if (!hasRolled(s)) return no('why.rollFirst')
  const p = s.players[s.current]
  const allowed = allowedCategories(p.scores, s.dice)
  if (!(allowed as string[]).includes(category)) {
    return p.scores[category as keyof typeof p.scores] !== null ? no('why.taken') : no('why.joker')
  }
  return OK
}

export function validate(s: GameState, a: Action): Check {
  switch (a.type) {
    case 'roll': return canRoll(s)
    case 'toggleHold': return canHold(s, a.index)
    case 'score': return canScore(s, a.category)
  }
}
