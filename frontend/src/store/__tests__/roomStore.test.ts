import { beforeEach, describe, expect, it } from 'vitest'
import { useRoomStore, INITIAL_STATE } from '../roomStore'
import type { ParticipantPresence, RoomMessage } from '../../shared/ws/protocol'

const participant: ParticipantPresence = {
  participantId: 'p1',
  name: 'Alice',
  connectedAt: '2026-01-01T00:00:00Z',
  agentMode: 'automatic',
}

const message: RoomMessage = {
  id: 'msg1',
  roomId: 'room1',
  role: 'user',
  authorId: 'p1',
  authorName: 'Alice',
  content: 'Hello',
  createdAt: '2026-01-01T00:00:00Z',
  visibility: 'public',
}

beforeEach(() => {
  useRoomStore.setState(INITIAL_STATE)
})

describe('applySnapshot', () => {
  it('populates all fields from the snapshot event', () => {
    useRoomStore.getState().applySnapshot({
      type: 'room_snapshot',
      roomId: 'room1',
      roomCode: 'ABC123',
      expiresAt: '2026-01-02T00:00:00Z',
      participantId: 'p1',
      participants: [participant],
      messages: [message],
    })

    const state = useRoomStore.getState()
    expect(state.roomId).toBe('room1')
    expect(state.roomCode).toBe('ABC123')
    expect(state.participantId).toBe('p1')
    expect(state.participants).toHaveLength(1)
    expect(state.messages).toHaveLength(1)
    expect(state.expired).toBe(false)
    expect(state.error).toBeNull()
  })

  it('resolves agentMode from participants', () => {
    useRoomStore.getState().applySnapshot({
      type: 'room_snapshot',
      roomId: 'room1', roomCode: 'ABC123', expiresAt: '2026-01-02T00:00:00Z',
      participantId: 'p1',
      participants: [{ ...participant, agentMode: 'automatic' }],
      messages: [],
    })

    expect(useRoomStore.getState().agentMode).toBe('automatic')
  })
})

describe('setConnection', () => {
  it('updates connection without affecting other fields', () => {
    useRoomStore.setState({ roomId: 'room1', roomCode: 'ABC123' })
    useRoomStore.getState().setConnection('reconnecting')

    const state = useRoomStore.getState()
    expect(state.connection).toBe('reconnecting')
    expect(state.roomId).toBe('room1')
    expect(state.roomCode).toBe('ABC123')
  })
})

describe('markExpired', () => {
  it('sets expired to true', () => {
    expect(useRoomStore.getState().expired).toBe(false)
    useRoomStore.getState().markExpired()
    expect(useRoomStore.getState().expired).toBe(true)
  })
})

describe('addMessage', () => {
  it('appends a new message', () => {
    useRoomStore.getState().addMessage(message)
    expect(useRoomStore.getState().messages).toHaveLength(1)
  })

  it('ignores duplicate message ids', () => {
    useRoomStore.getState().addMessage(message)
    useRoomStore.getState().addMessage(message)
    expect(useRoomStore.getState().messages).toHaveLength(1)
  })

  it('clears pending correction when a reply arrives', () => {
    useRoomStore.setState({ pendingCorrections: ['msg1'] })
    useRoomStore.getState().addMessage({ ...message, id: 'reply1', replyToMessageId: 'msg1' })
    expect(useRoomStore.getState().pendingCorrections).toHaveLength(0)
  })
})

describe('applyParticipantUpdate', () => {
  it('updates participants list', () => {
    useRoomStore.setState({ participantId: 'p1' })
    useRoomStore.getState().applyParticipantUpdate({
      type: 'participant_update',
      participants: [participant, { ...participant, participantId: 'p2', name: 'Bob' }],
    })
    expect(useRoomStore.getState().participants).toHaveLength(2)
  })
})
