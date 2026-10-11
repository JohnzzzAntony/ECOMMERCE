import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { idParam, readJson } from '@/backend/lib/admin-resource'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const subscribers = await db.newsletterSubscriber.findMany({ orderBy: { subscribedAt: 'desc' } })
    return NextResponse.json(subscribers, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

// Pause/resume a subscriber without deleting them.
export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Invalid isActive')
    const subscriber = await db.newsletterSubscriber.update({
      where: { id: text(body.id, 'id', 64, true) },
      data: { isActive: body.isActive },
    })
    return NextResponse.json({ ok: true, subscriber })
  } catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    await db.newsletterSubscriber.delete({ where: { id: idParam(request) } })
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
