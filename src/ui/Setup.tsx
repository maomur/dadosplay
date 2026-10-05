import { useState } from 'react'
import { MAX_PLAYERS, PLAYER_COLORS, type PlayerSetup } from '../engine/state'
import { useGame } from '../store/gameStore'
import { SoundToggle } from './Header'
import { InstallApp } from './Modals'
import { ActionButton } from './primitives'
import { t } from './useT'
import { SPLASH_LOGO } from './splashLogo'

const DEFAULT_NAMES = ['Ana', 'Marc', 'Laia', 'Pol']

export function Setup() {
  const newGame = useGame((s) => s.newGame)
  const saved = useGame((s) => s.savedGame)
  const continueGame = useGame((s) => s.continueGame)
  const best = useGame((s) => s.best)
  const [count, setCount] = useState(2)
  const [players, setPlayers] = useState<PlayerSetup[]>(DEFAULT_NAMES.map((name, i) => ({ name, isBot: i > 0 })))
  const update = (i: number, patch: Partial<PlayerSetup>) => setPlayers((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)))
  const chosen = players.slice(0, count)

  return (
    <main className="mx-auto max-w-lg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0" dangerouslySetInnerHTML={{ __html: SPLASH_LOGO }} />
        <div>
          <h1 className="font-display text-4xl font-bold text-mar">{t('app.name')}</h1>
          <p className="text-terracota">{t('app.tagline')}</p>
        </div>
      </div>

      {saved && (
        <div className="mt-5 rounded-xl border-2 border-olivo/40 bg-white p-3">
          <p className="text-sm">{t('setup.saved', { names: saved.players.map((p) => p.name).join(', '), round: saved.round })}</p>
          <ActionButton big variant="primary" className="mt-2 w-full" onClick={continueGame}>{t('setup.continue')}</ActionButton>
        </div>
      )}

      <h2 className="mt-6 font-display text-xl font-semibold">{t('setup.players')}</h2>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t('setup.players')}>
        {Array.from({ length: MAX_PLAYERS }, (_, k) => k + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={count === n}
            onClick={() => setCount(n)}
            className={`min-h-12 flex-1 rounded-xl border-2 font-display text-xl font-bold ${count === n ? 'border-mar bg-mar text-white' : 'border-mar/30 bg-white'}`}
          >
            {n}
          </button>
        ))}
      </div>
      {count === 1 && <p className="mt-1 text-sm opacity-70">{t('setup.solo')}{best > 0 ? ` · ${t('setup.best', { n: best })}` : ''}</p>}

      <ul className="mt-4 space-y-3">
        {chosen.map((p, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
            <label className="sr-only" htmlFor={`name-${i}`}>{t('setup.name', { n: i + 1 })}</label>
            <input
              id={`name-${i}`}
              className="h-11 min-w-0 flex-1 rounded-lg border-2 border-ink/15 px-2"
              value={p.name}
              maxLength={12}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            {count > 1 && (
              <div className="flex overflow-hidden rounded-lg border-2 border-ink/15" role="radiogroup">
                {[false, true].map((bot) => (
                  <button
                    key={String(bot)}
                    type="button"
                    role="radio"
                    aria-checked={p.isBot === bot}
                    onClick={() => update(i, { isBot: bot })}
                    className={`min-h-10 px-2.5 text-sm font-semibold ${p.isBot === bot ? 'bg-ink text-white' : 'bg-white'}`}
                  >
                    {bot ? `🤖 ${t('setup.bot')}` : t('setup.human')}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-display text-xl font-semibold">{t('ui.sound')}</h2>
      <div className="mt-2"><SoundToggle /></div>
      <div className="mt-4 grid"><InstallApp /></div>

      <ActionButton
        big
        variant="primary"
        className="mt-6 w-full"
        check={count > 1 && chosen.every((p) => p.isBot) ? { ok: false, reason: 'setup.needHuman' } : undefined}
        onClick={() => newGame(count === 1 ? [{ ...chosen[0], isBot: false }] : chosen)}
      >
        {t('setup.start')}
      </ActionButton>
    </main>
  )
}
