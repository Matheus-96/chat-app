export interface WritingFeedback {
  correctedText: string
  explanation: string
}

export interface ChunkingResult {
  chunks: Array<{
    text: string
    analysis: string
  }>
  error?: boolean
  errorReason?: string
}

export type ErrorReason = 'timeout' | 'invalid_key' | 'rate_limited'

export class AIProviderError extends Error {
  constructor(
    public readonly errorReason: ErrorReason,
    message: string,
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export interface AIProvider {
  analyze(text: string, apiKey?: string, customInstructions?: string): Promise<WritingFeedback>
  chunk(text: string, apiKey?: string): Promise<ChunkingResult>
}
