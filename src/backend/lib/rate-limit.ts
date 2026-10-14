// Fixed-window request limiter, in process memory. Matches the single-instance deployment; with several
// instances each enforces its own window.
import { HttpError } from '@/backend/lib/auth'

const g = globalThis as unknown as { __rateLimits?: Map<string, { count: number; resetAt: number }> }
const windows = (g.__rateLimits ??= new Map())

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let w = windows.get(key)
  if (!w || w.resetAt <= now) {
    if (windows.size > 10_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k)
    w = { count: 0, resetAt: now + windowMs }
    windows.set(key, w)
  }
  if (++w.count > limit) throw new HttpError(429, 'Too many requests. Please wait a moment and try again.')
}

export function resetRateLimits() {
  windows.clear()
}
