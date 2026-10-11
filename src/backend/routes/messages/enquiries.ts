import { adminGuard } from '@/backend/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { sendEnquiryNotification } from '@/backend/integrations/resend'

export async function GET(request: Request) {
  const denied = await adminGuard(request)
  if (denied) return denied
  const enquiries = await db.enquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return NextResponse.json(enquiries)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customerName, email, phone, company, message, items } = body

  if (!customerName || !email || !items?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const total = items.reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0)

  const enquiry = await db.enquiry.create({
    data: {
      customerName,
      email,
      phone: phone || null,
      company: company || null,
      message: message || null,
      itemsJson: JSON.stringify(items),
      total,
    },
  })

  try {
    await sendEnquiryNotification({
      customerName,
      email,
      phone,
      company,
      message,
      itemsJson: JSON.stringify(items),
      total,
    })
  } catch (err) {
    console.error('Failed to send enquiry notification email:', err)
  }

  return NextResponse.json({ ok: true, enquiry })
}
