import Stripe from 'stripe'

// Must not throw at import: `next build` loads every route module without runtime secrets.
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY not set — card checkout will fail')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_missing_key', {
  typescript: true,
})

export interface StripeLineItem {
  name: string
  description?: string
  imageUrl?: string
  unitPrice: number // Major currency units
  quantity: number
  productId?: string
}

/**
 * Create a Stripe Checkout Session for redirect-based payment.
 */
export async function createCheckoutSession({
  items,
  currency = 'AED',
  orderId,
  orderNumber,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  items: StripeLineItem[]
  currency?: string
  orderId: string
  orderNumber: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const lineItems = items.map((item) => ({
    price_data: {
      currency: currency.toLowerCase(),
      product_data: {
        name: item.name,
        description: item.description,
        images: item.imageUrl ? [item.imageUrl] : [],
        metadata: { productId: item.productId || '' },
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity,
  }))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orderId,
      orderNumber,
    },
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    shipping_address_collection: {
      allowed_countries: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
    },
  }, { apiVersion: '2025-05-28.basil' })

  return { url: session.url!, sessionId: session.id }
}
