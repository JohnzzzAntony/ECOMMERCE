// Card checkout: prices come from the catalogue (never the browser), an unpaid order is created, and the shopper is
// sent to Stripe's hosted payment page. The Stripe webhook marks the order paid.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/backend/lib/db'
import { checkOrigin, currentUser, HttpError } from '@/backend/lib/auth'
import { rateLimit } from '@/backend/lib/rate-limit'
import { clientIp } from '@/backend/lib/tenancy'
import { createCheckoutSession, stripe } from '@/backend/integrations/stripe'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { salonCatalog } from '@/backend/lib/ombrine'
import { isOmbrine, productSizes, salonCurrency } from '@/shared/ombrine'
import { effectivePrice } from '@/shared/storefront'

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1).max(40), qty: z.number().int().min(1).max(99), size: z.string().min(1).max(32).optional() })).min(1).max(50),
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

    const theme = await storefrontTheme()
    const ombrine = isOmbrine(theme)
    const currency = ombrine ? salonCurrency(theme) : process.env.CURRENCY || 'AED'
    const ids = [...new Set(body.items.map(({ productId }) => productId))]
    const products = await db.product.findMany({
      where: { id: { in: ids }, ...(ombrine ? salonCatalog(theme) : {}) },
      include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } },
    })
    if (products.length !== ids.length) throw new HttpError(409, 'A product in your order is no longer available.')
    const byId = new Map(products.map((product) => [product.id, product]))
    const grouped = new Map<string, { product: (typeof products)[number]; size?: string; qty: number; unitPrice: number }>()
    for (const item of body.items) {
      const product = byId.get(item.productId)!
      if (!product.inStock) throw new HttpError(409, `${product.name} is out of stock.`)
      const sizes = ombrine ? productSizes(product) : []
      if (sizes.length ? !item.size || !sizes.includes(item.size) : !!item.size) throw new HttpError(409, `Please review the size for ${product.name}.`)
      const key = JSON.stringify([item.productId, item.size])
      const qty = Math.min(99, (grouped.get(key)?.qty ?? 0) + item.qty)
      grouped.set(key, { product, qty, size: item.size, unitPrice: effectivePrice(product) })
    }
    const lines = [...grouped.values()]
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
        currency,
        total: subtotal,
        paymentMethod: 'stripe',
        notes: body.notes || null,
        items: { create: lines.map((l) => ({ productId: l.product.id, productName: l.product.name, sku: l.product.sku, size: l.size, unitPrice: l.unitPrice, qty: l.qty, subtotal: l.unitPrice * l.qty })) },
      },
    })

    const site = siteUrl()
    const session = await createCheckoutSession({
      items: lines.map((l) => ({
        name: l.product.name,
        description: [l.size ? `Size: ${l.size}` : '', l.product.sku ? `SKU: ${l.product.sku}` : ''].filter(Boolean).join(' · ') || undefined,
        imageUrl: /^https:\/\//.test(l.product.images[0]?.imageUrl ?? '') ? l.product.images[0].imageUrl : undefined,
        unitPrice: l.unitPrice,
        quantity: l.qty,
        productId: l.product.id,
      })),
      currency,
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
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true, currency: true } })
  if (!order) return null
  return { orderNumber: order.orderNumber, total: order.total, currency: order.currency, paid: session.payment_status === 'paid' }
}
