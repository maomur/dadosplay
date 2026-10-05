// Dirección del servidor de salas online (Cloudflare Worker).
// Se puede cambiar con la variable VITE_PARTY_HOST (en local: 127.0.0.1:8787).
const DEFAULT_PARTY_HOST = 'dadosplay-online.maomur.workers.dev'
export const PARTY_HOST: string = (import.meta.env.VITE_PARTY_HOST as string | undefined)?.trim() || DEFAULT_PARTY_HOST

/** El modo online solo existe en la web propia con servidor configurado */
export function onlineAvailable(): boolean {
  return !!PARTY_HOST && typeof document !== 'undefined' && !!document.querySelector('link[rel="manifest"]')
}

/** Código de sala de la URL (?sala=ABCDE), para unirse con un enlace */
export function roomFromUrl(): string | null {
  try {
    return new URL(window.location.href).searchParams.get('sala')
  } catch {
    return null
  }
}
