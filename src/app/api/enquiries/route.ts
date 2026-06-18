import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const enquiries = await db.enquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
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

  return NextResponse.json({ ok: true, enquiry })
}
