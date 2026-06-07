import { describe, it, expect, vi } from 'vitest'
import type { WebSocket, WebSocketServer } from 'ws'
import { createWsHandler } from '../handler.js'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { RateLimiter } from '../../../infrastructure/RateLimiter.js'
import type { AIProvider } from '../../../infrastructure/ai/AIProvider.js'

const makeAiProvider = (): AIProvider => ({ analyze: vi.fn() })

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
