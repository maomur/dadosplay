import { nextRandom } from './rng'
import { allowedCategories, FIVE_KIND_BONUS, filled, isFiveKind, scoreFor, total, upperBonus, type Category, type Dice } from './scoring'
import { ROLLS_PER_TURN, type GameEvent, type GameState } from './state'
import { validate } from './validate'

export type Action =
  | { type: 'roll' }
  | { type: 'toggleHold'; index: number }
  | { type: 'score'; category: Category }

const emit = (s: GameState, e: GameEvent) => s.events.push(e)

function roll(s: GameState) {
  const dice = [...s.dice] as Dice
  for (let i = 0; i < 5; i++) {
    if (s.held[i]) continue
    const [r, next] = nextRandom(s.rng)
    s.rng = next
    dice[i] = 1 + Math.floor(r * 6)
  }
  s.dice = dice
  s.rollsLeft--
  emit(s, { type: 'roll', playerId: s.players[s.current].id, dice, held: [...s.held], rollsLeft: s.rollsLeft })
  if (isFiveKind(dice)) {
    const p = s.players[s.current]
    emit(s, { type: 'fiveKind', playerId: p.id, bonus: p.scores.fiveKind === 50 })
  }
}

function score(s: GameState, category: Category) {
  const p = s.players[s.current]
  const points = scoreFor(category, s.dice, p.scores)
  // Cinco iguales repetido con la casilla en 50: +100
  const bonus = isFiveKind(s.dice) && p.scores.fiveKind === 50 ? FIVE_KIND_BONUS : 0
  p.fiveKindBonus += bonus
  const hadBonus = upperBonus(p.scores) > 0
  p.scores[category] = points
  emit(s, { type: 'score', playerId: p.id, category, points, bonus })
  if (!hadBonus && upperBonus(p.scores) > 0) emit(s, { type: 'upperBonus', playerId: p.id })
  nextTurn(s)
}

function nextTurn(s: GameState) {
  if (s.players.every((p) => filled(p.scores))) {
    const totals = s.players.map((p) => total(p.scores, p.fiveKindBonus))
    const best = Math.max(...totals)
    s.winnerIds = s.players.filter((_, i) => totals[i] === best).map((p) => p.id)
    s.phase = 'gameOver'
    emit(s, { type: 'gameOver', winnerIds: s.winnerIds })
    return
  }
  s.current = (s.current + 1) % s.players.length
  if (s.current === 0) s.round++
  s.held = [false, false, false, false, false]
  s.rollsLeft = ROLLS_PER_TURN
  emit(s, { type: 'turn', playerId: s.players[s.current].id })
}

/** Aplica una acción. Si no es válida devuelve el mismo estado sin tocar. */
export function applyAction(state: GameState, action: Action): GameState {
  if (!validate(state, action).ok) return state
  const s = structuredClone(state)
  s.events = []
  switch (action.type) {
    case 'roll':
      roll(s)
      break
    case 'toggleHold':
      s.held[action.index] = !s.held[action.index]
      emit(s, { type: 'hold', playerId: s.players[s.current].id, index: action.index, held: s.held[action.index] })
      break
    case 'score':
      score(s, action.category)
      break
  }
  return s
}

export { allowedCategories }
