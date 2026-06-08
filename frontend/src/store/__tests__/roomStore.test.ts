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
  reactions: {},
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

describe('setAgentMode', () => {
  it('sets agentMode to manual', () => {
    useRoomStore.getState().setAgentMode('manual')
    expect(useRoomStore.getState().agentMode).toBe('manual')
  })

  it('sets agentMode to automatic', () => {
    useRoomStore.getState().setAgentMode('automatic')
    expect(useRoomStore.getState().agentMode).toBe('automatic')
  })
})

describe('applySnapshot — agentMode', () => {
  it('resolves agentMode as manual when participant has manual mode', () => {
    useRoomStore.getState().applySnapshot({
      type: 'room_snapshot',
      roomId: 'room1', roomCode: 'ABC123', expiresAt: '2026-01-02T00:00:00Z',
      participantId: 'p1',
      participants: [{ ...participant, agentMode: 'manual' }],
      messages: [],
    })
    expect(useRoomStore.getState().agentMode).toBe('manual')
  })
})

describe('addPendingCorrection', () => {
  it('adds a messageId to pendingCorrections', () => {
    useRoomStore.getState().addPendingCorrection('msg1')
    expect(useRoomStore.getState().pendingCorrections).toContain('msg1')
  })

  it('does not duplicate an already-pending messageId', () => {
    useRoomStore.getState().addPendingCorrection('msg1')
    useRoomStore.getState().addPendingCorrection('msg1')
    expect(useRoomStore.getState().pendingCorrections).toHaveLength(1)
  })
})

describe('removePendingCorrection', () => {
  it('removes a messageId from pendingCorrections', () => {
    useRoomStore.setState({ pendingCorrections: ['msg1', 'msg2'] })
    useRoomStore.getState().removePendingCorrection('msg1')
    expect(useRoomStore.getState().pendingCorrections).not.toContain('msg1')
    expect(useRoomStore.getState().pendingCorrections).toContain('msg2')
  })

  it('is a no-op when messageId is not pending', () => {
    useRoomStore.setState({ pendingCorrections: ['msg2'] })
    useRoomStore.getState().removePendingCorrection('msg1')
    expect(useRoomStore.getState().pendingCorrections).toHaveLength(1)
  })
})

describe('updateReactions', () => {
  it('updates reactions on the correct message', () => {
    useRoomStore.setState({ messages: [message] })

    useRoomStore.getState().updateReactions('msg1', { '👍': ['p1', 'p2'] })

    const updated = useRoomStore.getState().messages[0]
    expect(updated.reactions['👍']).toEqual(['p1', 'p2'])
  })

  it('does not affect other messages', () => {
    const other: RoomMessage = { ...message, id: 'msg2', reactions: { '❤️': ['p1'] } }
    useRoomStore.setState({ messages: [message, other] })

    useRoomStore.getState().updateReactions('msg1', { '👍': ['p1'] })

    const otherAfter = useRoomStore.getState().messages.find((m) => m.id === 'msg2')!
    expect(otherAfter.reactions['❤️']).toEqual(['p1'])
  })

  it('is a no-op for unknown messageId', () => {
    useRoomStore.setState({ messages: [message] })

    expect(() => useRoomStore.getState().updateReactions('ghost', { '👍': ['p1'] })).not.toThrow()
    expect(useRoomStore.getState().messages[0].reactions).toEqual({})
  })

  it('snapshot with reactions populates messages correctly', () => {
    useRoomStore.getState().applySnapshot({
      type: 'room_snapshot',
      roomId: 'room1', roomCode: 'ABC123', expiresAt: '2026-01-02T00:00:00Z',
      participantId: 'p1',
      participants: [participant],
      messages: [{ ...message, reactions: { '😂': ['p2'] } }],
    })

    const msg = useRoomStore.getState().messages[0]
    expect(msg.reactions['😂']).toContain('p2')
  })
})

describe('updateMessageChunking', () => {
  it('updates chunking on the correct message', () => {
    useRoomStore.setState({ messages: [message] })

    useRoomStore.getState().updateMessageChunking({
      type: 'message_update',
      messageId: 'msg1',
      chunking: {
        chunks: [
          { text: 'The horse', analysis: 'O cavalo' },
          { text: 'is riding', analysis: 'está montando' },
        ],
      },
    })

    const updated = useRoomStore.getState().messages[0]
    expect(updated.chunking).toBeDefined()
    expect(updated.chunking?.chunks).toHaveLength(2)
    expect(updated.chunking?.chunks[0]).toEqual({ text: 'The horse', analysis: 'O cavalo' })
  })

  it('removes messageId from pendingCorrections when chunking arrives', () => {
    useRoomStore.setState({ messages: [message], pendingCorrections: ['msg1'] })

    useRoomStore.getState().updateMessageChunking({
      type: 'message_update',
      messageId: 'msg1',
      chunking: {
        chunks: [{ text: 'text', analysis: 'análise' }],
      },
    })

    expect(useRoomStore.getState().pendingCorrections).not.toContain('msg1')
  })

  it('handles chunking with error flag', () => {
    useRoomStore.setState({ messages: [message] })

    useRoomStore.getState().updateMessageChunking({
      type: 'message_update',
      messageId: 'msg1',
      chunking: {
        chunks: [],
        error: true,
        errorReason: 'timeout',
      },
    })

    const updated = useRoomStore.getState().messages[0]
    expect(updated.chunking?.error).toBe(true)
    expect(updated.chunking?.errorReason).toBe('timeout')
  })

  it('does not affect other messages', () => {
    const other: RoomMessage = { ...message, id: 'msg2' }
    useRoomStore.setState({ messages: [message, other] })

    useRoomStore.getState().updateMessageChunking({
      type: 'message_update',
      messageId: 'msg1',
      chunking: { chunks: [{ text: 'chunk', analysis: 'análise' }] },
    })

    const otherAfter = useRoomStore.getState().messages.find((m) => m.id === 'msg2')!
    expect(otherAfter.chunking).toBeUndefined()
  })

  it('is a no-op for unknown messageId', () => {
    useRoomStore.setState({ messages: [message] })

    expect(() => {
      useRoomStore.getState().updateMessageChunking({
        type: 'message_update',
        messageId: 'ghost',
        chunking: { chunks: [{ text: 'chunk', analysis: 'análise' }] },
      })
    }).not.toThrow()
    expect(useRoomStore.getState().messages[0].chunking).toBeUndefined()
  })

  it('replaces previous chunking when new chunking arrives', () => {
    const msgWithChunking: RoomMessage = {
      ...message,
      chunking: { chunks: [{ text: 'old', analysis: 'velho' }] },
    }
    useRoomStore.setState({ messages: [msgWithChunking] })

    useRoomStore.getState().updateMessageChunking({
      type: 'message_update',
      messageId: 'msg1',
      chunking: { chunks: [{ text: 'new', analysis: 'novo' }] },
    })

    const updated = useRoomStore.getState().messages[0]
    expect(updated.chunking?.chunks).toHaveLength(1)
    expect(updated.chunking?.chunks[0].text).toBe('new')
  })
})
