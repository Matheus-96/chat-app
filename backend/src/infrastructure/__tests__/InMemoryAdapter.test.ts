import { describe, it, expect } from 'vitest'
import { InMemoryAdapter } from '../storage/InMemoryAdapter.js'

const makeStorage = () => new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })

function makeRoomWithMessage() {
  const storage = makeStorage()
  const room = storage.createRoom()
  const message = storage.addMessage({
    roomId: room.id,
    role: 'user',
    authorId: 'p1',
    authorName: 'Alice',
    content: 'hello',
  })!
  return { storage, room, message }
}

describe('InMemoryAdapter — addReaction', () => {
  it('adds participantId to the emoji list', () => {
    const { storage, room, message } = makeRoomWithMessage()

    const updated = storage.addReaction(room.id, message.id, 'p1', '👍')

    expect(updated).not.toBeNull()
    expect(updated!.reactions['👍']).toContain('p1')
  })

  it('is idempotent — does not duplicate participantId', () => {
    const { storage, room, message } = makeRoomWithMessage()

    storage.addReaction(room.id, message.id, 'p1', '👍')
    storage.addReaction(room.id, message.id, 'p1', '👍')

    const updated = storage.getRoomMessage(room.id, message.id)!
    expect(updated.reactions['👍']).toHaveLength(1)
  })

  it('tracks multiple participants on the same emoji', () => {
    const { storage, room, message } = makeRoomWithMessage()

    storage.addReaction(room.id, message.id, 'p1', '👍')
    storage.addReaction(room.id, message.id, 'p2', '👍')

    const updated = storage.getRoomMessage(room.id, message.id)!
    expect(updated.reactions['👍']).toEqual(expect.arrayContaining(['p1', 'p2']))
    expect(updated.reactions['👍']).toHaveLength(2)
  })

  it('returns null for non-existent message', () => {
    const { storage, room } = makeRoomWithMessage()

    const result = storage.addReaction(room.id, 'non-existent', 'p1', '👍')

    expect(result).toBeNull()
  })
})

describe('InMemoryAdapter — removeReaction', () => {
  it('removes participantId from the emoji list', () => {
    const { storage, room, message } = makeRoomWithMessage()
    storage.addReaction(room.id, message.id, 'p1', '👍')

    const updated = storage.removeReaction(room.id, message.id, 'p1', '👍')

    expect(updated).not.toBeNull()
    expect(updated!.reactions['👍']).toBeUndefined()
  })

  it('removes only the specified participant, keeping others', () => {
    const { storage, room, message } = makeRoomWithMessage()
    storage.addReaction(room.id, message.id, 'p1', '👍')
    storage.addReaction(room.id, message.id, 'p2', '👍')

    storage.removeReaction(room.id, message.id, 'p1', '👍')

    const updated = storage.getRoomMessage(room.id, message.id)!
    expect(updated.reactions['👍']).toEqual(['p2'])
  })

  it('is idempotent — removing absent reaction does not throw', () => {
    const { storage, room, message } = makeRoomWithMessage()

    const updated = storage.removeReaction(room.id, message.id, 'p1', '👍')

    expect(updated).not.toBeNull()
    expect(updated!.reactions['👍']).toBeUndefined()
  })

  it('returns null for non-existent message', () => {
    const { storage, room } = makeRoomWithMessage()

    const result = storage.removeReaction(room.id, 'non-existent', 'p1', '👍')

    expect(result).toBeNull()
  })
})

describe('InMemoryAdapter — reactions in room_snapshot', () => {
  it('messages in joinRoom result include reactions field', () => {
    const storage = makeStorage()
    const room = storage.createRoom()

    const msg = storage.addMessage({ roomId: room.id, role: 'user', authorId: 'p1', authorName: 'Alice', content: 'hi' })!
    storage.addReaction(room.id, msg.id, 'p2', '❤️')

    const joined = storage.joinRoom('socket-1', room.roomCode, 'p1', 'Alice')!

    const foundMsg = joined.messages.find((m) => m.id === msg.id)!
    expect(foundMsg.reactions['❤️']).toContain('p2')
  })
})
