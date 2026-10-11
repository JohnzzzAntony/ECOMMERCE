import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { sendNewsletterWelcome } from '@/backend/integrations/resend'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const existing = await db.newsletterSubscriber.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already subscribed' })
  }

  await db.newsletterSubscriber.create({ data: { email } })

  try {
    await sendNewsletterWelcome(email)
  } catch (err) {
    console.error('Failed to send newsletter welcome email:', err)
  }

  return NextResponse.json({ ok: true, message: 'Subscribed successfully' })
}
