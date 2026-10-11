import { NextResponse } from 'next/server'
import { currentUser, failure, publicUser } from '@/backend/lib/auth'
export async function GET(request: Request) {
  try { const user = await currentUser(request); return NextResponse.json({ user: user ? publicUser(user) : null }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return failure(error) }
}
