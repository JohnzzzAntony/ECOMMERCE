import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { createCheckoutSession } from '@/backend/integrations/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Fetch order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1
                }
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const stripeItems = order.items.map(item => {
      const imageUrl = item.product?.images?.[0]?.imageUrl || ''
      return {
        name: item.productName,
        description: item.sku ? `SKU: ${item.sku}` : undefined,
        imageUrl: imageUrl || undefined,
        unitPrice: item.unitPrice,
        quantity: item.qty,
        productId: item.productId || undefined
      }
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await createCheckoutSession({
      items: stripeItems,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.email,
      successUrl: `${siteUrl}?payment=success&orderId=${order.id}`,
      cancelUrl: `${siteUrl}/?payment=cancel&orderId=${order.id}`
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout session creation error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
