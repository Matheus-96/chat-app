import type { AIProvider, WritingFeedback } from './AIProvider.js'

export class MockAIProvider implements AIProvider {
  async analyze(_text: string): Promise<WritingFeedback> {
    return {
      correctedText: '[mock] Your text looks great!',
      explanation: 'Mock correction for testing purposes.',
    }
  }
}
