import { create } from 'zustand'
import { sfx, setMuted } from '../audio/sfx'
import { decideBot } from '../engine/bot'
import { applyAction, type Action } from '../engine/reducer'
import { total, type Category } from '../engine/scoring'
import { createGame, type GameEvent, type GameState, type PlayerSetup } from '../engine/state'
import { translate } from '../i18n'
import { loadBest, loadGame, loadPrefs, saveBest, saveGame, savePrefs } from './persistence'

// Ritmo: pausado, para que se vea cada cosa
const DICE_MS = 1150
const TURN_MS = 600
const SCORE_MS = 900
const BONUS_MS = 1500
const FIVE_MS = 2800
const BOT_ROLL_MS = 800
const BOT_HOLD_MS = 420
const BOT_SCORE_MS = 1000

export type Modal = { type: 'none' } | { type: 'menu' } | { type: 'help' }

interface Store {
  game: GameState | null
  /** Lo que se ve: avanza evento a evento hasta alcanzar a `game` */
  view: GameState | null
  queue: GameEvent[]
  busy: boolean
  /** Contador de tiradas por dado (gira solo el que se ha tirado) */
  rollSeq: number[]
  banner: { id: number; text: string; color: string } | null
  five: { playerId: string; bonus: boolean } | null
  bonusShow: { id: number; playerId: string } | null
  flash: { id: number; playerId: string; category: Category; points: number } | null
  celebrate: number
  toast: { id: number; text: string } | null
  selected: Category | null
  modal: Modal
  muted: boolean
  savedGame: GameState | null
  best: number
  newRecord: boolean
  lastSetup: PlayerSetup[] | null

  newGame: (players: PlayerSetup[]) => void
  continueGame: () => void
  quitGame: () => void
  rematch: () => void
  dispatch: (a: Action) => void
  select: (c: Category | null) => void
  dismissFive: () => void
  setModal: (m: Modal) => void
  toggleMute: () => void
  setSound: (on: boolean) => void
  showToast: (text: string) => void
  isHumanTurn: () => boolean
}

let stepTimer: ReturnType<typeof setTimeout> | null = null
let botTimer: ReturnType<typeof setTimeout> | null = null
let seq = 0

const prefs = loadPrefs()
setMuted(prefs.muted)

function applyToView(v: GameState, e: GameEvent): GameState {
  const s = structuredClone(v)
  const idx = (id: string) => s.players.findIndex((p) => p.id === id)
  switch (e.type) {
    case 'turn': {
      const i = idx(e.playerId)
      if (i === 0 && s.current !== 0) s.round++
      s.current = i
      s.held = [false, false, false, false, false]
      s.rollsLeft = 3
      break
    }
    case 'roll':
      s.dice = e.dice
      s.held = e.held
      s.rollsLeft = e.rollsLeft
      break
    case 'hold':
      s.held[e.index] = e.held
      break
    case 'score': {
      const p = s.players[idx(e.playerId)]
      p.scores[e.category] = e.points
      p.fiveKindBonus += e.bonus
      break
    }
    case 'gameOver':
      s.phase = 'gameOver'
      s.winnerIds = e.winnerIds
      break
  }
  return s
}

export const useGame = create<Store>((set, get) => {
  function pump() {
    if (stepTimer) return
    const { queue, game, view } = get()
    if (!game || !view) return
    if (get().five) return
    const e = queue[0]
    if (!e) {
      set({ busy: false, view: game })
      scheduleBot()
      return
    }
    const rest = queue.slice(1)
    const v = applyToView(view, e)
    set({ busy: true, queue: rest, view: v })
    const next = (ms: number) => {
      stepTimer = setTimeout(() => {
        stepTimer = null
        pump()
      }, ms)
    }
    const player = v.players.find((p) => 'playerId' in e && p.id === e.playerId)
    switch (e.type) {
      case 'turn': {
        const humans = v.players.filter((p) => !p.isBot).length
        if (player && !player.isBot) sfx.yourTurn()
        set({
          selected: null,
          banner: {
            id: ++seq,
            text: player!.isBot || humans < 2 ? translate('turn.of', { name: player!.name }) : translate('turn.yours', { name: player!.name }),
            color: player!.color,
          },
        })
        next(TURN_MS)
        return
      }
      case 'roll': {
        sfx.dice()
        const rs = get().rollSeq.map((n, i) => (e.held[i] ? n : n + 1))
        set({ rollSeq: rs, selected: null })
        next(DICE_MS)
        return
      }
      case 'hold':
        sfx.hold(e.held)
        next(player?.isBot ? 250 : 0)
        return
      case 'fiveKind':
        sfx.fanfare()
        set({ five: { playerId: e.playerId, bonus: e.bonus }, celebrate: Date.now() })
        stepTimer = setTimeout(() => {
          stepTimer = null
          get().dismissFive()
        }, FIVE_MS)
        return
      case 'score':
        if (e.points > 0 || e.bonus > 0) sfx.score()
        else sfx.zero()
        set({ flash: { id: ++seq, playerId: e.playerId, category: e.category, points: e.points + e.bonus }, selected: null })
        next(SCORE_MS)
        return
      case 'upperBonus':
        sfx.bonus()
        set({ bonusShow: { id: ++seq, playerId: e.playerId } })
        next(BONUS_MS)
        return
      case 'gameOver': {
        sfx.victory()
        const best = get().best
        const top = Math.max(0, ...v.players.filter((p) => !p.isBot).map((p) => total(p.scores, p.fiveKindBonus)))
        if (top > best) saveBest(top)
        set({ celebrate: Date.now(), best: Math.max(best, top), newRecord: top > best && best > 0 })
        next(400)
        return
      }
    }
  }

  function scheduleBot() {
    if (botTimer) clearTimeout(botTimer)
    botTimer = null
    const { game, busy, five } = get()
    if (!game || busy || five || game.phase !== 'turn') return
    if (!game.players[game.current].isBot) return
    const a = decideBot(game)
    if (!a) return
    const wait = a.type === 'roll' ? BOT_ROLL_MS : a.type === 'toggleHold' ? BOT_HOLD_MS : BOT_SCORE_MS
    botTimer = setTimeout(() => {
      botTimer = null
      if (get().busy || get().game !== game) return
      get().dispatch(a)
    }, wait)
  }

  function start(game: GameState) {
    if (stepTimer) clearTimeout(stepTimer)
    if (botTimer) clearTimeout(botTimer)
    stepTimer = botTimer = null
    // La vista empieza "antes" del primer evento
    const view = structuredClone(game)
    set({ game, view, queue: [...game.events], busy: false, five: null, selected: null, modal: { type: 'none' }, newRecord: false })
    saveGame(game)
    pump()
  }

  return {
    game: null,
    view: null,
    queue: [],
    busy: false,
    rollSeq: [0, 0, 0, 0, 0],
    banner: null,
    five: null,
    bonusShow: null,
    flash: null,
    celebrate: 0,
    toast: null,
    selected: null,
    modal: { type: 'none' },
    muted: prefs.muted,
    savedGame: loadGame(),
    best: loadBest(),
    newRecord: false,
    lastSetup: null,

    newGame: (players) => {
      set({ lastSetup: players })
      start(createGame({ players }))
    },
    continueGame: () => {
      const g = get().savedGame
      if (!g) return
      set({ lastSetup: g.players.map((p) => ({ name: p.name, isBot: p.isBot })) })
      start({ ...g, events: [] })
    },
    quitGame: () => {
      if (stepTimer) clearTimeout(stepTimer)
      if (botTimer) clearTimeout(botTimer)
      stepTimer = botTimer = null
      const g = get().game
      set({ game: null, view: null, queue: [], busy: false, five: null, modal: { type: 'none' }, savedGame: g && g.phase !== 'gameOver' ? g : null })
    },
    rematch: () => {
      const setup = get().lastSetup ?? get().game?.players.map((p) => ({ name: p.name, isBot: p.isBot }))
      if (setup) start(createGame({ players: setup }))
    },

    dispatch: (a) => {
      const { game, busy } = get()
      if (!game) return
      if (busy && a.type !== 'toggleHold') {
        get().showToast(translate('why.busy'))
        return
      }
      const next = applyAction(game, a)
      if (next === game) return
      set({ game: next, queue: [...get().queue, ...next.events] })
      saveGame(next)
      pump()
    },

    select: (c) => set({ selected: c }),

    dismissFive: () => {
      if (stepTimer) {
        clearTimeout(stepTimer)
        stepTimer = null
      }
      if (!get().five) return
      set({ five: null })
      pump()
    },

    setModal: (modal) => set({ modal }),
    toggleMute: () => get().setSound(get().muted),
    setSound: (on) => {
      setMuted(!on)
      set({ muted: !on })
      savePrefs({ muted: !on })
      if (on) setTimeout(() => sfx.test(), 50)
    },
    showToast: (text) => {
      const id = ++seq
      set({ toast: { id, text } })
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null })
      }, 2400)
    },
    isHumanTurn: () => {
      const g = get().game
      return !!g && g.phase === 'turn' && !g.players[g.current].isBot
    },
  }
})
