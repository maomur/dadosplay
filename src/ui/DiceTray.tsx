// Bandeja de dados + botones del turno (abajo en vertical, a la izquierda en horizontal)
import { scoreFor } from '../engine/scoring'
import { canHold, canRoll, canScore, hasRolled } from '../engine/validate'
import { useGame } from '../store/gameStore'
import { Die3D } from './Die'
import { ActionButton } from './primitives'
import { t } from './useT'

function RollDots({ left }: { left: number }) {
  return (
    <span className="ml-2 inline-flex gap-1 align-middle" aria-label={t('action.rollsLeft', { n: left })}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < left ? 'bg-white' : 'bg-white/30'}`} />
      ))}
    </span>
  )
}

export function DiceTray() {
  const view = useGame((s) => s.view)!
  const game = useGame((s) => s.game)!
  const busy = useGame((s) => s.busy)
  const rollSeq = useGame((s) => s.rollSeq)
  const dispatch = useGame((s) => s.dispatch)
  const showToast = useGame((s) => s.showToast)
  const selected = useGame((s) => s.selected)
  const isMine = useGame((s) => s.isMine)
  const p = view.players[view.current]
  const human = isMine(p.id) && view.phase === 'turn'
  const rolled = hasRolled(view)

  const tapDie = (i: number) => {
    if (!human || busy) return
    const c = canHold(game, i)
    if (!c.ok) {
      showToast(t(c.reason))
      return
    }
    dispatch({ type: 'toggleHold', index: i })
  }

  return (
    <div className="flex flex-col gap-3 land:h-full land:justify-center">
      <div className="dice-tray rounded-2xl px-1 pb-4 pt-5 land:py-5">
        <div className="flex items-end justify-around">
          {view.dice.map((d, i) => {
            const held = view.held[i]
            return (
              <button
                key={i}
                type="button"
                onClick={() => tapDie(i)}
                aria-pressed={held}
                aria-label={`${t('dice.held')}: ${d}`}
                className={`die-btn relative flex flex-col items-center ${held ? 'is-held' : ''} ${!rolled ? 'opacity-45' : ''}`}
              >
                <Die3D value={d} seq={rollSeq[i]} index={i} />
                <span className={`die-tag absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[9px] font-bold uppercase tracking-wide ${held ? 'bg-sol text-ink' : 'hidden'}`}>
                  {t('dice.held')}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-7 text-center text-xs text-white/75">
          {human && rolled && view.rollsLeft > 0 ? t('action.holdHint') : ' '}
        </p>
      </div>

      {!human ? (
        <div className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white/80 px-3 text-center font-semibold">
          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
          {view.phase !== 'turn' ? t('over.title') : p.isBot ? t('turn.thinking', { name: p.name }) : t('turn.playing', { name: p.name })}
        </div>
      ) : selected ? (
        <div className="flex gap-2">
          <ActionButton big variant="primary" className="flex-1 land:min-h-12 land:px-2 land:text-base" check={canScore(game, selected)} onClick={() => dispatch({ type: 'score', category: selected })}>
            {t('action.score', { points: scoreFor(selected, view.dice, p.scores) + '', cat: t(`cat.${selected}`) })}
          </ActionButton>
          {view.rollsLeft > 0 && (
            <ActionButton big variant="blue" className="px-4" check={canRoll(game)} onClick={() => dispatch({ type: 'roll' })} >
              🎲
            </ActionButton>
          )}
        </div>
      ) : view.rollsLeft > 0 ? (
        <ActionButton big variant="blue" className="w-full whitespace-nowrap land:min-h-12 land:text-lg" check={canRoll(game)} onClick={() => dispatch({ type: 'roll' })}>
          🎲 {rolled ? t('action.rollAgain') : t('action.roll')} <RollDots left={view.rollsLeft} />
        </ActionButton>
      ) : (
        <div className="flex min-h-14 items-center justify-center rounded-xl border-2 border-dashed border-mar/40 bg-white/70 px-3 text-center font-display font-semibold text-mar-deep">
          ✍️ {t('action.pick')}
        </div>
      )}
    </div>
  )
}
