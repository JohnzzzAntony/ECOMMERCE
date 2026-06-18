import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const subscribers = await db.newsletterSubscriber.findMany({
    orderBy: { subscribedAt: 'desc' },
  })
  return NextResponse.json(subscribers)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (id) {
    await db.newsletterSubscriber.delete({ where: { id } })
  }
  return NextResponse.json({ ok: true })
}
