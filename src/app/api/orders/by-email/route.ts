import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Fetch orders by email (for customer order history)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const orders = await db.order.findMany({
    where: { email },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ orders })
}
