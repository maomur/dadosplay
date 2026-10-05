import { describe, expect, it } from 'vitest'
import { decideBot } from '../src/engine/bot'
import { applyAction } from '../src/engine/reducer'
import { allowedCategories, CATEGORIES, emptyScores, rawScore, scoreFor, total, type Scores } from '../src/engine/scoring'
import { createGame, type GameState } from '../src/engine/state'
import { canHold, canRoll, canScore } from '../src/engine/validate'

const game = (n = 2, bots = false) =>
  createGame({ seed: 42, now: 0, players: Array.from({ length: n }, (_, i) => ({ name: `J${i}`, isBot: bots })) })

describe('puntuación', () => {
  it('casillas de arriba', () => {
    expect(rawScore('ones', [1, 1, 2, 3, 1])).toBe(3)
    expect(rawScore('sixes', [6, 6, 6, 2, 1])).toBe(18)
    expect(rawScore('fours', [1, 2, 3, 5, 6])).toBe(0)
  })
  it('trío, póker, full', () => {
    expect(rawScore('threeKind', [3, 3, 3, 2, 1])).toBe(12)
    expect(rawScore('threeKind', [3, 3, 2, 2, 1])).toBe(0)
    expect(rawScore('fourKind', [5, 5, 5, 5, 1])).toBe(21)
    expect(rawScore('fourKind', [5, 5, 5, 1, 1])).toBe(0)
    expect(rawScore('fullHouse', [2, 2, 3, 3, 3])).toBe(25)
    expect(rawScore('fullHouse', [3, 3, 3, 3, 3])).toBe(0)
  })
  it('escaleras', () => {
    expect(rawScore('smallStraight', [1, 2, 3, 4, 6])).toBe(30)
    expect(rawScore('smallStraight', [3, 4, 5, 6, 6])).toBe(30)
    expect(rawScore('smallStraight', [1, 2, 3, 5, 6])).toBe(0)
    expect(rawScore('largeStraight', [2, 3, 4, 5, 6])).toBe(40)
    expect(rawScore('largeStraight', [1, 2, 3, 4, 6])).toBe(0)
  })
  it('cinco iguales y suerte', () => {
    expect(rawScore('fiveKind', [4, 4, 4, 4, 4])).toBe(50)
    expect(rawScore('fiveKind', [4, 4, 4, 4, 1])).toBe(0)
    expect(rawScore('chance', [1, 2, 3, 4, 6])).toBe(16)
  })
  it('bonus de arriba con 63', () => {
    const s: Scores = { ...emptyScores(), ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }
    expect(total(s, 0)).toBe(63 + 35)
    expect(total({ ...s, sixes: 12 }, 0)).toBe(57)
  })
})

describe('comodín (cinco iguales repetido)', () => {
  const five = [3, 3, 3, 3, 3]
  it('obliga a la casilla de arriba de esa cara si está libre', () => {
    const s = { ...emptyScores(), fiveKind: 50 }
    expect(allowedCategories(s, five)).toEqual(['threes'])
  })
  it('si está ocupada, cualquier casilla de abajo con puntos completos', () => {
    const s = { ...emptyScores(), fiveKind: 50, threes: 9 }
    expect(allowedCategories(s, five)).not.toContain('ones')
    expect(scoreFor('largeStraight', five, s)).toBe(40)
    expect(scoreFor('fullHouse', five, s)).toBe(25)
  })
  it('sin casillas de abajo, una de arriba con 0', () => {
    const s: Scores = { ...emptyScores(), threes: 9 }
    for (const c of ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'fiveKind', 'chance'] as const) s[c] = 10
    const allowed = allowedCategories(s, five)
    expect(allowed).toContain('ones')
    expect(scoreFor('ones', five, s)).toBe(0)
  })
  it('da 100 extra si la casilla de cinco iguales tiene 50', () => {
    let g = game(1)
    g = { ...g, rollsLeft: 2, dice: [6, 6, 6, 6, 6] }
    g.players[0].scores.fiveKind = 50
    g = applyAction(g, { type: 'score', category: 'sixes' })
    expect(g.players[0].fiveKindBonus).toBe(100)
    expect(g.players[0].scores.sixes).toBe(30)
  })
  it('sin bonus si la casilla de cinco iguales tiene 0', () => {
    let g = game(1)
    g = { ...g, rollsLeft: 2, dice: [6, 6, 6, 6, 6] }
    g.players[0].scores.fiveKind = 0
    g = applyAction(g, { type: 'score', category: 'sixes' })
    expect(g.players[0].fiveKindBonus).toBe(0)
  })
})

describe('turnos', () => {
  it('hay que tirar antes de guardar o apuntar', () => {
    const g = game()
    expect(canHold(g, 0).ok).toBe(false)
    expect(canScore(g, 'chance').ok).toBe(false)
    expect(canRoll(g).ok).toBe(true)
  })
  it('máximo 3 tiradas; los dados guardados no cambian', () => {
    let g = applyAction(game(), { type: 'roll' })
    const kept = g.dice[0]
    g = applyAction(g, { type: 'toggleHold', index: 0 })
    g = applyAction(g, { type: 'roll' })
    expect(g.dice[0]).toBe(kept)
    g = applyAction(g, { type: 'roll' })
    expect(g.rollsLeft).toBe(0)
    expect(canRoll(g).ok).toBe(false)
    expect(applyAction(g, { type: 'roll' })).toBe(g)
  })
  it('apuntar pasa el turno y reinicia tiradas y dados guardados', () => {
    let g = applyAction(game(), { type: 'roll' })
    g = applyAction(g, { type: 'toggleHold', index: 2 })
    g = applyAction(g, { type: 'score', category: 'chance' })
    expect(g.current).toBe(1)
    expect(g.rollsLeft).toBe(3)
    expect(g.held.every((h) => !h)).toBe(true)
    expect(canScore(g, 'chance').ok).toBe(false)
  })
  it('no se puede apuntar dos veces la misma casilla', () => {
    let g = game(1)
    g = applyAction(g, { type: 'roll' })
    g = applyAction(g, { type: 'score', category: 'chance' })
    g = applyAction(g, { type: 'roll' })
    expect(canScore(g, 'chance')).toMatchObject({ ok: false, reason: 'why.taken' })
  })
  it('las tiradas son deterministas con la misma semilla', () => {
    const a = applyAction(game(), { type: 'roll' })
    const b = applyAction(game(), { type: 'roll' })
    expect(a.dice).toEqual(b.dice)
  })
})

function playOut(g: GameState): GameState {
  for (let i = 0; i < 2000 && g.phase !== 'gameOver'; i++) {
    const a = decideBot(g)
    if (!a) break
    const next = applyAction(g, a)
    if (next === g) throw new Error(`acción inválida: ${JSON.stringify(a)}`)
    g = next
  }
  return g
}

describe('bots', () => {
  it('juegan partidas completas de 13 rondas', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let g = createGame({ seed, now: 0, players: [{ name: 'A', isBot: true }, { name: 'B', isBot: true }, { name: 'C', isBot: true }] })
      g = playOut(g)
      expect(g.phase).toBe('gameOver')
      for (const p of g.players) expect(CATEGORIES.every((c) => p.scores[c] !== null)).toBe(true)
      expect(g.winnerIds.length).toBeGreaterThan(0)
    }
  })
  it('juegan razonablemente bien (media > 180)', () => {
    let sumTotals = 0
    const n = 20
    for (let seed = 100; seed < 100 + n; seed++) {
      const g = playOut(createGame({ seed, now: 0, players: [{ name: 'A', isBot: true }] }))
      sumTotals += total(g.players[0].scores, g.players[0].fiveKindBonus)
    }
    const avg = sumTotals / n
    expect(avg).toBeGreaterThan(180)
  })
})
