import { describe, expect, it } from 'vitest'
import { RoomLogic } from '../src/online/roomLogic'

const setup = () => {
  const r = new RoomLogic('ABCDE')
  r.handle('k1', { t: 'hello', key: 'k1', create: true })
  r.handle('k1', { t: 'join', name: 'Ana' })
  r.handle('k2', { t: 'hello', key: 'k2', create: false })
  r.handle('k2', { t: 'join', name: 'Marc' })
  return r
}

describe('salas online', () => {
  it('no se puede entrar en una sala que no existe', () => {
    const r = new RoomLogic('ZZZZZ')
    expect(r.handle('k', { t: 'hello', key: 'k', create: false }).error).toBe('roomNotFound')
  })
  it('el primero es anfitrión y solo él empieza', () => {
    const r = setup()
    expect(r.publicRoom().seats.map((s) => s.name)).toEqual(['Ana', 'Marc'])
    expect(r.handle('k2', { t: 'start' }).state).toBeUndefined()
    const fx = r.handle('k1', { t: 'start' })
    expect(fx.state?.game.players.length).toBe(2)
    expect(r.data.phase).toBe('playing')
  })
  it('solo juega quien tiene el turno', () => {
    const r = setup()
    r.handle('k1', { t: 'start' })
    expect(r.handle('k2', { t: 'action', action: { type: 'roll' } }).error).toBe('notYourTurn')
    expect(r.handle('k1', { t: 'action', action: { type: 'roll' } }).state).toBeDefined()
  })
  it('rechaza acciones inventadas', () => {
    const r = setup()
    r.handle('k1', { t: 'start' })
    expect(r.handle('k1', { t: 'action', action: { type: 'cheat' } as never }).error).toBe('invalidAction')
  })
  it('un bot o un jugador ausente los juega el servidor hasta acabar', () => {
    const r = setup()
    r.handle('k1', { t: 'addBot' })
    r.handle('k1', { t: 'start' })
    r.setConnected('k1', false)
    r.setConnected('k2', false)
    for (let i = 0; i < 3000 && r.data.game!.phase !== 'gameOver'; i++) r.autoStep()
    expect(r.data.game!.phase).toBe('gameOver')
  })
  it('revancha vuelve a la sala con los mismos asientos', () => {
    const r = setup()
    r.handle('k1', { t: 'start' })
    r.data.game!.phase = 'gameOver'
    r.handle('k1', { t: 'rematch' })
    expect(r.data.phase).toBe('lobby')
    expect(r.publicRoom().seats.length).toBe(2)
  })
})
