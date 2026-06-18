'use client'

import { useEffect, useState } from 'react'
import { Clock, ArrowRight } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { ProductCard } from './product-card'
import type { Product } from '@/types'

export function RecentlyViewed() {
  const { recentlyViewed, navigate } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (recentlyViewed.length === 0) {
      return
    }
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect -- loading state flip before async fetch */
    setLoading(true)
    api.products({ limit: '200' }).then(({ products: all }) => {
      if (cancelled) return
      const filtered = all.filter((p) => recentlyViewed.includes(p.id))
      filtered.sort((a, b) => recentlyViewed.indexOf(a.id) - recentlyViewed.indexOf(b.id))
      setProducts(filtered)
    }).finally(() => { if (!cancelled) setLoading(false) })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [recentlyViewed])

  if (recentlyViewed.length === 0 || products.length === 0) return null

  return (
    <section className="bg-secondary py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
              <Clock size={14} /> Pick up where you left off
            </span>
            <h2 className="mt-1 text-2xl font-bold text-brand-ink sm:text-3xl">Recently Viewed</h2>
          </div>
          <button onClick={() => navigate('products')} className="flex items-center gap-1 text-sm font-medium text-brand-teal hover:text-brand-teal-dark">
            View All <ArrowRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: Math.min(6, recentlyViewed.length) }).map((_, i) => (
              <div key={i} className="aspect-[3/4] shimmer rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {products.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
