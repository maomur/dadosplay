// Sala de espera online: código para invitar, jugadores y botón de empezar (anfitrión).
import { useEffect, useRef, useState } from 'react'
import { PLAYER_COLORS } from '../engine/state'
import { useGame } from '../store/gameStore'
import { ActionButton } from './primitives'
import { t } from './useT'

function inviteLink(code: string) {
  return `${window.location.origin}/?sala=${code}`
}

export function Lobby() {
  const online = useGame((s) => s.online)!
  const send = useGame((s) => s.onlineSend)
  const leave = useGame((s) => s.onlineLeave)
  const showToast = useGame((s) => s.showToast)
  const room = online.room
  const me = room?.seats.find((s) => s.id === online.you) ?? null
  const isHost = !!me && room?.hostSeatId === me.id
  const [name, setName] = useState(me?.name ?? '')
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (me && !name) setName(me.name)
  }, [me, name])

  const updateName = (v: string) => {
    setName(v)
    if (typing.current) clearTimeout(typing.current)
    typing.current = setTimeout(() => me && send({ t: 'update', name: v }), 400)
  }

  const share = async () => {
    const url = inviteLink(online.code)
    const text = t('online.shareText', { code: online.code })
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DadosPlay', text, url })
        return
      }
    } catch {
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      showToast(t('online.copied'))
    } catch {
      showToast(url)
    }
  }

  if (online.error === 'roomNotFound' || online.error === 'gameStarted' || online.error === 'roomFull') {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
        <div className="w-full space-y-4 rounded-2xl bg-white p-5 text-center shadow">
          <p className="font-display text-2xl font-bold">{online.code}</p>
          <p>{t(`online.error.${online.error}`)}</p>
          <ActionButton big variant="primary" className="w-full" onClick={leave}>{t('online.back')}</ActionButton>
        </div>
      </main>
    )
  }

  const host = room?.seats.find((s) => s.id === room.hostSeatId)

  return (
    <main className="mx-auto max-w-lg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-mar">{t('online.lobby')}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${online.status === 'open' ? 'bg-olivo' : 'bg-terracota'}`}>
          {online.status === 'open' ? t('online.connected') : t('online.connecting')}
        </span>
      </div>

      <section className="dice-tray mt-4 rounded-2xl p-4 text-center text-white">
        <p className="text-sm opacity-85">{t('online.codeLabel')}</p>
        <p className="font-display text-5xl font-bold tracking-[0.18em]">{online.code}</p>
        <ActionButton big className="mt-3 w-full" onClick={share}>📨 {t('online.invite')}</ActionButton>
      </section>

      <h2 className="mt-6 font-display text-xl font-semibold">{t('online.players', { n: room?.seats.length ?? 0 })}</h2>
      <ul className="mt-2 space-y-2">
        {room?.seats.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ${s.id === me?.id ? 'ring-2 ring-ink' : ''}`}>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {s.name}
              {s.id === me?.id && <span className="ml-1 text-sm font-normal opacity-70">({t('online.you')})</span>}
              {s.id === room.hostSeatId && <span className="ml-1" title={t('online.host')}>👑</span>}
              {s.isBot && <span className="ml-1">🤖</span>}
            </span>
            {!s.isBot && <span className={`h-2.5 w-2.5 rounded-full ${s.connected ? 'bg-olivo' : 'bg-ink/25'}`} title={s.connected ? t('online.connected') : t('online.away')} />}
            {isHost && s.id !== me?.id && (
              <button type="button" onClick={() => send({ t: 'removeSeat', seatId: s.id })} className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-ink/10" aria-label={t('online.remove', { name: s.name })}>
                ×
              </button>
            )}
          </li>
        ))}
        {room && room.seats.length < 4 && isHost && (
          <li>
            <ActionButton className="w-full" onClick={() => send({ t: 'addBot' })}>🤖 {t('online.addBot')}</ActionButton>
          </li>
        )}
      </ul>

      {me && (
        <section className="mt-6 rounded-xl bg-white p-3 shadow-sm">
          <label htmlFor="my-name" className="text-sm font-semibold">{t('online.yourName')}</label>
          <input id="my-name" className="mt-1 h-11 w-full rounded-lg border-2 border-ink/15 px-2" value={name} maxLength={12} onChange={(e) => updateName(e.target.value)} />
        </section>
      )}

      {isHost ? (
        <ActionButton
          big
          variant="primary"
          className="mt-6 w-full"
          check={(room?.seats.length ?? 0) < 2 ? { ok: false, reason: 'online.error.needTwo' } : undefined}
          onClick={() => send({ t: 'start' })}
        >
          {t('online.start')}
        </ActionButton>
      ) : (
        <p className="mt-6 rounded-xl bg-white p-4 text-center">
          {room?.phase === 'playing' ? t('online.loading') : t('online.waitingHost', { name: host?.name ?? '' })}
        </p>
      )}

      <ActionButton variant="ghost" className="mt-4 w-full" onClick={leave}>{t('online.leave')}</ActionButton>
    </main>
  )
}
