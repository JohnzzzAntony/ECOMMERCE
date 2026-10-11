import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { sendEnquiryResponse } from '@/backend/integrations/resend'
import { ENQUIRY_STATUSES } from './enquiries'

// Email a reply to the customer and keep a copy in the enquiry's message thread.
export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const response = text(body.response, 'response', 10000, true)
    const status = body.status === undefined ? 'contacted' : body.status
    if (typeof status !== 'string' || !ENQUIRY_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status')

    const existing = await db.enquiry.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Enquiry not found')

    const emailed = await sendEnquiryResponse({ to: existing.email, customerName: existing.customerName, response })
    const enquiry = await db.enquiry.update({
      where: { id },
      data: {
        status,
        message: `${existing.message || ''}\n\n--- Admin Response (${new Date().toISOString().slice(0, 10)}) ---\n${response}`.trim(),
      },
    })
    return NextResponse.json({ ok: true, enquiry, emailed })
  } catch (error) { return failure(error) }
}
