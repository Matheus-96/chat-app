export interface WritingFeedback {
  correctedText: string
  explanation: string
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
}
