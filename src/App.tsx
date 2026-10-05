import { useEffect } from 'react'
import { useGame } from './store/gameStore'
import { Confetti } from './ui/Confetti'
import { DiceTray } from './ui/DiceTray'
import { Header, HeaderButtons } from './ui/Header'
import { Banners, FiveKindPopup, GameOverModal, HelpModal, MenuModal } from './ui/Modals'
import { ScoreCard } from './ui/ScoreCard'
import { Setup } from './ui/Setup'
import { Splash } from './ui/Splash'
import { useLandscape } from './ui/useLandscape'
import { t } from './ui/useT'

function Toast() {
  const toast = useGame((s) => s.toast)
  if (!toast) return null
  return (
    <div key={toast.id} role="status" className="toast-in fixed inset-x-3 top-16 z-[70] mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center text-white shadow-xl">
      {toast.text}
    </div>
  )
}

function GameScreen() {
  const view = useGame((s) => s.view)!
  const modal = useGame((s) => s.modal)
  const five = useGame((s) => s.five)
  const busy = useGame((s) => s.busy)
  const land = useLandscape()
  useEffect(() => {
    document.documentElement.classList.add('in-game')
    return () => document.documentElement.classList.remove('in-game')
  }, [])
  return (
    <div className="game-screen flex h-dvh flex-col land:flex-row">
      <div className="land:hidden">
        <Header />
      </div>
      {/* Horizontal: dados a la izquierda, hoja a la derecha */}
      <aside className="hidden land:flex land:w-[42%] land:min-w-0 land:flex-col land:gap-2 land:py-2 land:pl-[max(0.5rem,calc(env(safe-area-inset-left)*0.5))] land:pr-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-mar max-[700px]:hidden">{t('app.name')}</span>
          <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-ink/10">{t('round', { n: Math.min(view.round, 13) })}</span>
          <span className="flex-1" />
          <HeaderButtons small />
        </div>
        <div className="flex-1">{land && <DiceTray />}</div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 land:py-2 land:pr-[max(0.5rem,calc(env(safe-area-inset-right)*0.5))] land:pl-0">
        <ScoreCard />
      </main>
      <footer className="border-t border-ink/10 bg-arena/97 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] land:hidden">
        <div className="mx-auto max-w-lg">{!land && <DiceTray />}</div>
      </footer>
      <Banners />
      {five && <FiveKindPopup />}
      {view.phase === 'gameOver' && !busy && !five && <GameOverModal />}
      {modal.type === 'menu' && <MenuModal />}
      {modal.type === 'help' && <HelpModal />}
    </div>
  )
}

export default function App() {
  const game = useGame((s) => s.game)
  const celebrate = useGame((s) => s.celebrate)
  return (
    <>
      {game ? <GameScreen /> : <Setup />}
      <Toast />
      {game && <Confetti trigger={celebrate} />}
      <Splash />
    </>
  )
}
