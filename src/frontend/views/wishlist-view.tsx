'use client'

import { useEffect, useState } from 'react'
import { Heart, ShoppingBag, ArrowRight, ShoppingCart, Loader2, Share2 } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { ProductCard } from '@/frontend/components/product/product-card'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { toast } from 'sonner'
import type { Product } from '@/shared/types'

export function WishlistView() {
  const { wishlist, navigate, addToCart } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      if (wishlist.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const list = await api.productsByIds(wishlist)
        if (!active) return
        setProducts(list)
      } catch {
        if (!active) return
        toast.error('Failed to load wishlist products')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [wishlist])

  const handleMoveAllToCart = () => {
    if (products.length === 0) return
    products.forEach((p) => addToCart(p, 1))
    toast.success(`${products.length} item(s) moved to cart`)
    navigate('cart')
  }

  const handleShareWishlist = async () => {
    if (products.length === 0) return
    // Encode product slugs into a shareable URL hash
    const slugs = products.map((p) => p.slug).join(',')
    const shareUrl = `${window.location.origin}/?wishlist=${encodeURIComponent(slugs)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Wishlist', url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Wishlist link copied to clipboard!')
      }
    } catch {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Wishlist link copied to clipboard!')
      } catch {
        toast.error('Failed to share wishlist')
      }
    }
  }

  // Empty state
  if (!loading && products.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <Heart className="h-12 w-12 text-brand-gold" />
          </div>
          <h1 className="text-3xl font-bold text-brand-ink">Your Wishlist is Empty</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Save your favourite medical equipment here for quick access. Tap the heart icon on any
            product to add it to your wishlist.
          </p>
          <Button
            onClick={() => navigate('products')}
            className="mt-8 bg-brand-teal text-white hover:bg-brand-teal-dark"
            size="lg"
          >
            Browse Products
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
            <Heart className="h-7 w-7 fill-brand-gold text-brand-gold" />
            My Wishlist
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading
              ? 'Loading your saved items...'
              : `${products.length} item${products.length === 1 ? '' : 's'} saved`}
          </p>
        </div>
        {!loading && products.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={handleShareWishlist}
              variant="outline"
              className="border-brand-teal/40 text-brand-teal hover:bg-brand-teal hover:text-white"
              size="lg"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              onClick={handleMoveAllToCart}
              className="bg-brand-teal text-white hover:bg-brand-teal-dark"
              size="lg"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Move All to Cart
            </Button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* CTA */}
      {!loading && products.length > 0 && (
        <Card className="mt-10 border-dashed border-brand-teal/40 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10">
                <ShoppingBag className="h-6 w-6 text-brand-teal" />
              </div>
              <div>
                <p className="font-semibold text-brand-ink">Looking for more?</p>
                <p className="text-sm text-muted-foreground">
                  Explore our full catalogue of premium medical equipment.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('products')}
              variant="outline"
              className="border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
            >
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
