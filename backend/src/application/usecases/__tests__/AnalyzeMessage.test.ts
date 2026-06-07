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
    }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(storage.hasReplyForMessage(room.id, userMessage.id)).toBe(true)
  })

  it('passes customInstructions to aiProvider.analyze when defined', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)
    const analyzeSpy = vi.fn().mockResolvedValue({ correctedText: 'Fixed.', explanation: 'Reason.' })

    const aiProvider: AIProvider = { analyze: analyzeSpy }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage, customInstructions: 'focus on prepositions' })

    expect(analyzeSpy).toHaveBeenCalledWith(userMessage.content, undefined, 'focus on prepositions')
  })

  it('passes undefined customInstructions to aiProvider.analyze when not provided', async () => {
    const storage = makeStorage()
    const room = storage.createRoom()
    const userMessage = makeUserMessage(storage, room.id)
    const analyzeSpy = vi.fn().mockResolvedValue({ correctedText: 'Fixed.', explanation: 'Reason.' })

    const aiProvider: AIProvider = { analyze: analyzeSpy }

    await analyzeMessage({ storage, aiProvider, roomId: room.id, userMessage })

    expect(analyzeSpy).toHaveBeenCalledWith(userMessage.content, undefined, undefined)
  })
})
