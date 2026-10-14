'use client'

import { useEffect, useState } from 'react'
import { GitCompare, X, ShoppingCart, ArrowRight } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { formatAED, effectivePrice, discountPercent } from '@/frontend/lib/format'
import { StarRating } from '@/frontend/components/product/star-rating'
import { toast } from 'sonner'
import type { Product } from '@/shared/types'

export function CompareView() {
  const { compareList, toggleCompare, navigate, addToCart, clearCompare } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (compareList.length === 0) {
      return
    }
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect -- loading state flip before async fetch */
    setLoading(true)
    api.productsByIds(compareList).then((list) => {
      if (!cancelled) setProducts(list)
    }).finally(() => { if (!cancelled) setLoading(false) })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [compareList])

  // Derive empty state without synchronous setState in effect
  const effectiveProducts = compareList.length === 0 ? [] : products
  const effectiveLoading = compareList.length === 0 ? false : loading

  const specs = (p: Product): Record<string, string> => {
    try { return JSON.parse(p.specifications || '{}') } catch { return {} }
  }

  const allSpecKeys = Array.from(new Set(effectiveProducts.flatMap((p) => Object.keys(specs(p)))))

  const rows: { label: string; render: (p: Product) => React.ReactNode }[] = [
    { label: 'Price', render: (p) => {
      const price = effectivePrice(p)
      return (
        <div>
          {p.onSale && p.salePrice && (
            <div className="text-xs text-muted-foreground line-through">{formatAED(p.regularPrice)}</div>
          )}
          <div className="font-bold text-brand-teal-dark">{formatAED(price)}</div>
          {p.onSale && p.salePrice && (
            <div className="text-xs font-semibold text-brand-gold">{discountPercent(p.regularPrice, p.salePrice)}% OFF</div>
          )}
        </div>
      )
    }},
    { label: 'Brand', render: (p) => p.brand?.name || '—' },
    { label: 'Category', render: (p) => p.category?.name || '—' },
    { label: 'Rating', render: (p) => <StarRating rating={p.ratingAvg} size={14} showNumber count={p.ratingCount} /> },
    { label: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku || '—'}</span> },
    { label: 'Availability', render: (p) => p.inStock ? <span className="font-medium text-emerald-600">In Stock ({p.stockQty})</span> : <span className="font-medium text-red-500">Out of Stock</span> },
    { label: 'Featured', render: (p) => p.isFeatured ? 'Yes' : 'No' },
    ...allSpecKeys.map((k) => ({ label: k, render: (p: Product) => specs(p)[k] || '—' })),
  ]

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-teal to-brand-teal-dark py-10 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <button onClick={() => navigate('home')} className="hover:text-white">Home</button>
            <span>/</span>
            <span>Compare Products</span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <GitCompare size={28} /> Product Comparison
          </h1>
          <p className="mt-1 text-sm text-white/80">Compare up to 4 products side by side to find the best fit.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/20 border-t-brand-teal" />
          </div>
        ) : effectiveProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-20 text-center">
            <GitCompare size={56} className="text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No products to compare</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add products to your comparison list using the compare button on product cards.</p>
            <button onClick={() => navigate('products')} className="mt-5 rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark">
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Comparing <span className="font-semibold text-brand-ink">{effectiveProducts.length}</span> products</p>
              <button onClick={() => { clearCompare(); toast.success('Compare list cleared') }} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-white">
                <X size={14} /> Clear All
              </button>
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="sticky left-0 z-10 w-40 bg-secondary/50 p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specification</th>
                    {effectiveProducts.map((p) => {
                      const img = p.images?.[0]
                      return (
                        <th key={p.id} className="min-w-[220px] p-4 text-left align-top">
                          <div className="group relative">
                            <button onClick={() => toggleCompare(p.id)} className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow hover:bg-red-50 hover:text-red-500" aria-label="Remove">
                              <X size={14} />
                            </button>
                            <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-secondary" onClick={() => navigate('product-detail', { slug: p.slug })}>
                              {img && <img src={img.imageUrl} alt={p.name} className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105" />}
                            </div>
                            <button onClick={() => navigate('product-detail', { slug: p.slug })} className="line-clamp-2 text-left text-sm font-semibold text-brand-ink hover:text-brand-teal">
                              {p.name}
                            </button>
                            {p.onSale && (
                              <span className="mt-1 inline-block rounded bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-white">{discountPercent(p.regularPrice, p.salePrice!)}% OFF</span>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-secondary/30'}>
                      <td className="sticky left-0 z-10 bg-inherit p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</td>
                      {effectiveProducts.map((p) => (
                        <td key={p.id} className="p-4 text-sm text-brand-ink">{row.render(p)}</td>
                      ))}
                    </tr>
                  ))}
                  {/* Action row */}
                  <tr className="border-t-2 border-border bg-secondary/50">
                    <td className="sticky left-0 z-10 bg-secondary/50 p-4 text-xs font-semibold uppercase text-muted-foreground">Actions</td>
                    {effectiveProducts.map((p) => (
                      <td key={p.id} className="p-4">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => { addToCart(p, 1); toast.success('Added to cart') }}
                            disabled={!p.inStock}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-xs font-semibold text-white hover:bg-brand-teal-dark disabled:bg-muted"
                          >
                            <ShoppingCart size={13} /> Add to cart
                          </button>
                          <button
                            onClick={() => navigate('product-detail', { slug: p.slug })}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-white"
                          >
                            View Details <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
