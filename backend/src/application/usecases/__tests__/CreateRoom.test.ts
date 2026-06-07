import { describe, it, expect } from 'vitest'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { createRoom } from '../CreateRoom.js'

const storage = () => new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })

describe('createRoom', () => {
  it('returns a room with a 6-char code', () => {
    const room = createRoom(storage())
    expect(room.roomCode).toHaveLength(6)
  })

  it('code does not contain ambiguous characters (0, O, I, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const room = createRoom(storage())
      expect(room.roomCode).not.toMatch(/[0OI1]/)
    }
  })

  it('expiresAt is approximately 24h from now', () => {
    const before = Date.now()
    const room = createRoom(storage())
    const after = Date.now()

    const expiresMs = new Date(room.expiresAt).getTime()
    const expectedTtl = 24 * 60 * 60 * 1000

    expect(expiresMs).toBeGreaterThanOrEqual(before + expectedTtl - 1000)
    expect(expiresMs).toBeLessThanOrEqual(after + expectedTtl + 1000)
  })

  it('assigns a non-empty roomId', () => {
    const room = createRoom(storage())
    expect(room.id).toBeTruthy()
  })

  it('two rooms have different codes', () => {
    const s = storage()
    const a = createRoom(s)
    const b = createRoom(s)
    expect(a.roomCode).not.toBe(b.roomCode)
  })
})
