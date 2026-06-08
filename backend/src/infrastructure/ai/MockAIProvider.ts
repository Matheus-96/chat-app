import type { AIProvider, WritingFeedback, ChunkingResult } from './AIProvider.js'

export class MockAIProvider implements AIProvider {
  async analyze(_text: string): Promise<WritingFeedback> {
    return {
      correctedText: '[mock] Your text looks great!',
      explanation: 'Mock correction for testing purposes.',
    }
  }

  async chunk(_text: string): Promise<ChunkingResult> {
    return {
      chunks: [
        { text: '[mock] chunk 1', analysis: '[mock] translation 1' },
        { text: '[mock] chunk 2', analysis: '[mock] translation 2' },
      ],
    }
  }
}
