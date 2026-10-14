'use client'
// Checkout page: one product ("Buy now", ?product=<slug>&qty=n) or the whole cart. Collects contact details, then
// hands over to Stripe's hosted payment page; the server re-prices every line from the catalogue.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, Minus, Plus } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { sizedImage } from '@/frontend/lib/image'
import { effectivePrice, formatPrice } from '@/shared/storefront'
import type { Product } from '@/shared/types'

/** sessionStorage flag: the payment started from the cart, so the success page empties it. */
export const FROM_CART_KEY = 'checkout-from-cart'

type Line = { product: Product; qty: number }

export function CheckoutForm({ currency }: { currency: string }) {
  const search = useSearchParams()
  const slug = search.get('product')
  const cancelled = search.get('cancelled') === '1'
  const cart = useStore((s) => s.cart)
  const user = useStore((s) => s.user)
  const [mounted, setMounted] = useState(false)
  const [buyNow, setBuyNow] = useState<Line | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', notes: '' })
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  // The cart lives in localStorage, so it is only known after hydration.
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, customerName: f.customerName || [user.firstName, user.lastName].filter(Boolean).join(' '), email: f.email || user.email, phone: f.phone || user.phone || '' }))
  }, [user])
  useEffect(() => {
    if (!slug) return
    const qty = Math.min(99, Math.max(1, Number(search.get('qty')) || 1))
    api.product(slug).then(({ product }) => setBuyNow({ product, qty })).catch(() => setLoadError('This product could not be found.'))
  }, [slug, search])

  const lines: Line[] = slug ? (buyNow ? [buyNow] : []) : cart.map((i) => ({ product: i.product, qty: i.quantity }))
  const total = lines.reduce((n, l) => n + effectivePrice(l.product) * l.qty, 0)

  const pay = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPaying(true)
    try {
      const { url } = await api.checkout({
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        customerName: form.customerName, email: form.email, phone: form.phone, notes: form.notes,
        returnPath: slug ? `/checkout?product=${encodeURIComponent(slug)}&qty=${buyNow?.qty ?? 1}` : '/checkout',
      })
      if (slug) sessionStorage.removeItem(FROM_CART_KEY)
      else sessionStorage.setItem(FROM_CART_KEY, '1')
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be started. Please try again.')
      setPaying(false)
    }
  }

  if (!mounted || (slug && !buyNow && !loadError)) return <p className="py-16 text-center text-muted-foreground">Loading checkout…</p>
  if (loadError) return <Empty message={loadError} />
  if (!lines.length) return <Empty message="Your cart is empty." />

  const outOfStock = lines.find((l) => !l.product.inStock)
  const field = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <section aria-labelledby="summary-heading" className="order-last space-y-4 rounded-2xl border border-border bg-muted/30 p-6 lg:order-first">
        <h2 id="summary-heading" className="text-lg font-semibold text-brand-ink">Order summary</h2>
        <ul className="divide-y divide-border">
          {lines.map((l) => (
            <li key={l.product.id} className="flex items-center gap-4 py-4">
              {l.product.images?.[0] && <img src={sizedImage(l.product.images[0].imageUrl, 160)} alt="" width={64} height={64} className="size-16 rounded-lg border border-border object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-ink">{l.product.name}</p>
                {slug ? (
                  <div className="mt-2 inline-flex items-center rounded-lg border border-border bg-white" role="group" aria-label="Quantity">
                    <button type="button" className="inline-flex size-9 items-center justify-center disabled:opacity-40" disabled={l.qty <= 1} onClick={() => setBuyNow({ ...l, qty: l.qty - 1 })} aria-label="Decrease quantity"><Minus className="size-3.5" aria-hidden /></button>
                    <output className="w-8 text-center text-sm" aria-live="polite">{l.qty}</output>
                    <button type="button" className="inline-flex size-9 items-center justify-center disabled:opacity-40" disabled={l.qty >= 99} onClick={() => setBuyNow({ ...l, qty: l.qty + 1 })} aria-label="Increase quantity"><Plus className="size-3.5" aria-hidden /></button>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Qty {l.qty}</p>}
              </div>
              <p className="font-semibold text-brand-ink">{formatPrice(effectivePrice(l.product) * l.qty, currency)}</p>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-border pt-4 text-sm">
          <p className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Address on next step</span></p>
          <p className="flex justify-between text-lg font-semibold text-brand-ink"><span>Total</span><span>{formatPrice(total, currency)}</span></p>
        </div>
      </section>

      <form onSubmit={pay} className="space-y-4" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg font-semibold text-brand-ink">Contact details</h2>
        {cancelled && <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Payment was cancelled. You have not been charged.</p>}
        {([['customerName', 'Full name', 'text', 'name', true], ['email', 'Email', 'email', 'email', true], ['phone', 'Phone', 'tel', 'tel', true]] as const).map(([key, label, type, auto, required]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium text-brand-ink">{label}{required && <span aria-hidden> *</span>}</span>
            <input type={type} required={required} autoComplete={auto} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={field} />
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-ink">Order notes</span>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${field} h-auto py-2`} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {outOfStock && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{outOfStock.product.name} is out of stock.</p>}
        <button type="submit" disabled={paying || !!outOfStock} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-teal px-6 font-semibold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60">
          <Lock className="size-4" aria-hidden /> {paying ? 'Redirecting to payment…' : `Pay ${formatPrice(total, currency)}`}
        </button>
        <p className="text-center text-xs text-muted-foreground">Card payment and delivery address are collected securely by Stripe.</p>
      </form>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="space-y-4 py-16 text-center">
      <p className="text-muted-foreground">{message}</p>
      <a href="/" className="inline-flex min-h-11 items-center rounded-lg bg-brand-teal px-6 font-semibold text-white hover:bg-brand-teal-dark">Continue shopping</a>
    </div>
  )
}
