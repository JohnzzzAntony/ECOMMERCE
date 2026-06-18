import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const orders = await db.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customerName, email, phone, billingAddress, shippingAddress, items, paymentMethod, notes } = body

  if (!customerName || !email || !items?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const subtotal = items.reduce((s: number, i: any) => s + i.unitPrice * i.qty, 0)
  const orderNumber = `JKR-ORD-${Date.now().toString().slice(-6)}`

  const order = await db.order.create({
    data: {
      orderNumber,
      customerName,
      email,
      phone: phone || null,
      billingAddress: JSON.stringify(billingAddress || {}),
      shippingAddress: JSON.stringify(shippingAddress || {}),
      subtotal,
      total: subtotal,
      paymentMethod: paymentMethod || 'cod',
      notes: notes || null,
      items: {
        create: items.map((i: any) => ({
          productId: i.productId || null,
          productName: i.productName,
          sku: i.sku || null,
          unitPrice: i.unitPrice,
          qty: i.qty,
          subtotal: i.unitPrice * i.qty,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json({ ok: true, order })
}
