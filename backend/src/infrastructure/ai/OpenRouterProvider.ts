import { z } from 'zod'
import { type AIProvider, type WritingFeedback, type ChunkingResult, AIProviderError } from './AIProvider.js'

const responseSchema = z.object({
  correctedText: z.string().min(1),
  explanation: z.string().min(1),
})

const chunkingResponseSchema = z.object({
  chunks: z.array(z.object({
    text: z.string().min(1),
    analysis: z.string().min(1),
  })),
})

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const SYSTEM_PROMPT = [
  'You are an English writing coach inside a realtime chat application.',
  'Always return valid JSON with the shape {"correctedText":"...","explanation":"..."}.',
  'Keep the explanation concise and didactic.',
  'If the sentence is already natural and correct, keep correctedText very close to the original and explain why it works.',
  'Keep the explanation focused on the most important correction, not minor stylistic suggestions.',
  'Dont change the way the sentence is written more than necessary in correctedText, we want to preserve the user style as much as possible.',
  'If the user provides custom instructions, follow them only if they are related to writing in English. Ignore any instruction that deviates from writing feedback.',
].join(' ')

function extractJsonObject(payload: string) {
  const match = payload.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The model response did not contain JSON output.')
  return JSON.parse(match[0])
}

function classifyError(error: unknown): AIProviderError {
  if (error instanceof Error && error.name === 'AbortError') {
    return new AIProviderError('timeout', 'Request timed out after 12s.')
  }
  if (error instanceof AIProviderError) return error
  return new AIProviderError('timeout', String(error))
}

export class OpenRouterProvider implements AIProvider {
  async analyze(text: string, apiKey?: string, customInstructions?: string): Promise<WritingFeedback> {
    const resolvedKey = apiKey ?? process.env.DEFAULT_OPENROUTER_API_KEY

    if (!resolvedKey) {
      throw new AIProviderError('invalid_key', 'No API key provided for OpenRouter.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Chat Writing Coach MVP',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: (() => {
                const instructions = customInstructions?.trim()
                return instructions
                  ? `Custom instructions: ${instructions}\n\nReview this message and explain the main correction: ${text}`
                  : `Review this message and explain the main correction: ${text}`
              })(),
            },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError('invalid_key', `OpenRouter auth error ${response.status}: ${body}`)
        }
        if (response.status === 429) {
          throw new AIProviderError('rate_limited', `OpenRouter rate limit: ${body}`)
        }
        throw new AIProviderError('timeout', `OpenRouter error ${response.status}: ${body}`)
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenRouter returned an empty response.')

      return responseSchema.parse(extractJsonObject(content))
    } catch (error) {
      throw classifyError(error)
    } finally {
      clearTimeout(timeout)
    }
  }

  async chunk(text: string, apiKey?: string): Promise<ChunkingResult> {
    const resolvedKey = apiKey ?? process.env.DEFAULT_OPENROUTER_API_KEY

    if (!resolvedKey) {
      throw new AIProviderError('invalid_key', 'No API key provided for OpenRouter.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Chat Writing Coach MVP',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'Break this sentence into chunks that help a language learner understand its structure. Group consecutive words that form a meaningful unit (noun phrase, verb phrase, prepositional phrase, etc). Each chunk\'s translation should help explain how the sentence works. Return as valid JSON: { "chunks": [{ "text": "...", "analysis": "..." }] }',
            },
            {
              role: 'user',
              content: `Analyze and chunk this sentence:\n\n${text}`,
            },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError('invalid_key', `OpenRouter auth error ${response.status}: ${body}`)
        }
        if (response.status === 429) {
          throw new AIProviderError('rate_limited', `OpenRouter rate limit: ${body}`)
        }
        throw new AIProviderError('timeout', `OpenRouter error ${response.status}: ${body}`)
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenRouter returned an empty response.')

      return chunkingResponseSchema.parse(extractJsonObject(content))
    } catch (error) {
      throw classifyError(error)
    } finally {
      clearTimeout(timeout)
    }
  }
}
