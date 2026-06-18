import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Respond to an enquiry (updates status + adds admin response note to message)
export async function PUT(request: NextRequest) {
  const { id, status, response } = await request.json()
  if (!id) return NextResponse.json({ error: 'Enquiry id required' }, { status: 400 })

  const existing = await db.enquiry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })

  // Append admin response to the message field
  const updatedMessage = response
    ? `${existing.message || ''}\n\n--- Admin Response ---\n${response}`
    : existing.message

  const enquiry = await db.enquiry.update({
    where: { id },
    data: {
      status: status || existing.status,
      message: updatedMessage,
    },
  })

  return NextResponse.json({ ok: true, enquiry })
}
