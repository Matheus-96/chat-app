import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  ROOM_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15_000),
  DEFAULT_OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_HTTP_REFERER: z.string().default('http://localhost:5173'),
  OPENROUTER_APP_NAME: z.string().default('Chat Writing Coach'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
  AI_PROVIDER: z.enum(['openrouter', 'mock']).default('openrouter'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration:', result.error.issues)
  process.exit(1)
}

export const config = result.data
export type Config = typeof config
