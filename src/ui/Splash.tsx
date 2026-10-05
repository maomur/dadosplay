// Pantalla de bienvenida: logo en el centro ~2 s y luego se desvanece.
// index.html muestra la misma pantalla en estático mientras carga el JavaScript,
// así que no hay salto: React la toma y la anima.
import { useEffect, useState } from 'react'
import { SPLASH_LOGO } from './splashLogo'
import { useT } from './useT'

const SHOW_MS = 2000
const FADE_MS = 450

export function Splash() {
  const t = useT()
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show')
  useEffect(() => {
    // Cuenta desde que empezó a cargar la página, no desde que montó React
    const wait = Math.max(600, SHOW_MS - performance.now())
    const a = setTimeout(() => setPhase('fade'), wait)
    const b = setTimeout(() => setPhase('gone'), wait + FADE_MS)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  if (phase === 'gone') return null
  return (
    <div className={`splash ${phase === 'fade' ? 'splash-out' : ''}`} role="img" aria-label="DadosPlay">
      <div className="splash-logo splash-pop" dangerouslySetInnerHTML={{ __html: SPLASH_LOGO }} />
      <div className="splash-title splash-rise">{t('app.name')}</div>
      <div className="splash-tag splash-rise splash-rise-2">{t('app.tagline')}</div>
    </div>
  )
}
