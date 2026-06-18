import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const existing = await db.newsletterSubscriber.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already subscribed' })
  }

  await db.newsletterSubscriber.create({ data: { email } })
  return NextResponse.json({ ok: true, message: 'Subscribed successfully' })
}
