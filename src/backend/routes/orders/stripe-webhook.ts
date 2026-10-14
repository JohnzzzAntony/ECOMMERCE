import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/backend/integrations/stripe'
import { db } from '@/backend/lib/db'
import { sendOrderConfirmation, sendOrderAdminNotification } from '@/backend/integrations/resend'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing stripe-signature or STRIPE_WEBHOOK_SECRET' }, { status: 400 })
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error(`Webhook Signature verification failed: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const orderId = session.metadata?.orderId

    if (orderId) {
      // Mark paid and keep the addresses collected on the payment page
      const shipping = session.collected_information?.shipping_details ?? session.shipping_details
      const billing = session.customer_details
      const order = await db.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          ...(shipping ? { shippingAddress: JSON.stringify({ name: shipping.name, ...shipping.address }) } : {}),
          ...(billing?.address ? { billingAddress: JSON.stringify({ name: billing.name, ...billing.address }) } : {}),        },
        include: {
          items: true
        }
      })

      console.log(`Order ${order.orderNumber} successfully marked as PAID via Stripe webhook.`)

      // Send confirmation emails
      try {
        await sendOrderConfirmation(order)
        await sendOrderAdminNotification(order)
      } catch (emailErr) {
        console.error('Failed to send order confirmation emails in webhook:', emailErr)
      }
    }
  }

  return NextResponse.json({ received: true })
}

// Next.js API config to disable body parsing is handled automatically in App Router by using request.text()
