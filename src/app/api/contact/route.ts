import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { name, email, phone, subject, message } = await request.json()
  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 })
  }
  await db.contactMessage.create({
    data: { name, email, phone: phone || null, subject: subject || null, message },
  })
  return NextResponse.json({ ok: true, message: 'Message sent successfully' })
}
