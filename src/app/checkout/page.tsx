import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CheckoutForm } from '@/frontend/components/checkout/checkout-form'
import { CheckoutShell } from '@/frontend/components/checkout/checkout-shell'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }

export default function CheckoutPage() {
  return (
    <CheckoutShell title="Checkout">
      <Suspense><CheckoutForm currency={process.env.CURRENCY || 'AED'} /></Suspense>
    </CheckoutShell>
  )
}
