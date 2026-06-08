import type { StorageAdapter, RoomMessage } from '../../infrastructure/storage/StorageAdapter.js'
import type { AIProvider } from '../../infrastructure/ai/AIProvider.js'
import { AIProviderError } from '../../infrastructure/ai/AIProvider.js'

export interface AnalyzeMessageResult {
  message: RoomMessage
  error?: boolean
  errorReason?: string
}

export async function analyzeMessage(args: {
  storage: StorageAdapter
  aiProvider: AIProvider
  roomId: string
  userMessage: RoomMessage
  mode?: 'normal' | 'chunking'
  apiKey?: string
  customInstructions?: string
}): Promise<AnalyzeMessageResult> {
  const { storage, aiProvider, roomId, userMessage, mode = 'normal', apiKey, customInstructions } = args

  if (mode === 'chunking') {
    try {
      const chunkingResult = await aiProvider.chunk(userMessage.content, apiKey)

      const message = storage.getRoomMessage(roomId, userMessage.id)
      if (!message) throw new Error('User message not found.')

      message.chunking = chunkingResult
      return { message }
    } catch (error) {
      const errorReason = error instanceof AIProviderError ? error.errorReason : 'timeout'

      const message = storage.getRoomMessage(roomId, userMessage.id)
      if (!message) throw new Error('User message not found.')

      message.chunking = {
        chunks: [],
        error: true,
        errorReason,
      }
      return { message, error: true, errorReason }
    }
  }

  try {
    const feedback = await aiProvider.analyze(userMessage.content, apiKey, customInstructions)

    const message = storage.addMessage({
      roomId,
      role: 'assistant',
      authorId: 'coach',
      authorName: 'Coach',
      content: feedback.correctedText,
      explanation: feedback.explanation,
      replyToMessageId: userMessage.id,
    })

    if (!message) throw new Error('Failed to persist assistant message.')

    return { message }
  } catch (error) {
    const errorReason = error instanceof AIProviderError ? error.errorReason : 'timeout'

    const message = storage.addMessage({
      roomId,
      role: 'assistant',
      authorId: 'coach',
      authorName: 'Coach',
      content: 'Análise indisponível.',
      explanation: '',
      replyToMessageId: userMessage.id,
      error: true,
      errorReason,
    })

    if (!message) throw new Error('Failed to persist error assistant message.')

    return { message, error: true, errorReason }
  }
}
