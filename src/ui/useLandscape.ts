import { useEffect, useState } from 'react'

/** Móvil en horizontal (misma condición que la variante CSS `land:`) */
export const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px)'

export function useLandscape(): boolean {
  const [land, setLand] = useState(() => typeof window !== 'undefined' && window.matchMedia(LANDSCAPE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(LANDSCAPE_QUERY)
    const on = () => setLand(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return land
}
