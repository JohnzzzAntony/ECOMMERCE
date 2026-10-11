import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PREFIX = 'scrypt$'

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64) as Buffer
  return `${PREFIX}${salt}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) {
    const a = Buffer.from(password), b = Buffer.from(stored)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  const [, salt, encoded] = stored.split('$')
  if (!salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) return false
  const actual = await scrypt(password, salt, 64) as Buffer
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'))
}

export function needsPasswordUpgrade(stored: string) { return !stored.startsWith(PREFIX) }

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!value || value.length < 32) throw new Error('Configure AUTH_SECRET with at least 32 characters')
  return value
}

export function passwordVersion(password: string): string {
  return createHmac('sha256', secret()).update(password).digest('base64url')
}

export function signSession(userId: string, password: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ sub: userId, ver: passwordVersion(password), exp: Math.floor(now / 1000) + 8 * 60 * 60 })).toString('base64url')
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`
}

export function readSession(token: string, now = Date.now()): { sub: string; ver: string; exp: number } | null {
  if (token.length > 2048) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra) return null
  const expected = createHmac('sha256', secret()).update(body).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof value.sub === 'string' && typeof value.ver === 'string' && Number.isFinite(value.exp) && value.exp > Math.floor(now / 1000) ? value : null
  } catch { return null }
}
