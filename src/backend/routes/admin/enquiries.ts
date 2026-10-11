import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'

export const ENQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'closed']

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    if (typeof body.status !== 'string' || !ENQUIRY_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status')
    const enquiry = await db.enquiry.update({ where: { id }, data: { status: body.status } })
    return NextResponse.json({ ok: true, enquiry })
  } catch (error) { return failure(error) }
}
