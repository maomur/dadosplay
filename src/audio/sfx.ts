// Efectos de sonido sintetizados con Web Audio (sin archivos).
// Estética moderna de interfaz: campanas de cristal (FM), acordes suaves con reverb,
// soplidos de aire filtrado y "clics" táctiles. Nada de ondas cuadradas ni de 8 bits.
// Todas las notas salen de una escala pentatónica de Re para que todo suene armónico.

let ctx: AudioContext | null = null
let dry: GainNode | null = null
let wet: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = false

export function setMuted(m: boolean) {
  muted = m
}

/** Respuesta de impulso sintética: una sala suave de ~2 s */
function makeImpulse(c: AudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    // Cadena: (seco + reverb) → filtro de brillo → compresor suave → salida
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 9000
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 3
    const out = ctx.createGain()
    out.gain.value = 0.9
    tone.connect(comp).connect(out).connect(ctx.destination)

    dry = ctx.createGain()
    dry.gain.value = 0.8
    dry.connect(tone)

    const verb = ctx.createConvolver()
    verb.buffer = makeImpulse(ctx)
    const verbOut = ctx.createGain()
    verbOut.gain.value = 0.32
    wet = ctx.createGain()
    wet.connect(verb).connect(verbOut).connect(tone)

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return ctx
}

// Los navegadores solo dejan sonar audio tras un gesto del usuario.
// iOS es estricto: hay que reanudar el contexto y reproducir algo (aunque sea silencio)
// dentro del propio gesto, y vuelve a "interrumpirlo" al pasar a segundo plano.
// iOS a veces deja el contexto "muerto" tras volver de segundo plano, una llamada
// o mucho tiempo inactivo: dice estar activo pero no suena. La solución fiable es
// tirarlo y crear uno nuevo en el siguiente toque.
let stale = false

function reset() {
  const old = ctx
  ctx = null
  dry = null
  wet = null
  stale = false
  if (old) void old.close().catch(() => {})
}

function unlock() {
  if (ctx && (stale || ctx.state === 'closed' || (ctx.state as string) === 'interrupted')) reset()
  const c = audio()
  if (!c) return
  // iOS 17+: que el audio del juego suene aunque el interruptor de silencio esté activado
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session && session.type !== 'playback') {
    try {
      session.type = 'playback'
    } catch {
      /* no disponible */
    }
  }
  if (c.state !== 'running') void c.resume()
  // Un instante de silencio "despierta" la salida de audio en iOS
  const b = c.createBuffer(1, 1, c.sampleRate)
  const src = c.createBufferSource()
  src.buffer = b
  src.connect(c.destination)
  src.start(0)
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
    window.addEventListener(ev, unlock, { capture: true, passive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stale = true
  })
  window.addEventListener('pagehide', () => { stale = true })
}

function ready(): AudioContext | null {
  if (muted) return null
  const c = audio()
  if (!c || !dry || !wet) return null
  if (c.state !== 'running') {
    // Suspendido o interrumpido (iOS): intentamos reanudar para el próximo sonido
    void c.resume()
    return null
  }
  return c
}

/** Envía un nodo a la mezcla seca y a la reverb en la proporción indicada */
function route(c: AudioContext, node: AudioNode, reverb: number) {
  const d = c.createGain()
  d.gain.value = 1
  const w = c.createGain()
  w.gain.value = reverb
  node.connect(d).connect(dry!)
  node.connect(w).connect(wet!)
}

function env(g: GainNode, start: number, attack: number, dur: number, vol: number) {
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
}

/** Voz sinusoidal suave (con deslizamiento opcional) */
function soft(c: AudioContext, o: { f: number; to?: number; t?: number; dur: number; vol?: number; attack?: number; reverb?: number; type?: OscillatorType }) {
  const start = c.currentTime + (o.t ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, start)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur * 0.9)
  env(g, start, o.attack ?? 0.008, o.dur, o.vol ?? 0.12)
  osc.connect(g)
  route(c, g, o.reverb ?? 0.35)
  osc.start(start)
  osc.stop(start + o.dur + 0.05)
}

/** Campana de cristal: síntesis FM con brillo que se apaga antes que el cuerpo */
function glass(c: AudioContext, o: { f: number; t?: number; dur?: number; vol?: number; reverb?: number; ratio?: number; index?: number }) {
  const start = c.currentTime + (o.t ?? 0)
  const dur = o.dur ?? 1.1
  const car = c.createOscillator()
  const mod = c.createOscillator()
  const modGain = c.createGain()
  const g = c.createGain()
  car.frequency.value = o.f
  mod.frequency.value = o.f * (o.ratio ?? 3.5)
  const idx = o.f * (o.index ?? 1.4)
  modGain.gain.setValueAtTime(idx, start)
  modGain.gain.exponentialRampToValueAtTime(idx * 0.02, start + dur * 0.5)
  mod.connect(modGain).connect(car.frequency)
  env(g, start, 0.004, dur, o.vol ?? 0.07)
  car.connect(g)
  route(c, g, o.reverb ?? 0.6)
  car.start(start)
  mod.start(start)
  car.stop(start + dur + 0.05)
  mod.stop(start + dur + 0.05)
}

/** Acorde de colchón: sinusoides ligeramente desafinadas con ataque lento */
function pad(c: AudioContext, freqs: number[], o: { t?: number; dur: number; vol?: number; attack?: number; reverb?: number }) {
  for (const f of freqs) {
    for (const det of [-6, 6]) {
      const start = c.currentTime + (o.t ?? 0)
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.detune.value = det
      env(g, start, o.attack ?? 0.12, o.dur, (o.vol ?? 0.05) / freqs.length)
      osc.connect(g)
      route(c, g, o.reverb ?? 0.8)
      osc.start(start)
      osc.stop(start + o.dur + 0.05)
    }
  }
}

/** Aire: ruido filtrado que barre (transiciones, soplidos) */
function air(c: AudioContext, o: { t?: number; dur: number; vol?: number; f: number; to?: number; q?: number; attack?: number; type?: BiquadFilterType; reverb?: number }) {
  const start = c.currentTime + (o.t ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const bq = c.createBiquadFilter()
  bq.type = o.type ?? 'bandpass'
  bq.Q.value = o.q ?? 0.9
  bq.frequency.setValueAtTime(o.f, start)
  if (o.to) bq.frequency.exponentialRampToValueAtTime(o.to, start + o.dur)
  const g = c.createGain()
  env(g, start, o.attack ?? o.dur * 0.4, o.dur, o.vol ?? 0.05)
  src.connect(bq).connect(g)
  route(c, g, o.reverb ?? 0.4)
  src.start(start, Math.random())
  src.stop(start + o.dur + 0.05)
}

/** Clic táctil (como el "tic" de un selector del móvil) */
function tick(c: AudioContext, o: { t?: number; f?: number; vol?: number }) {
  const start = c.currentTime + (o.t ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.frequency.value = o.f ?? 1900
  env(g, start, 0.001, 0.035, o.vol ?? 0.05)
  osc.connect(g)
  route(c, g, 0.1)
  osc.start(start)
  osc.stop(start + 0.05)
}

// Pentatónica de Re: D E F# A B
const PENTA = [62, 64, 66, 69, 71]
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)
const penta = (step: number, octave = 0) => hz(PENTA[((step % 5) + 5) % 5] + 12 * (octave + Math.floor(step / 5)))

let stepCount = 0

export const sfx = {
  /** Cada casilla: clic táctil muy suave que sube por la escala */
  step() {
    const c = ready(); if (!c) return
    stepCount++
    tick(c, { f: 1500 + (stepCount % 5) * 90, vol: 0.0225 })
    soft(c, { f: penta(stepCount % 5, 1), dur: 0.09, vol: 0.011, reverb: 0.15 })
  },

  /** Dados: barrido de aire con granos digitales y aterrizaje en dos golpes suaves */
  dice() {
    const c = ready(); if (!c) return
    air(c, { dur: 0.75, vol: 0.06, f: 600, to: 3200, q: 1.2 })
    for (let i = 0; i < 10; i++) tick(c, { t: i * 0.065 + Math.random() * 0.02, f: 1400 + Math.random() * 1600, vol: 0.03 })
    soft(c, { t: 0.8, f: 180, to: 110, dur: 0.18, vol: 0.16, reverb: 0.2 })
    soft(c, { t: 0.92, f: 200, to: 120, dur: 0.16, vol: 0.12, reverb: 0.2 })
    glass(c, { t: 0.95, f: penta(3, 2), dur: 0.7, vol: 0.035 })
  },

  /** La ficha se posa: "bloop" grave y una nota de cristal */
  land() {
    const c = ready(); if (!c) return
    soft(c, { f: 260, to: 150, dur: 0.22, vol: 0.14, reverb: 0.3 })
    glass(c, { t: 0.04, f: penta(0, 2), dur: 0.9, vol: 0.04 })
  },

  /** Se abre una ventana: soplido que sube y destello de cristal */
  whoosh() {
    const c = ready(); if (!c) return
    air(c, { dur: 0.42, vol: 0.05, f: 400, to: 4200, q: 0.7 })
    glass(c, { t: 0.18, f: penta(4, 2), dur: 1, vol: 0.03 })
  },

  /** Cobras: arpegio ascendente de cristal con destellos */
  coinIn() {
    const c = ready(); if (!c) return
    ;[0, 2, 3, 5].forEach((s, i) => glass(c, { t: i * 0.07, f: penta(s, 2), dur: 1.1, vol: 0.055 }))
    air(c, { t: 0.18, dur: 0.5, vol: 0.025, f: 7000, to: 11000, q: 2, attack: 0.05 })
  },

  /** Pagas: notas suaves que bajan, apagadas y en registro medio */
  coinOut() {
    const c = ready(); if (!c) return
    ;[4, 2, 0].forEach((s, i) => soft(c, { t: i * 0.09, f: penta(s, 1), dur: 0.35, vol: 0.07, attack: 0.01, reverb: 0.45, type: 'triangle' }))
    air(c, { dur: 0.35, vol: 0.03, f: 2400, to: 600, q: 0.8 })
  },

  /** Compra: confirmación brillante (sexta mayor) con colchón */
  buy() {
    const c = ready(); if (!c) return
    glass(c, { f: penta(0, 2), dur: 1.3, vol: 0.06 })
    glass(c, { t: 0.11, f: penta(4, 2), dur: 1.5, vol: 0.06 })
    pad(c, [penta(0, 1), penta(3, 1), penta(4, 1)], { t: 0.05, dur: 1.4, vol: 0.06 })
  },

  /** Carta: barrido de aire y acorde etéreo */
  card() {
    const c = ready(); if (!c) return
    air(c, { dur: 0.3, vol: 0.05, f: 1200, to: 6000, q: 0.6 })
    pad(c, [penta(0, 1), penta(2, 1), penta(4, 1), penta(1, 2)], { t: 0.12, dur: 1.4, vol: 0.07, attack: 0.08 })
    glass(c, { t: 0.2, f: penta(3, 2), dur: 1.2, vol: 0.04 })
  },

  /** A la Ronda: caída grave, dos tonos menores y golpe sordo */
  jail() {
    const c = ready(); if (!c) return
    soft(c, { f: 520, to: 180, dur: 0.6, vol: 0.1, attack: 0.03, reverb: 0.5 })
    pad(c, [hz(57), hz(60), hz(64)], { t: 0.1, dur: 1.3, vol: 0.08, attack: 0.15 })
    soft(c, { t: 0.55, f: 90, to: 50, dur: 0.35, vol: 0.22, reverb: 0.3 })
    air(c, { t: 0.55, dur: 0.4, vol: 0.04, f: 300, to: 120, type: 'lowpass' })
  },

  /** Construir: burbujas que suben (hotel: tres y destello) */
  build(hotel = false) {
    const c = ready(); if (!c) return
    const n = hotel ? 3 : 2
    for (let i = 0; i < n; i++) soft(c, { t: i * 0.1, f: 300 + i * 120, to: 900 + i * 200, dur: 0.12, vol: 0.09, reverb: 0.3 })
    if (hotel) {
      glass(c, { t: 0.32, f: penta(0, 3), dur: 1.3, vol: 0.05 })
      glass(c, { t: 0.4, f: penta(4, 2), dur: 1.3, vol: 0.04 })
    }
  },

  /** Hipotecar: "candado" apagado; deshipotecar: se abre hacia arriba */
  mortgage(on: boolean) {
    const c = ready(); if (!c) return
    if (on) {
      tick(c, { f: 900, vol: 0.06 })
      soft(c, { t: 0.02, f: 220, to: 130, dur: 0.25, vol: 0.12, reverb: 0.3 })
    } else {
      soft(c, { f: 260, to: 520, dur: 0.22, vol: 0.09, reverb: 0.4 })
      glass(c, { t: 0.1, f: penta(2, 2), dur: 0.8, vol: 0.035 })
    }
  },

  /** Puja: clic con nota corta */
  bid() {
    const c = ready(); if (!c) return
    tick(c, { f: 2200, vol: 0.05 })
    glass(c, { f: penta(1, 2), dur: 0.5, vol: 0.04 })
  },

  /** Fin de subasta: golpe suave; si se vende, campanas */
  gavel(sold: boolean) {
    const c = ready(); if (!c) return
    soft(c, { f: 200, to: 110, dur: 0.25, vol: 0.16, reverb: 0.35 })
    if (sold) {
      glass(c, { t: 0.08, f: penta(0, 2), dur: 1.1, vol: 0.05 })
      glass(c, { t: 0.18, f: penta(3, 2), dur: 1.2, vol: 0.05 })
    }
  },

  /** Trato cerrado: acorde que se abre hacia arriba */
  deal() {
    const c = ready(); if (!c) return
    pad(c, [penta(0, 1), penta(2, 1), penta(3, 1), penta(1, 2)], { dur: 1.6, vol: 0.08, attack: 0.1 })
    ;[0, 2, 4, 5].forEach((s, i) => glass(c, { t: 0.1 + i * 0.08, f: penta(s, 2), dur: 1.2, vol: 0.04 }))
  },

  /** Trato rechazado: dos tonos suaves que bajan */
  noDeal() {
    const c = ready(); if (!c) return
    soft(c, { f: penta(3, 1), dur: 0.3, vol: 0.08, reverb: 0.4 })
    soft(c, { t: 0.14, f: penta(1, 1), to: penta(0, 1), dur: 0.45, vol: 0.08, reverb: 0.4 })
  },

  /** Grupo completo: cascada de cristal sobre un acorde amplio */
  fanfare() {
    const c = ready(); if (!c) return
    pad(c, [penta(0, 0), penta(3, 0), penta(0, 1), penta(2, 1)], { dur: 2, vol: 0.1, attack: 0.15 })
    ;[0, 1, 2, 3, 4, 5, 7].forEach((s, i) => glass(c, { t: i * 0.06, f: penta(s, 2), dur: 1.4, vol: 0.045 }))
    air(c, { t: 0.3, dur: 1, vol: 0.025, f: 6000, to: 12000, q: 1.5 })
  },

  /** Bancarrota: caída lenta en menor que se apaga */
  bankrupt() {
    const c = ready(); if (!c) return
    pad(c, [hz(50), hz(57), hz(60), hz(65)], { dur: 2.6, vol: 0.12, attack: 0.2 })
    soft(c, { f: 440, to: 110, dur: 1.8, vol: 0.06, attack: 0.1, reverb: 0.7 })
    air(c, { dur: 2, vol: 0.03, f: 2000, to: 200, q: 0.7, attack: 0.3 })
  },

  /** Victoria: progresión de acordes con destellos */
  victory() {
    const c = ready(); if (!c) return
    pad(c, [penta(0, 0), penta(3, 0), penta(2, 1)], { dur: 1.2, vol: 0.1, attack: 0.1 })
    pad(c, [penta(4, -1), penta(1, 0), penta(4, 0)], { t: 0.9, dur: 1.2, vol: 0.1, attack: 0.1 })
    pad(c, [penta(0, 0), penta(3, 0), penta(0, 1), penta(2, 1)], { t: 1.8, dur: 2.4, vol: 0.12, attack: 0.15 })
    ;[0, 2, 3, 5, 7, 8, 10].forEach((s, i) => glass(c, { t: 1.8 + i * 0.07, f: penta(s, 2), dur: 1.6, vol: 0.045 }))
  },

  /** Te toca (partidas online): dos notas de cristal */
  yourTurn() {
    const c = ready(); if (!c) return
    glass(c, { f: penta(2, 2), dur: 0.9, vol: 0.06 })
    glass(c, { t: 0.12, f: penta(5, 2), dur: 1.1, vol: 0.06 })
  },

  /** Botón no disponible: "bump" grave como una vibración */
  deny() {
    const c = ready(); if (!c) return
    soft(c, { f: 170, to: 120, dur: 0.12, vol: 0.12, reverb: 0.05 })
  },

  /** Guardar un dado: clic con nota que sube; soltarlo: nota que baja */
  hold(on: boolean) {
    const c = ready(); if (!c) return
    tick(c, { f: on ? 2100 : 1500, vol: 0.05 })
    glass(c, { f: penta(on ? 3 : 1, 2), dur: 0.45, vol: 0.035 })
  },

  /** Apuntar puntos: arpegio de cristal (como cobrar) */
  score() {
    sfx.coinIn()
  },

  /** Apuntar un 0: dos tonos que bajan */
  zero() {
    sfx.noDeal()
  },

  /** Bonus de arriba: acorde que se abre */
  bonus() {
    sfx.deal()
  },

  /** Prueba al activar el sonido */
  test() {
    sfx.coinIn()
  },
}
