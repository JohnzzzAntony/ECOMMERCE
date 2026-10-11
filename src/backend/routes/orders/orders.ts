import { adminGuard } from '@/backend/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { sendOrderConfirmation, sendOrderAdminNotification } from '@/backend/integrations/resend'

export async function GET(request: Request) {
  const denied = await adminGuard(request)
  if (denied) return denied
  const orders = await db.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
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

  // Send emails immediately if it is a COD (Cash on Delivery) order.
  // Stripe orders are confirmed via the webhook.
  if (order.paymentMethod === 'cod') {
    try {
      await sendOrderConfirmation(order)
      await sendOrderAdminNotification(order)
    } catch (err) {
      console.error('Failed to send order emails for COD order:', err)
    }
  }

  return NextResponse.json({ ok: true, order })
}
