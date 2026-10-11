import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { passwordVersion, readSession, signSession } from './password'

export const SESSION_COOKIE = 'commerce_session'
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function checkOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  // Compare against the host the browser addressed (forwarded by the reverse proxy),
  // not request.url, which Next.js builds from its own bind address (e.g. localhost:3000).
  // Browsers cannot set Host/X-Forwarded-Host on cross-site requests, so this still blocks CSRF.
  const origin = request.headers.get('origin')
  const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  let originHost: string | null = null
  try { originHost = origin ? new URL(origin).host : null } catch { originHost = 'invalid' }
  if ((originHost && originHost !== expectedHost) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Cross-site requests are not allowed')
  }
}

export async function currentUser(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))
  if (!cookie) return null
  const session = readSession(cookie.slice(SESSION_COOKIE.length + 1))
  if (!session) return null
  const user = await db.user.findUnique({ where: { id: session.sub } })
  if (!user?.isActive || passwordVersion(user.password) !== session.ver) return null
  return user
}

export async function requireUser(request: Request) {
  checkOrigin(request)
  const user = await currentUser(request)
  if (!user) throw new HttpError(401, 'Sign in required')
  return user
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request)
  if (user.role !== 'admin') throw new HttpError(403, 'Administrator access required')
  return user
}

export function publicUser<T extends { password: string }>(user: T) {
  const { password, ...safe } = user
  void password
  return safe
}

export function setSession(response: NextResponse, user: { id: string; password: string }, request: Request) {
  const url = new URL(request.url)
  response.cookies.set(SESSION_COOKIE, signSession(user.id, user.password), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60,
    secure: url.protocol === 'https:' || (process.env.NODE_ENV === 'production' && !['localhost', '127.0.0.1'].includes(url.hostname)),
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function failure(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const code = (error as { code?: string })?.code
  if (code === 'P2002') return NextResponse.json({ error: 'A record with that value already exists' }, { status: 409 })
  if (code === 'P2025') return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  if (code === 'P2003') return NextResponse.json({ error: 'This record is referenced by another record' }, { status: 409 })
  console.error('Backend operation failed', error instanceof Error ? error.name : 'UnknownError')
  return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
}

export async function adminGuard(request: Request): Promise<NextResponse | null> {
  try { await requireAdmin(request); return null } catch (error) { return failure(error) }
}

export function text(value: unknown, name: string, max = 500, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, `Invalid ${name}`)
  return value.trim()
}

export function emailAddress(value: unknown): string {
  const email = text(value, 'email', 254, true).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid email address')
  return email
}
