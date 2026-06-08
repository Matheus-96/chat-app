import { describe, it, expect, vi } from 'vitest'
import type { WebSocket, WebSocketServer } from 'ws'
import { createWsHandler } from '../handler.js'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { RateLimiter } from '../../../infrastructure/RateLimiter.js'
import type { AIProvider } from '../../../infrastructure/ai/AIProvider.js'
import { AIProviderError } from '../../../infrastructure/ai/AIProvider.js'

const makeAiProvider = (): AIProvider => ({ analyze: vi.fn(), chunk: vi.fn() })

function makeSocket() {
  const received: Array<Record<string, unknown>> = []
  const listeners: Record<string, Array<(...args: unknown[]) => unknown>> = {}
  const socket = {
    readyState: 1,
    OPEN: 1,
    socketId: '',
    send(data: string) { received.push(JSON.parse(data)) },
    on(event: string, fn: (...args: unknown[]) => unknown) {
      ;(listeners[event] ??= []).push(fn)
    },
    async dispatch(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) await fn(...args)
    },
    received,
  }
  return socket
}

function makeWss(socket: ReturnType<typeof makeSocket>) {
  return { clients: new Set([socket]) } as unknown as WebSocketServer
}

async function setupRoomWithParticipant() {
  const storage = new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })
  const room = storage.createRoom()
  const rateLimiter = new RateLimiter(10, 15_000)
  const aiProvider = makeAiProvider()
  const socket = makeSocket()
  const wss = makeWss(socket)

  const handleConnection = createWsHandler(wss, storage, rateLimiter, aiProvider)
  handleConnection(socket as unknown as WebSocket)

  await socket.dispatch('message', Buffer.from(JSON.stringify({ type: 'join_room', roomCode: room.roomCode, participantId: 'p1', name: 'Alice' })))
  socket.received.length = 0

  return { storage, socket, wss, room }
}

describe('WS handler — reactions', () => {
  it('add_reaction broadcasts reaction_added with updated reactions', async () => {
    const { storage, socket, room } = await setupRoomWithParticipant()
    const msg = storage.addMessage({ roomId: room.id, role: 'user', authorId: 'p1', authorName: 'Alice', content: 'hi' })!

    await socket.dispatch('message', Buffer.from(JSON.stringify({ type: 'add_reaction', messageId: msg.id, emoji: '👍' })))

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'reaction_added', messageId: msg.id, emoji: '👍', participantId: 'p1' }))
    expect(socket.received[0].reactions).toMatchObject({ '👍': ['p1'] })
  })

  it('remove_reaction broadcasts reaction_removed', async () => {
    const { storage, socket, room } = await setupRoomWithParticipant()
    const msg = storage.addMessage({ roomId: room.id, role: 'user', authorId: 'p1', authorName: 'Alice', content: 'hi' })!
    storage.addReaction(room.id, msg.id, 'p1', '👍')

    await socket.dispatch('message', Buffer.from(JSON.stringify({ type: 'remove_reaction', messageId: msg.id, emoji: '👍' })))

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'reaction_removed', messageId: msg.id, emoji: '👍', participantId: 'p1' }))
  })

  it('returns error for non-existent message', async () => {
    const { socket } = await setupRoomWithParticipant()

    await socket.dispatch('message', Buffer.from(JSON.stringify({ type: 'add_reaction', messageId: 'ghost', emoji: '👍' })))

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'error' }))
  })

  it('rejects invalid emoji', async () => {
    const { socket } = await setupRoomWithParticipant()

    await socket.dispatch('message', Buffer.from(JSON.stringify({ type: 'add_reaction', messageId: 'any', emoji: '🤔' })))

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'error' }))
  })
})

describe('WS handler — customInstructions validation', () => {
  it('rejects send_message with customInstructions longer than 250 chars', async () => {
    const storage = new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })
    const rateLimiter = new RateLimiter(10, 15_000)
    const aiProvider = makeAiProvider()
    const socket = makeSocket()
    const wss = makeWss(socket)

    const handleConnection = createWsHandler(wss, storage, rateLimiter, aiProvider)
    handleConnection(socket as unknown as WebSocket)

    await socket.dispatch(
      'message',
      Buffer.from(JSON.stringify({ type: 'send_message', content: 'hello', customInstructions: 'x'.repeat(251) })),
    )

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(aiProvider.analyze).not.toHaveBeenCalled()
  })

  it('rejects analyze_message with customInstructions longer than 250 chars', async () => {
    const storage = new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })
    const rateLimiter = new RateLimiter(10, 15_000)
    const aiProvider = makeAiProvider()
    const socket = makeSocket()
    const wss = makeWss(socket)

    const handleConnection = createWsHandler(wss, storage, rateLimiter, aiProvider)
    handleConnection(socket as unknown as WebSocket)

    await socket.dispatch(
      'message',
      Buffer.from(JSON.stringify({ type: 'analyze_message', messageId: 'msg-1', customInstructions: 'x'.repeat(251) })),
    )

    expect(socket.received).toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(aiProvider.analyze).not.toHaveBeenCalled()
  })
})

describe('WS handler — analyze_message chunking mode', () => {
  it('AnalyzeMessage usecase with mode=chunking returns message with chunking field', async () => {
    const storage = new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })
    const room = storage.createRoom()
    const msg = storage.addMessage({ roomId: room.id, role: 'user', authorId: 'p1', authorName: 'Alice', content: 'I goed' })!
    const aiProvider: AIProvider = {
      analyze: vi.fn(),
      chunk: vi.fn().mockResolvedValue({
        chunks: [{ text: 'I goed', analysis: 'Eu fui' }],
      }),
    }

    const result = await (await import('../../../application/usecases/AnalyzeMessage.js')).analyzeMessage({
      storage,
      aiProvider,
      roomId: room.id,
      userMessage: msg,
      mode: 'chunking',
      apiKey: 'key',
    })

    expect(result.message.chunking).toBeDefined()
    expect(result.message.chunking?.chunks[0]).toEqual({ text: 'I goed', analysis: 'Eu fui' })
    expect(aiProvider.chunk).toHaveBeenCalledWith('I goed', 'key')
  })

  it('AnalyzeMessage usecase with mode=chunking error returns message with error flag', async () => {
    const storage = new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })
    const room = storage.createRoom()
    const msg = storage.addMessage({ roomId: room.id, role: 'user', authorId: 'p1', authorName: 'Alice', content: 'text' })!
    const aiProvider: AIProvider = {
      analyze: vi.fn(),
      chunk: vi.fn().mockRejectedValue(new AIProviderError('timeout', 'Request timed out')),
    }

    const result = await (await import('../../../application/usecases/AnalyzeMessage.js')).analyzeMessage({
      storage,
      aiProvider,
      roomId: room.id,
      userMessage: msg,
      mode: 'chunking',
    })

    expect(result.error).toBe(true)
    expect(result.message.chunking?.error).toBe(true)
    expect(result.message.chunking?.errorReason).toBe('timeout')
  })
})
