import { NextResponse } from 'next/server'
import { checkOrigin, failure, SESSION_COOKIE } from '@/backend/lib/auth'
export async function POST(request: Request) {
  try { checkOrigin(request); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' }); return response }
  catch (error) { return failure(error) }
}
