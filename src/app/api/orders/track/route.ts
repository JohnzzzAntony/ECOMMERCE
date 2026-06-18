import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Track order by order number + email
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('orderNumber')
  const email = searchParams.get('email')

  if (!orderNumber) {
    return NextResponse.json({ error: 'Order number required' }, { status: 400 })
  }

  const where: any = { orderNumber }
  if (email) where.email = email

  const order = await db.order.findFirst({
    where,
    include: { items: true },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ order })
}
