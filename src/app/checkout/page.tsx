import { Suspense } from 'react'
import type { Metadata } from 'next'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { CheckoutForm } from '@/frontend/components/checkout/checkout-form'
import { CheckoutShell } from '@/frontend/components/checkout/checkout-shell'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const theme = await storefrontTheme().catch(() => null)
  return (
    <CheckoutShell title="Checkout" theme={theme}>
      <Suspense><CheckoutForm currency={process.env.CURRENCY || 'AED'} /></Suspense>
    </CheckoutShell>
  )
}
