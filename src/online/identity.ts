// Identidad del móvil para las salas: una clave secreta guardada en el navegador.
// Con ella el servidor sabe qué asiento es tuyo aunque cierres y vuelvas a abrir la app.
const KEY = 'dadosplay:device-key'
const ROOM = 'dadosplay:online-room'

export function deviceKey(): string {
  try {
    let k = localStorage.getItem(KEY)
    if (!k) {
      k = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(KEY, k)
    }
    return k
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2)
  }
}

export function rememberRoom(code: string) {
  try {
    localStorage.setItem(ROOM, code)
  } catch {
    /* sin almacenamiento */
  }
}

export function forgetRoom() {
  try {
    localStorage.removeItem(ROOM)
  } catch {
    /* sin almacenamiento */
  }
}

export function lastRoom(): string | null {
  try {
    return localStorage.getItem(ROOM)
  } catch {
    return null
  }
}
