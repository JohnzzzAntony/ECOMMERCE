import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
})

export interface StripeLineItem {
  name: string
  description?: string
  imageUrl?: string
  unitPrice: number // in AED (will convert to fils = * 100)
  quantity: number
  productId?: string
}

/**
 * Create a Stripe Checkout Session for redirect-based payment.
 */
export async function createCheckoutSession({
  items,
  orderId,
  orderNumber,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  items: StripeLineItem[]
  orderId: string
  orderNumber: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const lineItems = items.map((item) => ({
    price_data: {
      currency: 'aed',
      product_data: {
        name: item.name,
        description: item.description,
        images: item.imageUrl ? [item.imageUrl] : [],
        metadata: { productId: item.productId || '' },
      },
      unit_amount: Math.round(item.unitPrice * 100), // AED to fils
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
