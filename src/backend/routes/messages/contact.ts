import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { sendContactNotification } from '@/backend/integrations/resend'

export async function POST(request: NextRequest) {
  const { name, email, phone, subject, message } = await request.json()
  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 })
  }
  await db.contactMessage.create({
    data: { name, email, phone: phone || null, subject: subject || null, message },
  })

  try {
    await sendContactNotification({ name, email, phone, subject, message })
  } catch (err) {
    console.error('Failed to send contact notification email:', err)
  }

  return NextResponse.json({ ok: true, message: 'Message sent successfully' })
}
