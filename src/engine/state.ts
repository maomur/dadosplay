import { randomSeed } from './rng'
import { emptyScores, type Category, type Dice, type Scores } from './scoring'

export const MAX_PLAYERS = 4
export const ROLLS_PER_TURN = 3
export const ROUNDS = 13

export const PLAYER_COLORS = ['#D7263D', '#1E7FD8', '#1E9E5A', '#F2A100'] as const

export interface Player {
  id: string
  name: string
  isBot: boolean
  color: string
  scores: Scores
  /** Puntos extra por cada cinco iguales repetido (100 cada uno) */
  fiveKindBonus: number
}

export interface PlayerSetup {
  name: string
  isBot: boolean
}

export type Phase = 'turn' | 'gameOver'

export type GameEvent =
  | { type: 'turn'; playerId: string }
  | { type: 'roll'; playerId: string; dice: Dice; held: boolean[]; rollsLeft: number }
  | { type: 'hold'; playerId: string; index: number; held: boolean }
  | { type: 'score'; playerId: string; category: Category; points: number; bonus: number }
  | { type: 'fiveKind'; playerId: string; bonus: boolean }
  | { type: 'upperBonus'; playerId: string }
  | { type: 'gameOver'; winnerIds: string[] }

export interface GameState {
  version: 1
  seed: number
  rng: number
  players: Player[]
  current: number
  round: number
  phase: Phase
  dice: Dice
  held: boolean[]
  /** Tiradas que le quedan al jugador en turno (3 al empezar) */
  rollsLeft: number
  winnerIds: string[]
  /** Eventos de la última acción (la interfaz los anima uno a uno) */
  events: GameEvent[]
  startedAt: number
}

export function createGame(opts: { players: PlayerSetup[]; seed?: number; now?: number }): GameState {
  const seed = opts.seed ?? randomSeed()
  const players: Player[] = opts.players.map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name.trim() || `Jugador ${i + 1}`,
    isBot: p.isBot,
    color: PLAYER_COLORS[i],
    scores: emptyScores(),
    fiveKindBonus: 0,
  }))
  return {
    version: 1,
    seed,
    rng: seed,
    players,
    current: 0,
    round: 1,
    phase: 'turn',
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    winnerIds: [],
    events: [{ type: 'turn', playerId: players[0].id }],
    startedAt: opts.now ?? Date.now(),
  }
}
