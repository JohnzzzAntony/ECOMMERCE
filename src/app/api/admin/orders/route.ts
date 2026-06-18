import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  const { id, orderStatus, paymentStatus } = await request.json()
  if (!id) return NextResponse.json({ error: 'Order id required' }, { status: 400 })

  const data: any = {}
  if (orderStatus) data.orderStatus = orderStatus
  if (paymentStatus) data.paymentStatus = paymentStatus

  const order = await db.order.update({ where: { id }, data })
  return NextResponse.json({ ok: true, order })
}
