// Instalación como app (PWA): guarda el aviso del navegador para lanzarlo desde el menú.
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** 'prompt' = el navegador permite instalar con un botón; 'ios' = instrucciones manuales; null = ya instalada o no aplica */
export function useInstall(): ['prompt' | 'ios' | null, () => void] {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  // Solo donde hay manifiesto (la web propia), no en vistas previas
  if (isStandalone() || !document.querySelector('link[rel="manifest"]')) return [null, () => {}]
  if (deferred) {
    return [
      'prompt',
      () => {
        void deferred?.prompt()
        deferred = null
        force((n) => n + 1)
      },
    ]
  }
  return [isIOS() ? 'ios' : null, () => {}]
}
