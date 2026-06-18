import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { email, password, firstName, lastName, phone } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const user = await db.user.create({
    data: {
      email,
      password,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      role: 'customer',
    },
  })

  const { password: _, ...safeUser } = user
  return NextResponse.json({ user: safeUser })
}
