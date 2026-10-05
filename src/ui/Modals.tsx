import { sfx } from '../audio/sfx'
import { total } from '../engine/scoring'
import { useGame } from '../store/gameStore'
import { Die3D } from './Die'
import { SoundToggle } from './Header'
import { useInstall } from './install'
import { ActionButton, Sheet } from './primitives'
import { t } from './useT'

const SOUND_PREVIEW: [string, () => void][] = [
  ['snd.dice', sfx.dice],
  ['snd.hold', () => sfx.hold(true)],
  ['snd.score', sfx.score],
  ['snd.zero', sfx.zero],
  ['snd.five', sfx.fanfare],
  ['snd.bonus', sfx.bonus],
  ['snd.turn', sfx.yourTurn],
  ['snd.victory', sfx.victory],
  ['snd.deny', sfx.deny],
]

export function InstallApp() {
  const [mode, install] = useInstall()
  if (!mode) return null
  if (mode === 'prompt') return <ActionButton variant="blue" onClick={install}>📲 {t('install.button')}</ActionButton>
  return <p className="rounded-xl bg-white px-3 py-2 text-sm">📲 {t('install.ios')}</p>
}

export function MenuModal() {
  const setModal = useGame((s) => s.setModal)
  const quit = useGame((s) => s.quitGame)
  const close = () => setModal({ type: 'none' })
  return (
    <Sheet title={t('ui.menu')} onClose={close}>
      <div className="grid gap-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t('ui.sound')}</span>
          <SoundToggle />
        </div>
        <InstallApp />
        <details className="rounded-xl bg-white px-3 py-2">
          <summary className="cursor-pointer py-1 font-semibold">{t('sound.preview')}</summary>
          <div className="grid grid-cols-2 gap-2 py-2">
            {SOUND_PREVIEW.map(([key, play]) => (
              <button key={key} type="button" onClick={play} className="min-h-10 rounded-lg bg-arena px-2 text-left text-sm font-semibold">▶ {t(key)}</button>
            ))}
          </div>
        </details>
        <ActionButton ignoreBusy onClick={() => setModal({ type: 'help' })}>{t('ui.help')}</ActionButton>
        <ActionButton ignoreBusy onClick={quit}>{t('menu.exit')}</ActionButton>
        <p className="text-sm opacity-70">{t('menu.saved')}</p>
      </div>
    </Sheet>
  )
}

export function HelpModal() {
  const setModal = useGame((s) => s.setModal)
  const rules = ['rules.goal', 'rules.turn', 'rules.score', 'rules.upper', 'rules.lower', 'rules.five']
  return (
    <Sheet title={t('ui.help')} onClose={() => setModal({ type: 'none' })}>
      <ul className="list-disc space-y-2 pb-2 pl-5">
        {rules.map((k) => <li key={k}>{t(k)}</li>)}
      </ul>
    </Sheet>
  )
}

export function GameOverModal() {
  const game = useGame((s) => s.game)!
  const quit = useGame((s) => s.quitGame)
  const rematch = useGame((s) => s.rematch)
  const newRecord = useGame((s) => s.newRecord)
  const ranking = [...game.players].sort((a, b) => total(b.scores, b.fiveKindBonus) - total(a.scores, a.fiveKindBonus))
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id))
  const solo = game.players.length === 1
  return (
    <Sheet
      title={t('over.title')}
      closable={false}
      footer={
        <div className="flex gap-2">
          <ActionButton big variant="primary" className="flex-1" ignoreBusy onClick={rematch}>{t('over.again')}</ActionButton>
          <ActionButton big className="flex-1" ignoreBusy onClick={quit}>{t('over.new')}</ActionButton>
        </div>
      }
    >
      <div className="py-2 text-center">
        <div className="trophy mx-auto grid h-20 w-20 place-items-center rounded-full text-5xl" style={{ background: winners[0].color }}>🏆</div>
        <p className="mt-2 font-display text-2xl font-bold">
          {solo ? t('over.points', { n: total(winners[0].scores, winners[0].fiveKindBonus) }) : winners.length > 1 ? t('over.tie') : t('over.winner', { name: winners[0].name })}
        </p>
        {newRecord && <p className="mt-1 font-display text-lg font-bold text-terracota">⭐ {t('over.record')}</p>}
      </div>
      {!solo && (
        <ol className="mt-2 space-y-1">
          {ranking.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
              <span className="w-5 font-bold">{i + 1}.</span>
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <span className="flex-1">{p.name}{p.isBot ? ' 🤖' : ''}</span>
              <span className="font-display text-lg font-bold tabular-nums">{total(p.scores, p.fiveKindBonus)}</span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}

/** Cinco iguales: pantalla completa con los dados saltando */
export function FiveKindPopup() {
  const five = useGame((s) => s.five)!
  const view = useGame((s) => s.view)!
  const dismiss = useGame((s) => s.dismissFive)
  const p = view.players.find((x) => x.id === five.playerId)!
  return (
    <div className="five-overlay fixed inset-0 z-[60] grid place-items-center p-5" role="alertdialog" aria-modal="true" aria-labelledby="five-title" onClick={dismiss}>
      <div className="text-center text-white">
        <div className="flex justify-center gap-2" style={{ ['--die' as string]: 'min(13vw, 64px)' }}>
          {view.dice.map((d, i) => (
            <div key={i} className="five-die" style={{ animationDelay: `${i * 70}ms` }}>
              <Die3D value={d} seq={0} index={i} />
            </div>
          ))}
        </div>
        <h2 id="five-title" className="five-title mt-6 font-display text-5xl font-extrabold land:mt-3 land:text-4xl">{t('five.title')}</h2>
        <p className="mt-2 text-xl font-semibold text-sol">{p.name} · {five.bonus ? t('five.bonus') : t('five.first')}</p>
        <button type="button" autoFocus onClick={dismiss} className="mt-6 min-h-12 rounded-xl bg-white px-8 font-display text-lg font-semibold text-ink land:mt-3">
          {t('ui.continue')}
        </button>
      </div>
    </div>
  )
}

/** Avisos que pasan por encima: turno y bonus */
export function Banners() {
  const banner = useGame((s) => s.banner)
  const bonusShow = useGame((s) => s.bonusShow)
  const view = useGame((s) => s.view)
  const bonusPlayer = bonusShow && view?.players.find((p) => p.id === bonusShow.playerId)
  return (
    <>
      {banner && (
        <div key={banner.id} className="turn-banner pointer-events-none fixed inset-x-0 top-[22%] z-50 flex justify-center">
          <span className="rounded-full px-5 py-2 font-display text-xl font-bold text-white shadow-xl" style={{ background: banner.color }}>
            {banner.text}
          </span>
        </div>
      )}
      {bonusShow && bonusPlayer && (
        <div key={bonusShow.id} className="bonus-banner pointer-events-none fixed inset-x-0 top-[38%] z-50 flex flex-col items-center">
          <span className="font-display text-5xl font-extrabold text-sol drop-shadow-[0_4px_10px_rgba(0,0,0,.35)]">{t('bonus.title')}</span>
          <span className="mt-1 rounded-full bg-ink/80 px-3 py-1 text-sm font-semibold text-white">{t('bonus.text', { name: bonusPlayer.name })}</span>
        </div>
      )}
    </>
  )
}
