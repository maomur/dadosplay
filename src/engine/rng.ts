// Generador pseudoaleatorio determinista (mulberry32). El estado vive en GameState.rng
// para que las partidas sean reproducibles y los tests deterministas.

export function nextRandom(seed: number): [value: number, nextSeed: number] {
  let t = (seed + 0x6d2b79f5) >>> 0
  const nextSeed = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, nextSeed]
}

/** Barajado Fisher–Yates usando la semilla; devuelve la nueva semilla */
export function shuffle<T>(items: T[], seed: number): [T[], number] {
  const arr = [...items]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s)
    s = ns
    const j = Math.floor(r * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return [arr, s]
}

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0
}
