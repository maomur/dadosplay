// Lógica de una sala online. Pura (sin red ni Cloudflare) para poder probarla con Vitest.
// El servidor la envuelve en un Durable Object y se encarga de enviar los mensajes.
import { actorId, decideBot } from '../engine/bot'
import { applyAction, type Action } from '../engine/reducer'
import { createGame, type GameEvent, type GameState } from '../engine/state'
import { MAX_SEATS, type ClientMsg, type PublicRoom, type Seat } from './protocol'

interface PrivateSeat extends Seat {
  /** Clave secreta del móvil dueño del asiento (null en bots) */
  key: string | null
}

export interface RoomData {
  /** La sala existe porque alguien la creó (unirse a un código inventado da error) */
  created: boolean
  phase: 'lobby' | 'playing'
  seats: PrivateSeat[]
  hostSeatId: string | null
  game: GameState | null
}

export interface Effects {
  room?: boolean
  state?: { game: GameState; events: GameEvent[] }
  error?: string
}

const BOT_NAMES = ['Bot Lucky', 'Bot Seis', 'Bot Dado', 'Bot Full']

let seatSeq = 0
const newSeatId = () => `s${Date.now().toString(36)}${(seatSeq++).toString(36)}`

export function emptyRoom(): RoomData {
  return { created: false, phase: 'lobby', seats: [], hostSeatId: null, game: null }
}

export class RoomLogic {
  code: string
  data: RoomData

  constructor(code: string, data?: RoomData) {
    this.code = code
    this.data = data ?? emptyRoom()
  }

  seatByKey(key: string): PrivateSeat | undefined {
    return this.data.seats.find((s) => s.key === key)
  }

  publicRoom(): PublicRoom {
    return {
      code: this.code,
      phase: this.data.phase,
      seats: this.data.seats.map(({ key: _key, ...s }) => s),
      hostSeatId: this.data.hostSeatId,
    }
  }

  isHost(key: string): boolean {
    const s = this.seatByKey(key)
    return !!s && s.id === this.data.hostSeatId
  }

  setConnected(key: string, connected: boolean): boolean {
    const s = this.seatByKey(key)
    if (!s || s.connected === connected) return false
    s.connected = connected
    return true
  }

  private nextHost() {
    const human = this.data.seats.find((s) => !s.isBot)
    this.data.hostSeatId = human?.id ?? null
  }

  handle(key: string, msg: ClientMsg, now = Date.now()): Effects {
    const d = this.data
    const seat = this.seatByKey(key)

    switch (msg.t) {
      case 'hello':
        if (msg.create && !d.created) d.created = true
        if (!d.created) return { error: 'roomNotFound' }
        if (seat) {
          seat.connected = true
          return { room: true }
        }
        return {}

      case 'join': {
        if (seat) return {}
        if (!d.created) return { error: 'roomNotFound' }
        if (d.phase !== 'lobby') return { error: 'gameStarted' }
        if (d.seats.length >= MAX_SEATS) return { error: 'roomFull' }
        const s: PrivateSeat = {
          id: newSeatId(),
          key,
          name: msg.name.trim().slice(0, 12) || `Jugador ${d.seats.length + 1}`,
          isBot: false,
          connected: true,
          playerId: null,
        }
        d.seats.push(s)
        if (!d.hostSeatId) d.hostSeatId = s.id
        return { room: true }
      }

      case 'update':
        if (!seat || d.phase !== 'lobby') return {}
        seat.name = msg.name.trim().slice(0, 12) || seat.name
        return { room: true }

      case 'addBot': {
        if (!this.isHost(key) || d.phase !== 'lobby') return {}
        if (d.seats.length >= MAX_SEATS) return { error: 'roomFull' }
        const bots = d.seats.filter((s) => s.isBot).length
        d.seats.push({ id: newSeatId(), key: null, name: BOT_NAMES[bots % BOT_NAMES.length], isBot: true, connected: true, playerId: null })
        return { room: true }
      }

      case 'removeSeat': {
        if (!this.isHost(key) || d.phase !== 'lobby') return {}
        const target = d.seats.find((s) => s.id === msg.seatId)
        if (!target || target.id === d.hostSeatId) return {}
        d.seats = d.seats.filter((s) => s !== target)
        return { room: true }
      }

      case 'leave': {
        if (!seat) return {}
        if (d.phase === 'lobby') {
          d.seats = d.seats.filter((s) => s !== seat)
          if (seat.id === d.hostSeatId) this.nextHost()
        } else {
          // En partida el asiento se queda: un bot juega por él mientras no vuelva
          seat.connected = false
        }
        return { room: true }
      }

      case 'start': {
        if (!this.isHost(key) || d.phase !== 'lobby') return {}
        if (d.seats.length < 2) return { error: 'needTwo' }
        d.seats.forEach((s, i) => (s.playerId = `p${i + 1}`))
        d.game = createGame({
          seed: (Math.random() * 2 ** 32) >>> 0,
          now,
          players: d.seats.map((s) => ({ name: s.name, isBot: s.isBot })),
        })
        d.phase = 'playing'
        return { room: true, state: { game: d.game, events: d.game.events } }
      }

      case 'rematch': {
        if (!this.isHost(key) || d.phase !== 'playing' || d.game?.phase !== 'gameOver') return {}
        d.phase = 'lobby'
        d.game = null
        d.seats.forEach((s) => (s.playerId = null))
        return { room: true }
      }

      case 'action': {
        if (!seat?.playerId || !d.game || d.phase !== 'playing') return { error: 'notInGame' }
        const action = this.sanitize(msg.action)
        if (!action) return { error: 'invalidAction' }
        if (!this.mayAct(seat.playerId)) return { error: 'notYourTurn' }
        const next = applyAction(d.game, action)
        if (next === d.game) return { error: 'invalidAction' }
        d.game = next
        return { state: { game: next, events: next.events } }
      }
    }
  }

  /** Solo se aceptan las 3 jugadas del juego, sin datos extra (nadie elige sus dados) */
  private sanitize(a: Action): Action | null {
    if (a.type === 'roll') return { type: 'roll' }
    if (a.type === 'toggleHold' && Number.isInteger(a.index)) return { type: 'toggleHold', index: a.index }
    if (a.type === 'score' && typeof a.category === 'string') return { type: 'score', category: a.category }
    return null
  }

  /** Solo juega quien tiene el turno */
  mayAct(playerId: string): boolean {
    return actorId(this.data.game!) === playerId
  }

  /** Jugador que debe actuar y si lo hace el servidor: bot, o humano desconectado */
  pendingAutoActor(): { playerId: string; reason: 'bot' | 'away' } | null {
    const g = this.data.game
    if (!g || this.data.phase !== 'playing' || g.phase === 'gameOver') return null
    const id = actorId(g)
    if (!id) return null
    const seat = this.data.seats.find((s) => s.playerId === id)
    if (!seat) return null
    if (seat.isBot) return { playerId: id, reason: 'bot' }
    if (!seat.connected) return { playerId: id, reason: 'away' }
    return null
  }

  autoStep(): Effects {
    const g = this.data.game
    if (!g || !this.pendingAutoActor()) return {}
    const a = decideBot(g)
    if (!a) return {}
    const next = applyAction(g, a)
    if (next === g) return {}
    this.data.game = next
    return { state: { game: next, events: next.events } }
  }
}

/**
 * Cuánto esperar antes de que el servidor juegue por un bot, para que los móviles
 * tengan tiempo de animar lo anterior. Mismos tiempos que la cola del cliente.
 */
export function animationBudgetMs(events: GameEvent[]): number {
  let ms = events.length > 0 && events.every((e) => e.type === 'hold') ? 200 : 700
  for (const e of events) {
    switch (e.type) {
      case 'turn': ms += 600; break
      case 'roll': ms += 1150; break
      case 'hold': ms += 250; break
      case 'fiveKind': ms += 2900; break
      case 'score': ms += 900; break
      case 'upperBonus': ms += 1500; break
    }
  }
  return Math.min(ms, 12000)
}

export const AWAY_GRACE_MS = 20000
