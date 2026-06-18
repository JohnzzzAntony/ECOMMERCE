import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  if (!user.isActive) {
    return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
  }

  const { password: _, ...safeUser } = user
  return NextResponse.json({ user: safeUser })
}
