import { useGame } from '../store/gameStore'
import { t } from './useT'

/** Selector de sonido: con sonido (por defecto) o sin sonido */
export function SoundToggle() {
  const muted = useGame((s) => s.muted)
  const setSound = useGame((s) => s.setSound)
  return (
    <div className="flex w-fit overflow-hidden rounded-lg border-2 border-mar/30 text-sm font-bold" role="radiogroup" aria-label={t('ui.sound')}>
      {[true, false].map((on) => (
        <button
          key={String(on)}
          type="button"
          role="radio"
          aria-checked={muted !== on}
          onClick={() => setSound(on)}
          className={`min-h-9 px-3 ${muted !== on ? 'bg-mar text-white' : 'bg-white text-mar-deep'}`}
        >
          {on ? `🔊 ${t('ui.soundOn')}` : `🔇 ${t('ui.soundOff')}`}
        </button>
      ))}
    </div>
  )
}

export function HeaderButtons({ small = false }: { small?: boolean }) {
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  const setModal = useGame((s) => s.setModal)
  const btn = `grid ${small ? 'h-9 w-9' : 'h-10 w-10'} shrink-0 place-items-center rounded-lg bg-white font-bold text-mar-deep border-2 border-mar/30`
  return (
    <>
      <button type="button" className={btn} onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? t('ui.unmute') : t('ui.mute')}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button type="button" className={btn} onClick={() => setModal({ type: 'help' })} aria-label={t('ui.help')}>?</button>
      <button type="button" className={btn} onClick={() => setModal({ type: 'menu' })} aria-label={t('ui.menu')}>☰</button>
    </>
  )
}

export function Header() {
  const view = useGame((s) => s.view)!
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-arena/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      <span className="whitespace-nowrap font-display text-lg font-bold text-mar max-[359px]:hidden">{t('app.name')}</span>
      <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-ink/10">
        {t('round', { n: Math.min(view.round, 13) })}
      </span>
      <span className="flex-1" />
      <HeaderButtons />
    </header>
  )
}
