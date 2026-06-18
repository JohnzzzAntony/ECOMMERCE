import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  const { id, status } = await request.json()
  if (!id) return NextResponse.json({ error: 'Enquiry id required' }, { status: 400 })

  const enquiry = await db.enquiry.update({ where: { id }, data: { status } })
  return NextResponse.json({ ok: true, enquiry })
}
