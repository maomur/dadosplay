import type { GameState } from '../engine/state'

const SAVE_KEY = 'dadosplay:save'
const PREFS_KEY = 'dadosplay:prefs'
const BEST_KEY = 'dadosplay:best'

export interface Prefs {
  muted: boolean
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function loadGame(): GameState | null {
  return safe(() => {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as GameState
    if (g.version !== 1 || g.phase === 'gameOver') return null
    return g
  }, null)
}

export function saveGame(g: GameState | null): void {
  safe(() => {
    if (!g || g.phase === 'gameOver') localStorage.removeItem(SAVE_KEY)
    else localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, events: [] }))
  }, undefined)
}

export function loadPrefs(): Prefs {
  return safe(() => {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>
    return { muted: !!p.muted }
  }, { muted: false })
}

export function savePrefs(p: Prefs): void {
  safe(() => localStorage.setItem(PREFS_KEY, JSON.stringify(p)), undefined)
}

/** Mejor puntuación de una persona en este móvil */
export function loadBest(): number {
  return safe(() => Number(localStorage.getItem(BEST_KEY)) || 0, 0)
}

export function saveBest(n: number): void {
  safe(() => localStorage.setItem(BEST_KEY, String(n)), undefined)
}
