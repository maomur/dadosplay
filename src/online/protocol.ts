// Mensajes entre los móviles y el servidor de salas (compartido cliente/servidor).
import type { Action } from '../engine/reducer'
import type { GameEvent, GameState } from '../engine/state'

export interface Seat {
  id: string
  name: string
  isBot: boolean
  /** ¿Tiene el móvil conectado ahora mismo? (los bots siempre cuentan como conectados) */
  connected: boolean
  /** Jugador de la partida que controla este asiento (p1…p4), cuando ya ha empezado */
  playerId: string | null
}

export interface PublicRoom {
  code: string
  phase: 'lobby' | 'playing'
  seats: Seat[]
  hostSeatId: string | null
}

export type ClientMsg =
  /** Identificarse con la clave secreta del móvil (se guarda en localStorage) */
  | { t: 'hello'; key: string; create: boolean }
  | { t: 'join'; name: string }
  | { t: 'update'; name: string }
  | { t: 'addBot' }
  | { t: 'removeSeat'; seatId: string }
  | { t: 'start' }
  | { t: 'leave' }
  | { t: 'action'; action: Action }
  | { t: 'rematch' }

export type ServerMsg =
  | { t: 'room'; room: PublicRoom; you: string | null }
  | { t: 'state'; game: GameState; events: GameEvent[] }
  | { t: 'error'; reason: string }

export const MAX_SEATS = 4
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newRoomCode(): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]
  return s
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}
