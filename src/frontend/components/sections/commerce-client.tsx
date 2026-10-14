'use client'
// Client pieces of commerce sections: add to cart, quantity picker and the cart page. Uses the store's existing
// cart (Zustand, persisted) and enquiry checkout, so carts are shared with the rest of the storefront.
import { useEffect, useState } from 'react'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { effectivePrice } from '@/frontend/lib/format'
import { sizedImage } from '@/frontend/lib/image'
import { formatPrice } from '@/shared/storefront'
import type { Product } from '@/shared/types'

const primary = { background: 'var(--color-primary, #0D6B8C)', color: 'var(--color-on-primary, #fff)' }

export function AddToCartButton({ product, label = 'Add to cart', compact = false }: { product: Product; label?: string; compact?: boolean }) {
  const addToCart = useStore((s) => s.addToCart)
  if (!product.inStock) return <span className="text-sm opacity-60">Out of stock</span>
  return (
    <button type="button" onClick={() => { addToCart(product, 1); toast.success(`${product.name} added to cart`) }} style={primary}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-2,8px)] px-4 text-sm font-semibold hover:opacity-90 ${compact ? 'w-full' : ''}`}>
      <ShoppingBag className="size-4" aria-hidden /> {label}
    </button>
  )
}

export function ProductPurchase({ product, label, currency }: { product: Product; label: string; currency: string }) {
  const [qty, setQty] = useState(1)
  const addToCart = useStore((s) => s.addToCart)
  const price = effectivePrice(product)
  return (
    <div className="space-y-4">
      <p className="text-2xl font-bold">
        {formatPrice(price, currency)}
        {product.onSale && product.salePrice && product.salePrice < product.regularPrice && <s className="ml-3 text-base font-normal opacity-60">{formatPrice(product.regularPrice, currency)}</s>}
      </p>
      {product.inStock ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-[var(--radius-2,8px)] border border-current/20" role="group" aria-label="Quantity">
            <button type="button" className="inline-flex size-11 items-center justify-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="size-4" aria-hidden /></button>
            <output className="w-10 text-center" aria-live="polite">{qty}</output>
            <button type="button" className="inline-flex size-11 items-center justify-center" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase quantity"><Plus className="size-4" aria-hidden /></button>
          </div>
          <button type="button" style={primary} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-2,8px)] px-6 font-semibold hover:opacity-90"
            onClick={() => { addToCart(product, qty); toast.success(`${product.name} added to cart`) }}>
            <ShoppingBag className="size-4" aria-hidden /> {label}
          </button>
        </div>
      ) : <p className="font-medium opacity-70">Out of stock</p>}
    </div>
  )
}

export function CartContents({ emptyMessage, checkoutLabel, currency }: { emptyMessage: string; checkoutLabel: string; currency: string }) {
  const { cart, updateCartQty, removeFromCart, clearCart } = useStore()
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', company: '', message: '' })
  const [sending, setSending] = useState(false)
  // The cart is persisted in localStorage, so it is only known after hydration.
  useEffect(() => setMounted(true), [])
  if (!mounted) return <p className="opacity-60">Loading cart…</p>
  if (!cart.length) return <div className="space-y-4"><p>{emptyMessage}</p><a href="/" className="underline">Continue shopping</a></div>
  const total = cart.reduce((n, i) => n + effectivePrice(i.product) * i.quantity, 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.enquiry({
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])),
        items: cart.map((i) => ({ productId: i.productId, productName: i.product.name, sku: i.product.sku || '', price: effectivePrice(i.product), qty: i.quantity })),
      })
      clearCart()
      toast.success('Order request sent. Our team will contact you shortly.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your request. Please try again.')
    } finally { setSending(false) }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <ul className="divide-y divide-current/10" aria-label="Cart items">
        {cart.map((i) => (
          <li key={i.productId} className="flex gap-4 py-4">
            {i.product.images?.[0] && <img src={sizedImage(i.product.images[0].imageUrl, 160)} alt="" width={80} height={80} className="size-20 rounded-md object-cover" />}
            <div className="flex-1">
              <a href={`/products/${encodeURIComponent(i.product.slug)}`} className="font-medium hover:underline">{i.product.name}</a>
              <p className="text-sm opacity-70">{formatPrice(effectivePrice(i.product), currency)}</p>
              <div className="mt-2 flex items-center gap-2">
                <label className="sr-only" htmlFor={`qty-${i.productId}`}>Quantity for {i.product.name}</label>
                <input id={`qty-${i.productId}`} type="number" min={1} max={99} value={i.quantity} onChange={(e) => updateCartQty(i.productId, Math.max(1, Math.min(99, Number(e.target.value) || 1)))} className="h-11 w-20 rounded-md border border-current/20 bg-transparent px-2" />
                <button type="button" onClick={() => removeFromCart(i.productId)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-black/5" aria-label={`Remove ${i.product.name}`}><Trash2 className="size-4" aria-hidden /></button>
              </div>
            </div>
            <p className="font-semibold">{formatPrice(effectivePrice(i.product) * i.quantity, currency)}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-3,12px)] border border-current/10 p-5">
        <p className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatPrice(total, currency)}</span></p>
        {([['customerName', 'Name', 'text', true], ['email', 'Email', 'email', true], ['phone', 'Phone', 'tel', true], ['company', 'Company', 'text', false]] as const).map(([key, label, type, required]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium">{label}{required && ' *'}</span>
            <input type={type} required={required} autoComplete={key === 'customerName' ? 'name' : key === 'company' ? 'organization' : key === 'phone' ? 'tel' : 'email'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-11 w-full rounded-md border border-current/20 bg-transparent px-3" />
          </label>
        ))}
        <label className="block text-sm"><span className="mb-1 block font-medium">Notes</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="w-full rounded-md border border-current/20 bg-transparent px-3 py-2" /></label>
        <button type="submit" disabled={sending} style={primary} className="min-h-11 w-full rounded-[var(--radius-2,8px)] font-semibold hover:opacity-90 disabled:opacity-60">{sending ? 'Sending…' : checkoutLabel}</button>
      </form>
    </div>
  )
}
