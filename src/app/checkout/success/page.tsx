import type { Metadata } from 'next'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { CheckCircle2, Clock } from 'lucide-react'
import { checkoutResult } from '@/backend/routes/orders/checkout'
import { CheckoutShell, ClearCartAfterPayment } from '@/frontend/components/checkout/checkout-shell'
import { formatPrice } from '@/shared/storefront'

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams
  const [result, theme] = await Promise.all([session_id ? checkoutResult(session_id) : null, storefrontTheme().catch(() => null)])
  return (
    <CheckoutShell theme={theme} title={result?.paid ? 'Thank you for your order' : 'Order received'}>
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        {result?.paid && <ClearCartAfterPayment />}
        {result?.paid ? <CheckCircle2 className="mx-auto size-14 text-brand-teal" aria-hidden /> : <Clock className="mx-auto size-14 text-muted-foreground" aria-hidden />}
        {result ? (
          <>
            <p className="text-lg text-brand-ink">Order <strong>{result.orderNumber}</strong> · {formatPrice(result.total, process.env.CURRENCY || 'AED')}</p>
            <p className="text-muted-foreground">{result.paid ? 'Payment received. A confirmation email is on its way.' : 'We are confirming your payment. You will get an email once it is complete.'}</p>
          </>
        ) : <p className="text-muted-foreground">We could not find this payment. If you were charged, please contact us with your email address.</p>}
        <a href="/" className="inline-flex min-h-11 items-center rounded-lg bg-brand-teal px-6 font-semibold text-white hover:bg-brand-teal-dark">Continue shopping</a>
      </div>
    </CheckoutShell>
  )
}
