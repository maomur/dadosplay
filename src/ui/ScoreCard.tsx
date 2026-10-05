// Hoja de puntos: una fila por casilla y una columna por jugador.
// En tu turno, tras tirar, cada casilla libre te enseña cuánto valdría.
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio/sfx'
import { allowedCategories, LOWER, scoreFor, total, UPPER, UPPER_BONUS, UPPER_BONUS_AT, upperBonus, upperSum, type Category } from '../engine/scoring'
import type { Player } from '../engine/state'
import { canScore, hasRolled } from '../engine/validate'
import { useGame } from '../store/gameStore'
import { CatIcon } from './CatIcon'
import { t } from './useT'

function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (shown === value) return
    const from = shown
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 600)
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span className={`tabular-nums ${className}`}>{shown}</span>
}

export function ScoreCard() {
  const view = useGame((s) => s.view)!
  const game = useGame((s) => s.game)!
  const busy = useGame((s) => s.busy)
  const selected = useGame((s) => s.selected)
  const select = useGame((s) => s.select)
  const dispatch = useGame((s) => s.dispatch)
  const showToast = useGame((s) => s.showToast)
  const flash = useGame((s) => s.flash)
  const isMine = useGame((s) => s.isMine)
  // Fila tocada que no se puede usar: se pone en rojo un momento
  const [denied, setDenied] = useState<{ cat: Category; id: number } | null>(null)
  const deniedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cur = view.players[view.current]
  const myTurn = view.phase === 'turn' && isMine(cur.id) && hasRolled(view) && !busy
  const allowed = myTurn ? allowedCategories(cur.scores, view.dice) : []
  const many = view.players.length > 2

  const tapRow = (c: Category) => {
    if (!myTurn) {
      if (view.phase === 'turn' && isMine(cur.id) && !busy && !hasRolled(view)) showToast(t('why.rollFirst'))
      return
    }
    const check = canScore(game, c)
    if (!check.ok) {
      sfx.deny()
      showToast(t(check.reason))
      if (deniedTimer.current) clearTimeout(deniedTimer.current)
      setDenied({ cat: c, id: Date.now() })
      deniedTimer.current = setTimeout(() => setDenied(null), 900)
      try {
        navigator.vibrate?.([30, 40, 30])
      } catch {
        /* sin vibración */
      }
      return
    }
    if (selected === c) dispatch({ type: 'score', category: c })
    else {
      sfx.hold(true)
      select(c)
    }
  }

  const cell = (p: Player, c: Category, pi: number) => {
    const v = p.scores[c]
    const isCur = pi === view.current
    const flashing = flash && flash.playerId === p.id && flash.category === c
    if (v !== null) {
      return (
        <td key={p.id} className={`sc-cell ${isCur ? 'sc-cur' : ''}`}>
          <span key={flashing ? flash.id : 'v'} className={`relative inline-block font-bold ${v === 0 ? 'opacity-40' : ''} ${flashing ? 'cell-pop' : ''}`}>
            {v}
            {flashing && flash.points > 0 && <span className="float-up absolute -top-1 left-1/2 text-olivo">+{flash.points}</span>}
          </span>
        </td>
      )
    }
    if (isCur && allowed.includes(c) && selected === c) {
      const pts = scoreFor(c, view.dice, p.scores)
      const sel = true
      return (
        <td key={p.id} className={`sc-cell sc-cur ${sel ? 'sc-sel' : ''}`}>
          <span className={`preview ${pts === 0 ? 'is-zero' : ''} ${sel ? 'is-sel' : ''}`}>{pts}</span>
        </td>
      )
    }
    return <td key={p.id} className={`sc-cell ${isCur ? 'sc-cur' : ''}`} />
  }

  const row = (c: Category) => {
    const can = allowed.includes(c)
    return (
      <tr
        key={denied?.cat === c ? `${c}-${denied.id}` : c}
        onClick={() => tapRow(c)}
        className={`sc-row ${can ? 'is-open' : ''} ${myTurn ? 'is-tappable' : ''} ${selected === c ? 'is-selected' : ''} ${denied?.cat === c ? 'is-denied' : ''}`}
      >
        <th scope="row" className="sc-label">
          <span className="flex items-center gap-2">
            <CatIcon cat={c} />
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold leading-tight">{t(`cat.${c}`)}</span>
              {!many && <span className="block truncate text-[13px] leading-tight opacity-60">{t(`hint.${c}`)}</span>}
            </span>
          </span>
        </th>
        {view.players.map((p, i) => cell(p, c, i))}
      </tr>
    )
  }

  return (
    <div className="scorecard overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className={many ? 'w-[38%]' : 'w-[50%]'} />
          {view.players.map((p) => <col key={p.id} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="sc-head text-left text-xs font-semibold uppercase tracking-wide opacity-60">{t('card.upper')}</th>
            {view.players.map((p, i) => (
              <th key={p.id} className={`sc-head ${i === view.current && view.phase === 'turn' ? 'sc-cur-head' : ''}`}>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="w-full truncate text-xs font-bold">{p.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(row)}
          <tr className="sc-sum">
            <th scope="row" className="sc-label text-xs">{t('card.bonus')}</th>
            {view.players.map((p, i) => {
              const up = upperSum(p.scores)
              const got = upperBonus(p.scores) > 0
              return (
                <td key={p.id} className={`sc-cell ${i === view.current ? 'sc-cur' : ''}`}>
                  {got ? (
                    <span className="font-bold text-olivo">+{UPPER_BONUS}</span>
                  ) : (
                    <span className="flex flex-col items-center">
                      <span className="text-[11px] tabular-nums opacity-70">{up}/{UPPER_BONUS_AT}</span>
                      <span className="mt-0.5 h-1 w-8 overflow-hidden rounded bg-ink/10">
                        <span className="block h-full bg-sol" style={{ width: `${Math.min(100, (up / UPPER_BONUS_AT) * 100)}%` }} />
                      </span>
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
          <tr>
            <th colSpan={view.players.length + 1} className="sc-head text-left text-xs font-semibold uppercase tracking-wide opacity-60">{t('card.lower')}</th>
          </tr>
          {LOWER.map(row)}
          {view.players.some((p) => p.fiveKindBonus > 0) && (
            <tr className="sc-sum">
              <th scope="row" className="sc-label text-xs">{t('card.fiveBonus')}</th>
              {view.players.map((p, i) => (
                <td key={p.id} className={`sc-cell ${i === view.current ? 'sc-cur' : ''}`}>
                  {p.fiveKindBonus > 0 ? <span className="font-bold text-olivo">+{p.fiveKindBonus}</span> : ''}
                </td>
              ))}
            </tr>
          )}
          <tr className="sc-total">
            <th scope="row" className="sc-label font-display text-base">{t('card.total')}</th>
            {view.players.map((p, i) => (
              <td key={p.id} className={`sc-cell ${i === view.current ? 'sc-cur' : ''}`}>
                <AnimatedNumber value={total(p.scores, p.fiveKindBonus)} className="font-display text-lg font-bold" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
