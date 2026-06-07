import { describe, it, expect, vi, afterEach } from 'vitest'
import { RateLimiter } from '../RateLimiter.js'

afterEach(() => { vi.useRealTimers() })

describe('RateLimiter', () => {
  it('allows messages up to the configured limit', () => {
    const rl = new RateLimiter(3, 5000)
    expect(rl.check('conn-1')).toBe(true)
    expect(rl.check('conn-1')).toBe(true)
    expect(rl.check('conn-1')).toBe(true)
  })

  it('blocks when limit is exceeded', () => {
    const rl = new RateLimiter(3, 5000)
    rl.check('conn-1')
    rl.check('conn-1')
    rl.check('conn-1')
    expect(rl.check('conn-1')).toBe(false)
  })

  it('tracks limits per key independently', () => {
    const rl = new RateLimiter(1, 5000)
    expect(rl.check('conn-1')).toBe(true)
    expect(rl.check('conn-2')).toBe(true)
    expect(rl.check('conn-1')).toBe(false)
  })

  it('releases slots after the window expires', () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(3, 5000)

    rl.check('conn-1')
    rl.check('conn-1')
    rl.check('conn-1')
    expect(rl.check('conn-1')).toBe(false)

    vi.advanceTimersByTime(5001)
    expect(rl.check('conn-1')).toBe(true)
  })
})
