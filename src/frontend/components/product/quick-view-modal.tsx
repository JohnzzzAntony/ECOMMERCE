'use client'

import { ShoppingCart, Heart, GitCompare, Eye, Zap } from 'lucide-react'
import { buyNowHref } from '@/shared/storefront'
import { useStore } from '@/frontend/store/use-store'
import { StarRating } from '@/frontend/components/product/star-rating'
import { formatAED, discountPercent, effectivePrice } from '@/frontend/lib/format'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/frontend/components/ui/dialog'

export function QuickViewModal() {
  const { quickViewProduct, setQuickViewProduct, addToCart, toggleWishlist, isInWishlist, toggleCompare, isInCompare, navigate } = useStore()

  const product = quickViewProduct
  if (!product) return null

  const primaryImage = product.images?.find((i) => i.isPrimary) || product.images?.[0]
  const price = effectivePrice(product)
  const hasDiscount = product.onSale && product.salePrice
  const wished = isInWishlist(product.id)
  const compared = isInCompare(product.id)

  const handleAddToCart = () => {
    addToCart(product, 1)
    toast.success(`${product.name} added to cart`)
    setQuickViewProduct(null)
  }

  const goToDetail = () => {
    setQuickViewProduct(null)
    navigate('product-detail', { slug: product.slug })
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && setQuickViewProduct(null)}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Quick view: {product.name}</DialogTitle>
        <div className="grid md:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-secondary md:aspect-auto">
            {primaryImage && (
              <img src={primaryImage.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            )}
            {hasDiscount && (
              <span className="absolute left-3 top-3 rounded-md bg-brand-gold px-2.5 py-1 text-xs font-bold text-white shadow">
                {discountPercent(product.regularPrice, product.salePrice!)}% OFF
              </span>
            )}
            {!product.inStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <span className="rounded-md bg-gray-800 px-3 py-1 text-xs font-semibold text-white">Out of Stock</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col p-5">
            {product.brand && (
              <button onClick={() => navigate('products-brand', { brandSlug: product.brand!.slug })} className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-cyan hover:underline">
                {product.brand.name}
              </button>
            )}
            <h2 className="text-lg font-bold leading-snug text-brand-ink">{product.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={product.ratingAvg} size={14} />
              <span className="text-xs text-muted-foreground">{product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)</span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">{formatAED(product.regularPrice)}</span>
              )}
              <span className="text-2xl font-bold text-brand-teal-dark">{formatAED(price)}</span>
              {hasDiscount && (
                <span className="rounded bg-brand-gold/10 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                  Save {formatAED(product.regularPrice - product.salePrice!)}
                </span>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{product.shortDescription}</p>
            )}

            {product.sku && (
              <p className="mt-2 text-xs text-muted-foreground">SKU: <span className="font-mono font-medium text-brand-ink">{product.sku}</span></p>
            )}

            {/* Actions */}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-teal py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:bg-muted"
              >
                <ShoppingCart size={16} /> Add to cart
              </button>
              <button
                onClick={() => window.location.assign(buyNowHref(product.slug))}
                disabled={!product.inStock}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-ink py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-ink/90 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <Zap size={16} /> Buy now
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { toggleWishlist(product.id); toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist') }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${wished ? 'border-red-200 bg-red-50 text-red-600' : 'border-border hover:bg-secondary'}`}
                >
                  <Heart size={14} className={wished ? 'fill-red-500 text-red-500' : ''} /> Wishlist
                </button>
                <button
                  onClick={() => { toggleCompare(product.id); toast.success(compared ? 'Removed from compare' : 'Added to compare') }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${compared ? 'border-brand-teal bg-accent text-brand-teal' : 'border-border hover:bg-secondary'}`}
                >
                  <GitCompare size={14} /> Compare
                </button>
                <button
                  onClick={goToDetail}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  <Eye size={14} /> Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
