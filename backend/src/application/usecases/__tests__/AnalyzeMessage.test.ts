import { describe, it, expect, vi } from 'vitest'
import { InMemoryAdapter } from '../../../infrastructure/storage/InMemoryAdapter.js'
import { analyzeMessage } from '../AnalyzeMessage.js'
import type { AIProvider } from '../../../infrastructure/ai/AIProvider.js'
import { AIProviderError } from '../../../infrastructure/ai/AIProvider.js'

const makeStorage = () => new InMemoryAdapter({ roomTtlMs: 24 * 60 * 60 * 1000 })

function makeUserMessage(storage: ReturnType<typeof makeStorage>, roomId: string) {
  return storage.addMessage({ roomId, role: 'user', authorId: 'user-1', authorName: 'Alice', content: 'I goed to the store.' })!
}

describe('analyzeMessage', () => {
  it('happy path: returns assistant message with feedback', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)

    const aiProvider: AIProvider = {
      analyze: vi.fn().mockResolvedValue({ correctedText: 'I went to the store.', explanation: '"went" is the past tense of "go".' }),
      chunk: vi.fn(),
    }

    const result = await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage, apiKey: 'key-123' })

    expect(result.error).toBeUndefined()
    expect(result.message.role).toBe('assistant')
    expect(result.message.content).toBe('I went to the store.')
    expect(result.message.explanation).toBe('"went" is the past tense of "go".')
    expect(result.message.replyToMessageId).toBe(userMessage.id)
    expect(result.message.error).toBeUndefined()
  })

  it('timeout error: returns message with error: true and errorReason: timeout', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)

    const aiProvider: AIProvider = {
      analyze: vi.fn().mockRejectedValue(new AIProviderError('timeout', 'Request timed out')),
      chunk: vi.fn(),
    }

    const result = await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(result.error).toBe(true)
    expect(result.errorReason).toBe('timeout')
    expect(result.message.error).toBe(true)
    expect(result.message.errorReason).toBe('timeout')
    expect(result.message.replyToMessageId).toBe(userMessage.id)
    expect(result.message.role).toBe('assistant')
  })

  it('invalid_key error: returns message with error: true and errorReason: invalid_key', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)

    const aiProvider: AIProvider = {
      analyze: vi.fn().mockRejectedValue(new AIProviderError('invalid_key', 'Auth failed')),
      chunk: vi.fn(),
    }

    const result = await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(result.error).toBe(true)
    expect(result.errorReason).toBe('invalid_key')
    expect(result.message.error).toBe(true)
    expect(result.message.errorReason).toBe('invalid_key')
  })

  it('rate_limited error: returns message with error: true and errorReason: rate_limited', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)

    const aiProvider: AIProvider = {
      analyze: vi.fn().mockRejectedValue(new AIProviderError('rate_limited', 'Rate limit exceeded')),
      chunk: vi.fn(),
    }

    const result = await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(result.error).toBe(true)
    expect(result.errorReason).toBe('rate_limited')
    expect(result.message.error).toBe(true)
    expect(result.message.errorReason).toBe('rate_limited')
  })

  it('happy path: persists assistant message in storage', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)

    const aiProvider: AIProvider = {
      analyze: vi.fn().mockResolvedValue({ correctedText: 'Fixed.', explanation: 'Reason.' }),
      chunk: vi.fn(),
    }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(storage.hasReplyForMessage(room.id, userMessage.id)).toBe(true)
  })

  it('passes customInstructions to aiProvider.analyze when defined', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)
    const analyzeSpy = vi.fn().mockResolvedValue({ correctedText: 'Fixed.', explanation: 'Reason.' })

    const aiProvider: AIProvider = { analyze: analyzeSpy, chunk: vi.fn() }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage, customInstructions: 'focus on prepositions' })

    expect(analyzeSpy).toHaveBeenCalledWith(userMessage.content, undefined, 'focus on prepositions')
  })

  it('passes undefined customInstructions to aiProvider.analyze when not provided', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)
    const analyzeSpy = vi.fn().mockResolvedValue({ correctedText: 'Fixed.', explanation: 'Reason.' })

    const aiProvider: AIProvider = { analyze: analyzeSpy, chunk: vi.fn() }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(analyzeSpy).toHaveBeenCalledWith(userMessage.content, undefined, undefined)
  })

  describe('chunking mode', () => {
    it('happy path: mode=chunking returns message with chunking field', async () => {
      const storage = makeStorage()
      const room = storage.createRoom()
      const userMessage = makeUserMessage(storage, room.id)

      const aiProvider: AIProvider = {
        analyze: vi.fn(),
        chunk: vi.fn().mockResolvedValue({
          chunks: [
            { text: 'I goed', analysis: 'Eu fui' },
            { text: 'to the store', analysis: 'para a loja' },
          ],
        }),
      }

      const result = await analyzeMessage({
        storage,
        aiProvider,
        roomId: room.id,
        userMessage,
        mode: 'chunking',
        apiKey: 'key-123',
      })

      expect(result.error).toBeUndefined()
      expect(result.message.chunking).toBeDefined()
      expect(result.message.chunking?.chunks).toHaveLength(2)
      expect(result.message.chunking?.chunks[0]).toEqual({ text: 'I goed', analysis: 'Eu fui' })
      expect(result.message.chunking?.error).toBeUndefined()
    })

    it('mode=chunking timeout error: returns message with chunking.error=true', async () => {
      const storage = makeStorage()
      const room = storage.createRoom()
      const userMessage = makeUserMessage(storage, room.id)

      const aiProvider: AIProvider = {
        analyze: vi.fn(),
        chunk: vi.fn().mockRejectedValue(new AIProviderError('timeout', 'Request timed out')),
      }

      const result = await analyzeMessage({
        storage,
        aiProvider,
        roomId: room.id,
        userMessage,
        mode: 'chunking',
      })

      expect(result.error).toBe(true)
      expect(result.errorReason).toBe('timeout')
      expect(result.message.chunking).toBeDefined()
      expect(result.message.chunking?.error).toBe(true)
      expect(result.message.chunking?.errorReason).toBe('timeout')
      expect(result.message.chunking?.chunks).toEqual([])
    })

    it('mode=chunking invalid_key error: returns message with chunking.error=true', async () => {
      const storage = makeStorage()
      const room = storage.createRoom()
      const userMessage = makeUserMessage(storage, room.id)

      const aiProvider: AIProvider = {
        analyze: vi.fn(),
        chunk: vi.fn().mockRejectedValue(new AIProviderError('invalid_key', 'Auth failed')),
      }

      const result = await analyzeMessage({
        storage,
        aiProvider,
        roomId: room.id,
        userMessage,
        mode: 'chunking',
      })

      expect(result.error).toBe(true)
      expect(result.errorReason).toBe('invalid_key')
      expect(result.message.chunking?.error).toBe(true)
      expect(result.message.chunking?.errorReason).toBe('invalid_key')
    })

    it('mode=chunking does not create new assistant message in storage', async () => {
      const storage = makeStorage()
      const room = storage.createRoom()
      const userMessage = makeUserMessage(storage, room.id)

      const aiProvider: AIProvider = {
        analyze: vi.fn(),
        chunk: vi.fn().mockResolvedValue({ chunks: [{ text: 'text', analysis: 'análise' }] }),
      }

      const initialMessageCount = storage.getRoom(room.id)!.messages.length

      await analyzeMessage({
        storage,
        aiProvider,
        roomId: room.id,
        userMessage,
        mode: 'chunking',
      })

      const finalMessageCount = storage.getRoom(room.id)!.messages.length
      expect(finalMessageCount).toBe(initialMessageCount)
    })

    it('mode=chunking passes apiKey to aiProvider.chunk', async () => {
      const storage = makeStorage()
      const room = storage.createRoom()
      const userMessage = makeUserMessage(storage, room.id)
      const chunkSpy = vi.fn().mockResolvedValue({ chunks: [] })

      const aiProvider: AIProvider = { analyze: vi.fn(), chunk: chunkSpy }

      await analyzeMessage({
        storage,
        aiProvider,
        roomId: room.id,
        userMessage,
        mode: 'chunking',
        apiKey: 'key-456',
      })

      expect(chunkSpy).toHaveBeenCalledWith(userMessage.content, 'key-456')
    })
  })
})
