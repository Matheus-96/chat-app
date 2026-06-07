import { EventEmitter } from 'events'
import { describe, it, expect, beforeEach } from 'vitest'
import type { WebSocket, WebSocketServer } from 'ws'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { createWsHandler } from '../handler.js'

// Minimal WebSocket mock backed by EventEmitter
class MockSocket extends EventEmitter {
  public socketId = ''
  public readonly readyState = 1
  public readonly OPEN = 1
  public readonly sent: unknown[] = []
  send(data: string) { this.sent.push(JSON.parse(data)) }
}

function makeMockWss(sockets: MockSocket[]) {
  return { clients: new Set(sockets) } as unknown as WebSocketServer
}

const makeStorage = () =>
  new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000, rateLimitMax: 10, rateLimitWindowMs: 15_000 })

function emit(socket: MockSocket, data: unknown) {
  socket.emit('message', Buffer.from(JSON.stringify(data)))
}

// Sets up a socket connected to a room (join_room handshake)
async function connectSocket(
  handleConnection: (s: WebSocket) => void,
  socket: MockSocket,
  roomCode: string,
  participantId: string,
  name: string,
) {
  handleConnection(socket as unknown as WebSocket)
  emit(socket, { type: 'join_room', roomCode, participantId, name })
  await Promise.resolve()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('update_name handler — happy path', () => {
  let storage: InMemoryAdapter
  let socket1: MockSocket
  let socket2: MockSocket

  beforeEach(async () => {
    storage = makeStorage()
    const room = storage.createRoom()

    socket1 = new MockSocket()
    socket2 = new MockSocket()
    const wss = makeMockWss([socket1, socket2])
    const handleConnection = createWsHandler(wss, storage)

    await connectSocket(handleConnection, socket1, room.roomCode, 'p1', 'Alice')
    await connectSocket(handleConnection, socket2, room.roomCode, 'p2', 'Bob')
    socket1.sent.length = 0
    socket2.sent.length = 0
  })

  it('calls updateParticipantName in storage', async () => {
    emit(socket1, { type: 'update_name', name: 'Alice Nova' })
    await Promise.resolve()

    // The updated name must appear in storage participants
    const conn = storage.getConnection(socket1.socketId)!
    const updated = storage.getParticipants(conn.roomId).find((p) => p.participantId === 'p1')
    expect(updated?.name).toBe('Alice Nova')
  })

  it('broadcasts participant_update with updated name to all sockets in room', async () => {
    emit(socket1, { type: 'update_name', name: 'Alice Nova' })
    await Promise.resolve()

    const s1Events = socket1.sent.filter((e: any) => e.type === 'participant_update')
    const s2Events = socket2.sent.filter((e: any) => e.type === 'participant_update')

    expect(s1Events).toHaveLength(1)
    expect(s2Events).toHaveLength(1)

    const alice = (s2Events[0] as any).participants.find((p: any) => p.participantId === 'p1')
    expect(alice?.name).toBe('Alice Nova')
  })

  it('does not emit an error event on success', async () => {
    emit(socket1, { type: 'update_name', name: 'Alice Nova' })
    await Promise.resolve()

    const errors = socket1.sent.filter((e: any) => e.type === 'error')
    expect(errors).toHaveLength(0)
  })
})

describe('update_name handler — error cases', () => {
  let storage: InMemoryAdapter
  let socket: MockSocket

  beforeEach(async () => {
    storage = makeStorage()
    socket = new MockSocket()
  })

  it('returns error when participant is not connected (no join_room)', async () => {
    const wss = makeMockWss([socket])
    const handleConnection = createWsHandler(wss, storage)
    handleConnection(socket as unknown as WebSocket)

    emit(socket, { type: 'update_name', name: 'Alice' })
    await Promise.resolve()

    const errors = socket.sent.filter((e: any) => e.type === 'error')
    expect(errors).toHaveLength(1)
    expect((errors[0] as any).message).toMatch(/entrar em uma sala/)
  })

  it('rejects update_name with empty name (schema validation)', async () => {
    const room = storage.createRoom()
    const wss = makeMockWss([socket])
    const handleConnection = createWsHandler(wss, storage)

    await connectSocket(handleConnection, socket, room.roomCode, 'p1', 'Alice')
    socket.sent.length = 0

    emit(socket, { type: 'update_name', name: '' })
    await Promise.resolve()

    // Schema fails → falls through to "Evento nao reconhecido"
    const errors = socket.sent.filter((e: any) => e.type === 'error')
    expect(errors).toHaveLength(1)
  })

  it('rejects update_name with name exceeding 32 chars', async () => {
    const room = storage.createRoom()
    const wss = makeMockWss([socket])
    const handleConnection = createWsHandler(wss, storage)

    await connectSocket(handleConnection, socket, room.roomCode, 'p1', 'Alice')
    socket.sent.length = 0

    emit(socket, { type: 'update_name', name: 'a'.repeat(33) })
    await Promise.resolve()

    const errors = socket.sent.filter((e: any) => e.type === 'error')
    expect(errors).toHaveLength(1)
  })
})
