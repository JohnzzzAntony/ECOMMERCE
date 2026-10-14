// Card checkout: prices come from the catalogue (never the browser), an unpaid order is created, and the shopper is
// sent to Stripe's hosted payment page. The Stripe webhook marks the order paid.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/backend/lib/db'
import { checkOrigin, currentUser, HttpError } from '@/backend/lib/auth'
import { rateLimit } from '@/backend/lib/rate-limit'
import { clientIp } from '@/backend/lib/tenancy'
import { createCheckoutSession, stripe } from '@/backend/integrations/stripe'
import { effectivePrice } from '@/shared/storefront'

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1).max(40), qty: z.number().int().min(1).max(99) })).min(1).max(50),
  customerName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  /** Where "back" on the payment page returns to (a same-site path). */
  returnPath: z.string().max(300).regex(/^\/(?!\/)/).optional().default('/checkout'),
})

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    rateLimit(`checkout:${clientIp(request) ?? 'unknown'}`, 10, 60_000)
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 })
    const body = parsed.data

    // Merge repeated lines, then price every line from the database.
    const qtyById = new Map<string, number>()
    for (const i of body.items) qtyById.set(i.productId, Math.min(99, (qtyById.get(i.productId) ?? 0) + i.qty))
    const products = await db.product.findMany({ where: { id: { in: [...qtyById.keys()] } }, include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } })
    if (products.length !== qtyById.size) return NextResponse.json({ error: 'A product in your order is no longer available.' }, { status: 409 })
    const unavailable = products.find((p) => !p.inStock)
    if (unavailable) return NextResponse.json({ error: `${unavailable.name} is out of stock.` }, { status: 409 })

    const lines = products.map((p) => ({ product: p, qty: qtyById.get(p.id)!, unitPrice: effectivePrice(p) }))
    const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
    const user = await currentUser(request)

    const order = await db.order.create({
      data: {
        orderNumber: `JKR-ORD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        userId: user?.id ?? null,
        customerName: body.customerName,
        email: body.email,
        phone: body.phone || null,
        billingAddress: '{}',
        shippingAddress: '{}',
        subtotal,
        total: subtotal,
        paymentMethod: 'stripe',
        notes: body.notes || null,
        items: { create: lines.map((l) => ({ productId: l.product.id, productName: l.product.name, sku: l.product.sku, unitPrice: l.unitPrice, qty: l.qty, subtotal: l.unitPrice * l.qty })) },
      },
    })

    const site = siteUrl()
    const session = await createCheckoutSession({
      items: lines.map((l) => ({
        name: l.product.name,
        description: l.product.sku ? `SKU: ${l.product.sku}` : undefined,
        imageUrl: /^https:\/\//.test(l.product.images[0]?.imageUrl ?? '') ? l.product.images[0].imageUrl : undefined,
        unitPrice: l.unitPrice,
        quantity: l.qty,
        productId: l.product.id,
      })),
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: body.email,
      successUrl: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${site}${body.returnPath}${body.returnPath.includes('?') ? '&' : '?'}cancelled=1`,
    })
    return NextResponse.json({ url: session.url, orderNumber: order.orderNumber })
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Checkout failed:', error)
    return NextResponse.json({ error: 'Payment could not be started. Please try again.' }, { status: 500 })
  }
}

/** Outcome of a Stripe Checkout session, for the success page. Only the order number and status are revealed. */
export async function checkoutResult(sessionId: string) {
  if (!/^cs_[\w]+$/.test(sessionId)) return null
  const session = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null)
  const orderId = session?.metadata?.orderId
  if (!session || !orderId) return null
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true } })
  if (!order) return null
  return { orderNumber: order.orderNumber, total: order.total, paid: session.payment_status === 'paid' }
}
