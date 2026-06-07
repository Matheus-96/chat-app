import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connect, type ConnectArgs } from '../client'
import { useRoomStore, INITIAL_STATE } from '../../../store/roomStore'
import { maybeNotifyMessage } from '../../notifications'

vi.mock('../../notifications', () => ({
  notifyNewMessage: vi.fn(),
  playNotificationTone: vi.fn(),
  maybeNotifyMessage: vi.fn(),
}))

const MAX_ATTEMPTS = 10

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []

  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) { this.sent.push(data) }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  triggerClose() {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }
}

const defaultArgs: ConnectArgs = {
  wsUrl: 'ws://localhost:3001/ws',
  roomCode: 'ABC123',
  participantId: 'p1',
  name: 'Alice',
  agentMode: 'manual',
}

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.useFakeTimers()
  useRoomStore.setState(INITIAL_STATE)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('initial connection', () => {
  it('sets connecting and creates socket', () => {
    connect(defaultArgs)
    expect(useRoomStore.getState().connection).toBe('connecting')
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('sets connected and sends join_room + set_agent_mode on open', () => {
    connect(defaultArgs)
    MockWebSocket.instances[0].triggerOpen()

    const state = useRoomStore.getState()
    expect(state.connection).toBe('connected')
    expect(state.error).toBeNull()

    const events = MockWebSocket.instances[0].sent.map((s) => JSON.parse(s) as { type: string })
    expect(events.some((e) => e.type === 'join_room')).toBe(true)
    expect(events.some((e) => e.type === 'set_agent_mode')).toBe(true)
  })
})

describe('reconnection backoff', () => {
  it('sets reconnecting and schedules retry on unexpected close', () => {
    const client = connect(defaultArgs)
    MockWebSocket.instances[0].triggerClose()

    expect(useRoomStore.getState().connection).toBe('reconnecting')
    expect(MockWebSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances).toHaveLength(2)

    client.close()
  })

  it('restores connected state and resends join_room after successful reconnect', () => {
    const client = connect(defaultArgs)
    MockWebSocket.instances[0].triggerClose()
    vi.advanceTimersByTime(1000)

    MockWebSocket.instances[1].triggerOpen()

    expect(useRoomStore.getState().connection).toBe('connected')
    const events = MockWebSocket.instances[1].sent.map((s) => JSON.parse(s) as { type: string })
    expect(events.some((e) => e.type === 'join_room')).toBe(true)

    client.close()
  })

  it('resets attempt counter on successful reconnect', () => {
    const client = connect(defaultArgs)

    // Close and reconnect once
    MockWebSocket.instances[0].triggerClose()
    vi.advanceTimersByTime(1000)
    MockWebSocket.instances[1].triggerOpen()

    // Close again — should still retry (counter was reset)
    MockWebSocket.instances[1].triggerClose()
    expect(useRoomStore.getState().connection).toBe('reconnecting')

    client.close()
  })

  it('transitions to disconnected after max attempts without success', () => {
    connect(defaultArgs)

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      MockWebSocket.instances.at(-1)!.triggerClose()
      vi.runAllTimers()
    }
    MockWebSocket.instances.at(-1)!.triggerClose()

    expect(useRoomStore.getState().connection).toBe('disconnected')
    expect(useRoomStore.getState().error).toBeTruthy()
    expect(MockWebSocket.instances).toHaveLength(MAX_ATTEMPTS + 1)
  })
})

describe('client.close', () => {
  it('cancels pending retry timer and prevents new socket creation', () => {
    const client = connect(defaultArgs)
    MockWebSocket.instances[0].triggerClose()

    expect(useRoomStore.getState().connection).toBe('reconnecting')
    client.close()

    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('does not trigger reconnect on intentional close', () => {
    const client = connect(defaultArgs)
    client.close()

    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(useRoomStore.getState().connection).not.toBe('reconnecting')
  })

  it('does not reconnect when room is expired', () => {
    connect(defaultArgs)
    useRoomStore.getState().markExpired()

    MockWebSocket.instances[0].triggerClose()
    vi.runAllTimers()

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(useRoomStore.getState().connection).not.toBe('reconnecting')
  })
})

describe('notification dispatch', () => {
  beforeEach(() => {
    vi.mocked(maybeNotifyMessage).mockClear()
  })

  const mockMessage = {
    id: 'msg1',
    roomId: 'room1',
    role: 'user' as const,
    authorId: 'p2',
    authorName: 'Bob',
    content: 'Hello',
    createdAt: new Date().toISOString(),
    reactions: {},
  }

  function sendSnapshot(ws: MockWebSocket) {
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'room_snapshot',
        roomId: 'room1',
        roomCode: 'ABC123',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        participantId: defaultArgs.participantId,
        participants: [],
        messages: [],
      }),
    })
  }

  function sendMessageCreated(ws: MockWebSocket) {
    ws.onmessage?.({
      data: JSON.stringify({ type: 'message_created', message: mockMessage }),
    })
  }

  it('calls maybeNotifyMessage after snapshot is received', () => {
    const client = connect(defaultArgs)
    MockWebSocket.instances[0].triggerOpen()
    sendSnapshot(MockWebSocket.instances[0])
    sendMessageCreated(MockWebSocket.instances[0])

    expect(vi.mocked(maybeNotifyMessage)).toHaveBeenCalledWith(mockMessage, defaultArgs.participantId)
    client.close()
  })

  it('does not call maybeNotifyMessage before snapshot is received', () => {
    const client = connect(defaultArgs)
    MockWebSocket.instances[0].triggerOpen()
    sendMessageCreated(MockWebSocket.instances[0])

    expect(vi.mocked(maybeNotifyMessage)).not.toHaveBeenCalled()
    client.close()
  })
})
