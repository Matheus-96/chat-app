import { describe, it, expect } from 'vitest'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { sendMessage } from '../SendMessage.js'

const makeStorage = () => new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })

describe('sendMessage', () => {
  it('returns RoomMessage with correct fields on success', () => {
    const storage = makeStorage()
    const room = storage.createRoom()

    const result = sendMessage({ storage, roomId: room.id, authorId: 'user-1', authorName: 'Alice', content: 'Hello world' })

    expect(result).not.toBeNull()
    expect(result?.id).toBeTruthy()
    expect(result?.createdAt).toBeTruthy()
    expect(result?.role).toBe('user')
    expect(result?.authorId).toBe('user-1')
    expect(result?.authorName).toBe('Alice')
    expect(result?.content).toBe('Hello world')
    expect(result?.roomId).toBe(room.id)
  })

  it('returns null for non-existent room', () => {
    const storage = makeStorage()

    const result = sendMessage({ storage, roomId: 'non-existent-id', authorId: 'user-1', authorName: 'Alice', content: 'Hi' })

    expect(result).toBeNull()
  })
})
