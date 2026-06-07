export class RateLimiter {
  private readonly windows = new Map<string, number[]>()

  constructor(private readonly max: number, private readonly windowMs: number) {}

  check(key: string): boolean {
    const now = Date.now()
    const threshold = now - this.windowMs
    const timestamps = (this.windows.get(key) ?? []).filter((ts) => ts >= threshold)

    if (timestamps.length >= this.max) {
      this.windows.set(key, timestamps)
      return false
    }

    timestamps.push(now)
    this.windows.set(key, timestamps)
    return true
  }
}
