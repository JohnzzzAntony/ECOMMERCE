// Short-lived signed tokens for the draft preview iframe: bound to one store and one page (or import page).
import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_SECONDS = 15 * 60

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!value || value.length < 32) throw new Error('Configure AUTH_SECRET with at least 32 characters')
  return `preview:${value}`
}

export type PreviewTarget = { storeId: string; kind: 'page' | 'import'; id: string }

export function signPreviewToken(target: PreviewTarget, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...target, exp: Math.floor(now / 1000) + TTL_SECONDS })).toString('base64url')
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`
}

export function verifyPreviewToken(token: string | null | undefined, expected: PreviewTarget, now = Date.now()) {
  if (!token || token.length > 1000) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const want = createHmac('sha256', secret()).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false
  try {
    const v = JSON.parse(Buffer.from(body, 'base64url').toString()) as PreviewTarget & { exp: number }
    return v.exp > Math.floor(now / 1000) && v.storeId === expected.storeId && v.kind === expected.kind && v.id === expected.id
  } catch { return false }
}
