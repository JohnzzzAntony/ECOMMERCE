'use client'

import { useState, type FormEvent } from 'react'
import { api } from '@/frontend/lib/api'
import { useStore } from '@/frontend/store/use-store'
import { effectivePrice } from '@/shared/storefront'
import { productSizes, salonCurrency, salonPrice } from '@/shared/ombrine'
import type { StorefrontTheme } from '@/shared/theme'
import type { Product } from '@/shared/types'
import { SalonDialog } from './ombrine-shell'

export function SizeOptions({ product, value, onChange }: { product: Product; value?: string; onChange: (value: string) => void }) {
  const sizes = productSizes(product)
  if (!sizes.length) return null
  return <fieldset className="om-sizes"><legend>Choose a size</legend><div>
    {sizes.map((size) => <button type="button" key={size} aria-pressed={value === size} onClick={() => onChange(size)}>{size}</button>)}
  </div></fieldset>
}

export function SizeGuide({ theme, onClose }: { theme: StorefrontTheme; onClose: () => void }) {
  return <SalonDialog label="Size guide" kind="notice" onClose={onClose}>
    <div className="om-drawer-heading"><h2>Size guide</h2><button type="button" onClick={onClose}>Close ×</button></div>
    <p className="om-preline">{String(theme.settings.ombrine_size_guide || '')}</p>
  </SalonDialog>
}

export function Notify({ product, size }: { product: Product; size?: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '')
    setState('pending')
    setMessage('')
    try { await api.stockNotification({ productId: product.id, email, size }); setState('saved') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); setState('idle') }
  }
  return state === 'saved' ? <p role="status">Your notification request has been received.</p> :
    <form className="om-notify" onSubmit={submit}><p className="om-muted">Sold out</p><label>Email address <input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <button className="om-primary" type="submit" disabled={state === 'pending'}>{state === 'pending' ? 'Saving…' : 'Notify me'}</button>
      {message && <p role="alert">{message}</p>}</form>
}

export function OmbrineProductPurchase({ product, theme, onAdded }: { product: Product; theme: StorefrontTheme; onAdded?: () => void }) {
  const [size, setSize] = useState('')
  const [error, setError] = useState('')
  const [guide, setGuide] = useState(false)
  const add = useStore((s) => s.addToCart)
  const openBag = useStore((s) => s.setCartDrawerOpen)
  return <div className="om-buy">
    <div className="om-size-layout"><SizeOptions product={product} value={size} onChange={(next) => { setSize(next); setError('') }} />
      {!!productSizes(product).length && <button className="om-link" type="button" onClick={() => setGuide(true)}>Size guide</button>}</div>
    {product.inStock ? <button className="om-primary" type="button" onClick={() => {
      if (productSizes(product).length && !size) { setError('Choose a size.'); return }
      add(product, 1, { channel: 'ombrine', size: size || undefined })
      onAdded?.()
      openBag(true)
    }}>Add to bag <span>{salonPrice(effectivePrice(product), salonCurrency(theme))}</span></button> : <Notify product={product} size={size || undefined} />}
    {error && <p role="alert">{error}</p>}
    <p className="om-muted">{String(theme.settings.ombrine_delivery ?? '')}</p>
    {guide && <SizeGuide theme={theme} onClose={() => setGuide(false)} />}
  </div>
}

export function OmbrineQuickAdd({ product, theme }: { product: Product; theme: StorefrontTheme }) {
  const [open, setOpen] = useState(false)
  return <>
    <button className="om-quick-add" type="button" onClick={() => setOpen(true)} aria-label={`Quick add ${product.name}`}>Quick add</button>
    {open && <SalonDialog label={product.name} kind="notice" onClose={() => setOpen(false)}>
      <div className="om-drawer-heading"><h2>{product.name}</h2><button type="button" onClick={() => setOpen(false)}>Close ×</button></div>
      <OmbrineProductPurchase product={product} theme={theme} onAdded={() => setOpen(false)} />
    </SalonDialog>}
  </>
}
