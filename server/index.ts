// Servidor de salas online de DadosPlay (Cloudflare Worker + Durable Objects).
// Cada sala es un Durable Object: guarda la partida, ejecuta el mismo motor de reglas
// que la app, juega por los bots y envía los cambios a todos los móviles.
import { type Connection, routePartykitRequest, Server } from 'partyserver'
import type { ClientMsg, ServerMsg } from '../src/online/protocol'
import { AWAY_GRACE_MS, animationBudgetMs, RoomLogic, type RoomData } from '../src/online/roomLogic'

interface Env {
  GameRoom: DurableObjectNamespace<GameRoom>
}

type ConnState = { key?: string }

export class GameRoom extends Server<Env> {
  // Sin hibernación: así los temporizadores de los bots siguen vivos mientras hay gente conectada
  static options = { hibernate: false }

  logic!: RoomLogic
  timer: ReturnType<typeof setTimeout> | null = null

  async onStart() {
    const saved = await this.ctx.storage.get<RoomData>('room')
    this.logic = new RoomLogic(this.name, saved)
  }

  private send(conn: Connection, msg: ServerMsg) {
    conn.send(JSON.stringify(msg))
  }

  /** Cada móvil recibe la sala con su propio asiento marcado */
  private broadcastRoom() {
    const room = this.logic.publicRoom()
    for (const conn of this.getConnections()) {
      const key = (conn.state as ConnState | null)?.key
      const you = key ? this.logic.seatByKey(key)?.id ?? null : null
      this.send(conn, { t: 'room', room, you })
    }
  }

  private broadcastState(state: NonNullable<ReturnType<RoomLogic['handle']>['state']>) {
    this.broadcast(JSON.stringify({ t: 'state', game: state.game, events: state.events } satisfies ServerMsg))
  }

  private async persist() {
    await this.ctx.storage.put('room', this.logic.data)
  }

  /** Programa la siguiente jugada automática (bot o humano ausente) */
  private schedule(lastEvents: unknown[] = []) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const auto = this.logic.pendingAutoActor()
    if (!auto) return
    const wait =
      animationBudgetMs(lastEvents as Parameters<typeof animationBudgetMs>[0]) +
      (auto.reason === 'away' ? AWAY_GRACE_MS : 0)
    this.timer = setTimeout(() => void this.runAuto(), wait)
  }

  private async runAuto() {
    this.timer = null
    const fx = this.logic.autoStep()
    if (!fx.state) return
    this.broadcastState(fx.state)
    await this.persist()
    this.schedule(fx.state.events)
  }

  onConnect(conn: Connection) {
    // Al conectar enviamos la sala; la partida (si hay) se envía tras identificarse
    this.send(conn, { t: 'room', room: this.logic.publicRoom(), you: null })
  }

  async onMessage(conn: Connection, raw: string | ArrayBuffer) {
    let msg: ClientMsg
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMsg
    } catch {
      return
    }
    if (msg.t === 'hello') conn.setState({ key: msg.key } satisfies ConnState)
    const key = (conn.state as ConnState | null)?.key
    if (!key) return

    const fx = this.logic.handle(key, msg)
    if (fx.error) this.send(conn, { t: 'error', reason: fx.error })
    if (fx.room) this.broadcastRoom()
    if (msg.t === 'hello' && !fx.error) {
      // Quien llega (o vuelve) recibe la sala y la partida en curso
      this.broadcastRoom()
      if (this.logic.data.game) this.send(conn, { t: 'state', game: this.logic.data.game, events: [] })
    }
    if (fx.state) this.broadcastState(fx.state)
    if (fx.room || fx.state || msg.t === 'hello') {
      await this.persist()
      this.schedule(fx.state?.events ?? [])
    }
  }

  async onClose(conn: Connection) {
    const key = (conn.state as ConnState | null)?.key
    if (!key) return
    // Puede tener otra pestaña abierta con la misma clave
    const stillHere = [...this.getConnections()].some((c) => c !== conn && (c.state as ConnState | null)?.key === key)
    if (!stillHere && this.logic.setConnected(key, false)) {
      this.broadcastRoom()
      await this.persist()
      this.schedule()
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/') {
      return new Response('<!doctype html><meta charset="utf-8"><title>DadosPlay online</title><p>DadosPlay online: OK</p>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    return (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) ?? new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
