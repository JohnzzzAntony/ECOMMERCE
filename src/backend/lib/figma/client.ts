// Figma REST client. Never called from the storefront.
// Auth headers per https://developers.figma.com/docs/rest-api/authentication/ :
// OAuth tokens use `Authorization: Bearer`, personal access tokens use `X-Figma-Token`.
// Rate limits per https://developers.figma.com/docs/rest-api/rate-limits/ (checked 2026-10-14): Tier 1 endpoints
// (file, nodes, images) allow 10–20 requests/min per user and plan; 429 responses carry Retry-After in seconds.
// Each connection gets a token bucket sized for the lowest paid tier, and 429/5xx/network errors are retried.
import { randomUUID } from 'node:crypto'
import { log } from '@/backend/lib/log'

// FIGMA_API_BASE points tests (E2E) at a mock server; ignored in production.
export const FIGMA_API = (process.env.NODE_ENV !== 'production' && process.env.FIGMA_API_BASE) || 'https://api.figma.com'
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 4
const BUCKET_CAPACITY = 10
const REFILL_PER_MS = 10 / 60_000
const MAX_RETRY_AFTER_MS = 120_000

/** `key` identifies the connection (store) for rate limiting. */
export type FigmaAuth = { type: 'OAUTH' | 'PAT'; token: string; key?: string }

export class FigmaApiError extends Error {
  /** For 429: how long Figma asked us to wait (ms). */
  retryAfterMs?: number
  constructor(public status: number, message: string, public requestId: string) { super(message) }
}

/** Replaceable in tests. */
export const timing = { sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), now: () => Date.now(), random: Math.random }

const g = globalThis as unknown as { __figmaBuckets?: Map<string, { tokens: number; at: number }> }
const buckets = (g.__figmaBuckets ??= new Map())

async function takeToken(key: string) {
  for (;;) {
    const now = timing.now()
    const b = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, at: now }
    b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + (now - b.at) * REFILL_PER_MS)
    b.at = now
    buckets.set(key, b)
    if (b.tokens >= 1) { b.tokens -= 1; return }
    await timing.sleep(Math.ceil((1 - b.tokens) / REFILL_PER_MS))
  }
}

export function resetFigmaBuckets() { buckets.clear() }

const backoff = (attempt: number) => Math.min(30_000, 500 * 2 ** attempt) * (0.5 + timing.random()) // exponential, ±50% jitter

export async function figmaRequest<T>(path: string, auth: FigmaAuth, init: RequestInit = {}): Promise<T> {
  const requestId = randomUUID()
  const headers = new Headers(init.headers)
  if (auth.type === 'OAUTH') headers.set('Authorization', `Bearer ${auth.token}`)
  else headers.set('X-Figma-Token', auth.token)
  const key = auth.key ?? 'default'

  for (let attempt = 0; ; attempt++) {
    await takeToken(key)
    const started = timing.now()
    let res: Response
    try {
      res = await fetch(`${FIGMA_API}${path}`, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      log('warn', 'figma request failed', { requestId, path, attempt, error })
      if (attempt < MAX_RETRIES) { await timing.sleep(backoff(attempt)); continue }
      throw new FigmaApiError(0, 'Could not reach Figma', requestId)
    }
    log('info', 'figma request', { requestId, path: path.split('?')[0], status: res.status, attempt, ms: timing.now() - started })
    if (res.ok) return (await res.json()) as T

    const retryAfterMs = res.status === 429 && Number(res.headers.get('retry-after')) > 0 ? Number(res.headers.get('retry-after')) * 1000 : null
    // A long Retry-After (seat or plan limits) is not slept through: the caller reschedules (e.g. the import job).
    if (retryAfterMs !== null && retryAfterMs > MAX_RETRY_AFTER_MS) {
      await res.body?.cancel().catch(() => {})
      log('warn', 'figma rate limit', { requestId, path: path.split('?')[0], retryAfterMs, planTier: res.headers.get('x-figma-plan-tier'), limitType: res.headers.get('x-figma-rate-limit-type') })
      throw Object.assign(new FigmaApiError(429, `Figma rate limit reached; retry in ${Math.ceil(retryAfterMs / 60_000)} min`, requestId), { retryAfterMs })
    }
    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < MAX_RETRIES) {
      const wait = retryAfterMs ?? backoff(attempt)
      log('warn', 'figma request retry', { requestId, path: path.split('?')[0], status: res.status, waitMs: Math.round(wait), planTier: res.headers.get('x-figma-plan-tier'), limitType: res.headers.get('x-figma-rate-limit-type') })
      await res.body?.cancel().catch(() => {})
      await timing.sleep(wait)
      continue
    }
    const body = await res.json().catch(() => null)
    throw new FigmaApiError(res.status, body?.err ?? body?.message ?? `Figma returned ${res.status}`, requestId)
  }
}

export type FigmaMe = { id: string; handle: string; email?: string; img_url?: string }

/** GET /v1/me (scope current_user:read). */
export function figmaMe(auth: FigmaAuth) {
  return figmaRequest<FigmaMe>('/v1/me', auth)
}
