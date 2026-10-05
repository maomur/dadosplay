import { useEffect, useId, useRef, type ReactNode } from 'react'
import { sfx } from '../audio/sfx'
import type { Check } from '../engine/validate'
import { useGame } from '../store/gameStore'
import { t } from './useT'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'blue'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-terracota text-white shadow-[0_3px_0_#7E2F1F] active:translate-y-[2px] active:shadow-none',
  blue: 'bg-mar text-white shadow-[0_3px_0_#073B73] active:translate-y-[2px] active:shadow-none',
  secondary: 'bg-white text-mar-deep border-2 border-mar/40 active:bg-cel/20',
  danger: 'bg-white text-[#B3261E] border-2 border-[#B3261E]/50 active:bg-[#B3261E]/10',
  ghost: 'bg-transparent text-mar-deep underline-offset-2 hover:underline',
}

/** Botón que sabe por qué no se puede: se ve apagado y, al tocarlo, explica el motivo */
export function ActionButton({
  check,
  onClick,
  children,
  variant = 'secondary',
  big = false,
  className = '',
  ignoreBusy = false,
}: {
  check?: Check
  onClick: () => void
  children: ReactNode
  variant?: Variant
  big?: boolean
  className?: string
  ignoreBusy?: boolean
}) {
  const busy = useGame((s) => s.busy) && !ignoreBusy
  const showToast = useGame((s) => s.showToast)
  const blocked = check && !check.ok
  const reason = check && !check.ok ? t(check.reason, check.vars) : undefined
  const disabled = blocked || busy
  return (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      title={reason}
      onClick={() => {
        if (busy) return
        if (blocked) {
          sfx.deny()
          showToast(reason!)
        } else onClick()
      }}
      className={[
        'rounded-xl font-display font-semibold transition select-none',
        big ? 'min-h-14 px-5 text-xl' : 'min-h-11 px-3 text-base',
        disabled ? 'cursor-not-allowed bg-[#E6E1D8] text-[#6B6560] shadow-none border-0' : VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Hoja inferior en móvil / diálogo centrado en pantallas grandes */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  closable = true,
}: {
  title: ReactNode
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
  closable?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  // El foco se mueve solo al abrir/cerrar (si dependiera de onClose, cada render quitaría el foco)
  const closeRef = useRef(onClose)
  closeRef.current = closable ? onClose : undefined
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [])
  useEffect(() => {
    sfx.whoosh()
  }, [])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center land:items-center" role="presentation">
      <div className="backdrop-in absolute inset-0 bg-ink/50" onClick={() => closable && onClose?.()} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="sheet-in relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-arena shadow-2xl outline-none sm:rounded-2xl land:max-h-[94dvh] land:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 land:py-2">
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          {closable && onClose && (
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-2xl leading-none hover:bg-ink/10" aria-label={t('ui.close')}>
              ×
            </button>
          )}
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer && <div className="border-t border-ink/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] land:py-2">{footer}</div>}
      </div>
    </div>
  )
}
