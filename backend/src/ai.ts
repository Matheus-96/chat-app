import { z } from 'zod'

const responseSchema = z.object({
  correctedText: z.string().min(1),
  explanation: z.string().min(1),
})

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export type AnalysisMode = 'standard' | 'rewrite'

export interface WritingFeedback {
  correctedText: string
  explanation: string
}

interface FeedbackInput {
  apiKey?: string
  text: string
  mode?: AnalysisMode
}

const STANDARD_SYSTEM_PROMPT = [
  'You are an English writing coach inside a realtime chat application.',
  'Always return valid JSON with the shape {"correctedText":"...","explanation":"..."}.',
  'Keep the explanation concise and didactic.',
  'If the sentence is already natural and correct, keep correctedText very close to the original and explain why it works.',
  'Keep the explanation focused on the most important correction, not minor stylistic suggestions.',
  'Dont change the way the sentence is written more than necessary in correctedText, we want to preserve the user style as much as possible.',
].join(' ')

const REWRITE_SYSTEM_PROMPT = [
  'You are an English writing coach helping a user improve through active rewriting practice.',
  'Evaluate the message and flag ONLY critical grammatical errors: wrong verb form, subject-verb disagreement,',
  'incorrect tense, missing essential auxiliary verb, or clearly wrong word choice that changes meaning.',
  'Do NOT flag or penalize: lowercase "i" used as a first-person pronoun, informal punctuation, contractions,',
  'casual register, or minor stylistic choices that do not affect comprehension.',
  'In the explanation field, briefly describe the specific error and guide the user toward fixing it — do not give away the full corrected sentence.',
  'In correctedText, provide the fully corrected version (it will be hidden by default in the UI).',
  'If there are no critical errors, keep correctedText equal to the original and say the sentence is correct.',
  'Always return valid JSON: {"correctedText":"...","explanation":"..."}.',
].join(' ')

function extractJsonObject(payload: string) {
  const match = payload.match(/\{[\s\S]*\}/)

  if (!match) {
    throw new Error('The model response did not contain JSON output.')
  }

  return JSON.parse(match[0])
}

export async function generateWritingFeedback({ apiKey, text, mode = 'standard' }: FeedbackInput): Promise<WritingFeedback> {
  const resolvedApiKey = apiKey ?? process.env.DEFAULT_OPENROUTER_API_KEY

  if (!resolvedApiKey) {
    throw new Error('No API key was provided for OpenRouter.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
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
            content: mode === 'rewrite' ? REWRITE_SYSTEM_PROMPT : STANDARD_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Review this message and explain the main correction: ${text}`,
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`OpenRouter request failed with status ${response.status}: ${errorBody}`)
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
    }

    const content = payload.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('OpenRouter returned an empty response.')
    }

    return responseSchema.parse(extractJsonObject(content))
  } finally {
    clearTimeout(timeout)
  }
}