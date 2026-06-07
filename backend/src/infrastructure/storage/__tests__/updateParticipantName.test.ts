import { describe, it, expect } from 'vitest'
import { InMemoryAdapter } from '../InMemoryAdapter.js'

const makeStorage = () =>
  new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000, rateLimitMax: 10, rateLimitWindowMs: 15_000 })

describe('updateParticipantName', () => {
  it('updates the name and returns updated participants list', () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    storage.joinRoom('socket-1', room.roomCode, 'p1', 'Alice')

    const result = storage.updateParticipantName(room.id, 'p1', 'Alice Renomeada')

    expect(result).not.toBeNull()
    expect(result!.find((p) => p.participantId === 'p1')?.name).toBe('Alice Renomeada')
  })

  it('returns null for unknown room', () => {
    const storage = makeStorage()
    const result = storage.updateParticipantName('nonexistent', 'p1', 'Nome')
    expect(result).toBeNull()
  })

  it('returns null for unknown participant', () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    storage.joinRoom('socket-1', room.roomCode, 'p1', 'Alice')

    const result = storage.updateParticipantName(room.id, 'unknown', 'Nome')
    expect(result).toBeNull()
  })

  it('does not affect other participants', () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    storage.joinRoom('socket-1', room.roomCode, 'p1', 'Alice')
    storage.joinRoom('socket-2', room.roomCode, 'p2', 'Bob')

    storage.updateParticipantName(room.id, 'p1', 'Alice Nova')

    const participants = storage.getParticipants(room.id)
    expect(participants.find((p) => p.participantId === 'p2')?.name).toBe('Bob')
  })
})
