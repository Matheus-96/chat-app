import { describe, it, expect } from 'vitest'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { joinRoom } from '../JoinRoom.js'

const makeStorage = () =>
  new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000, rateLimitMax: 10, rateLimitWindowMs: 15_000 })

describe('joinRoom', () => {
  it('returns null for a non-existent room code', () => {
    const storage = makeStorage()
    const result = joinRoom(storage, 'socket-1', 'XXXXXX', 'participant-1', 'Alice')
    expect(result).toBeNull()
  })

  it('returns snapshot with room, participants and messages on success', () => {
    const storage = makeStorage()
    const room = storage.createRoom()

    const result = joinRoom(storage, 'socket-1', room.roomCode, 'participant-1', 'Alice')

    expect(result).not.toBeNull()
    expect(result!.room.id).toBe(room.id)
    expect(result!.participantId).toBe('participant-1')
    expect(result!.participants).toHaveLength(1)
    expect(result!.participants[0].name).toBe('Alice')
    expect(result!.messages).toEqual([])
  })

  it('renews TTL after join', () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const originalExpiry = room.expiresAt

    // small delay to ensure a different timestamp
    const before = Date.now()
    const result = joinRoom(storage, 'socket-1', room.roomCode, 'participant-1', 'Alice')
    const after = Date.now()

    const updatedExpiry = new Date(result!.room.expiresAt).getTime()
    expect(updatedExpiry).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 100)
    expect(updatedExpiry).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100)
    // expiresAt should be updated (same or later than the original)
    expect(new Date(result!.room.expiresAt) >= new Date(originalExpiry)).toBe(true)
  })

  it('two participants in the same room are both listed', () => {
    const storage = makeStorage()
    const room = storage.createRoom()

    joinRoom(storage, 'socket-1', room.roomCode, 'participant-1', 'Alice')
    const result = joinRoom(storage, 'socket-2', room.roomCode, 'participant-2', 'Bob')

    expect(result!.participants).toHaveLength(2)
    const names = result!.participants.map((p) => p.name)
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
  })

  it('snapshot includes messages already in the room', () => {
    const storage = makeStorage()
    const room = storage.createRoom()

    joinRoom(storage, 'socket-1', room.roomCode, 'participant-1', 'Alice')

    storage.addMessage({
      roomId: room.id,
      role: 'user',
      authorId: 'participant-1',
      authorName: 'Alice',
      content: 'Hello',
      visibility: 'public',
    })

    const result = joinRoom(storage, 'socket-2', room.roomCode, 'participant-2', 'Bob')
    expect(result!.messages).toHaveLength(1)
    expect(result!.messages[0].content).toBe('Hello')
  })
})
