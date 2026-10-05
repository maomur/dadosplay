// Conexión WebSocket con la sala (reconecta sola si se corta).
import { PartySocket } from 'partysocket'
import { PARTY_HOST } from './config'
import type { ClientMsg, ServerMsg } from './protocol'

export class OnlineConnection {
  private socket: PartySocket

  constructor(
    code: string,
    handlers: { onOpen: () => void; onClose: () => void; onMessage: (m: ServerMsg) => void },
  ) {
    this.socket = new PartySocket({ host: PARTY_HOST, party: 'game-room', room: code })
    // Se dispara también en cada reconexión: así el móvil vuelve a identificarse
    this.socket.addEventListener('open', handlers.onOpen)
    this.socket.addEventListener('close', handlers.onClose)
    this.socket.addEventListener('message', (e: MessageEvent) => {
      try {
        handlers.onMessage(JSON.parse(e.data as string) as ServerMsg)
      } catch {
        /* mensaje no válido */
      }
    })
  }

  send(msg: ClientMsg) {
    this.socket.send(JSON.stringify(msg))
  }

  close() {
    this.socket.close()
  }
}
