'use client'

import { sizedImage } from '@/frontend/lib/image'
import { Heart, ShoppingCart, Eye, GitCompare, Zap } from 'lucide-react'
import { buyNowHref } from '@/shared/storefront'
import { useStore } from '@/frontend/store/use-store'
import { StarRating } from './star-rating'
import { formatAED, discountPercent, effectivePrice } from '@/frontend/lib/format'
import { toast } from 'sonner'
import type { Product } from '@/shared/types'
import { cn } from '@/frontend/lib/utils'

interface ProductCardProps {
  product: Product
  variant?: 'default' | 'compact'
}

export function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const { navigate, addToCart, toggleWishlist, isInWishlist, toggleCompare, isInCompare, setQuickViewProduct, addRecentlyViewed } = useStore()
  const wished = isInWishlist(product.id)
  const compared = isInCompare(product.id)
  const primaryImage = product.images?.find((i) => i.isPrimary) || product.images?.[0]
  const price = effectivePrice(product)
  const hasDiscount = product.onSale && product.salePrice
  // "NEW" badge for products created in the last 30 days
  const isNew = (() => {
    try {
      const created = new Date(product.createdAt).getTime()
      return Date.now() - created < 30 * 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  })()

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    addToCart(product, 1)
    toast.success(`${product.name} added to cart`)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWishlist(product.id)
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleCompare(product.id)
    toast.success(compared ? 'Removed from compare' : 'Added to compare')
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation()
    addRecentlyViewed(product.id)
    setQuickViewProduct(product)
  }

  const goToDetail = () => {
    addRecentlyViewed(product.id)
    navigate('product-detail', { slug: product.slug })
  }

  return (
    <div
      onClick={goToDetail}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-xl hover:shadow-brand-teal/5 hover:-translate-y-1 cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {primaryImage ? (
          <img
            src={sizedImage(primaryImage.imageUrl, 600)}
            alt={primaryImage.altText || product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Eye size={32} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="rounded-md bg-brand-gold px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              {discountPercent(product.regularPrice, product.salePrice!)}% OFF
            </span>
          )}
          {product.isExclusive && (
            <span className="rounded-md bg-brand-teal px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              EXCLUSIVE
            </span>
          )}
          {product.isFeatured && !product.isExclusive && (
            <span className="rounded-md bg-brand-cyan px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              FEATURED
            </span>
          )}
          {isNew && !product.isExclusive && (
            <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              NEW
            </span>
          )}
          {product.inStock && product.stockQty > 0 && product.stockQty <= 5 && (
            <span className="rounded-md bg-orange-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              LOW STOCK
            </span>
          )}
          {!product.inStock && (
            <span className="rounded-md bg-gray-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              OUT OF STOCK
            </span>
          )}
        </div>

        {/* Action buttons (wishlist + compare) */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            onClick={handleWishlist}
            aria-label="Toggle wishlist"
            className="flex h-9 w-9 translate-x-12 items-center justify-center rounded-full bg-white/90 text-brand-teal shadow-sm backdrop-blur transition-all duration-300 hover:bg-white hover:scale-110 group-hover:translate-x-0"
          >
            <Heart size={16} className={cn(wished && 'fill-red-500 text-red-500')} />
          </button>
          <button
            onClick={handleCompare}
            aria-label="Toggle compare"
            className="flex h-9 w-9 translate-x-12 items-center justify-center rounded-full bg-white/90 text-brand-teal shadow-sm backdrop-blur transition-all duration-300 delay-75 hover:bg-white hover:scale-110 group-hover:translate-x-0"
          >
            <GitCompare size={15} className={cn(compared && 'text-brand-teal')} />
          </button>
        </div>

        {/* Quick view on hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 transition-transform duration-300 group-hover:translate-y-0">
          <button
            onClick={handleQuickView}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/95 py-2 text-xs font-semibold text-brand-ink backdrop-blur transition-colors hover:bg-white"
          >
            <Eye size={13} /> Quick View
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {product.brand && (
          <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-brand-cyan">
            {product.brand.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-brand-ink group-hover:text-brand-teal transition-colors">
          {product.name}
        </h3>

        {variant === 'default' && (
          <div className="mt-1.5">
            <StarRating rating={product.ratingAvg} size={12} showNumber count={product.ratingCount} />
          </div>
        )}

        <div className="mt-auto pt-2">
          {hasDiscount && (
            <span className="mr-2 text-xs text-muted-foreground line-through">
              {formatAED(product.regularPrice)}
            </span>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-brand-teal-dark">{formatAED(price)}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-teal py-2 text-xs font-semibold text-white transition-all hover:bg-brand-teal-dark hover:shadow-md hover:shadow-brand-teal/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <ShoppingCart size={14} />
            Add to cart
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); window.location.assign(buyNowHref(product.slug)) }}
            disabled={!product.inStock}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-ink py-2 text-xs font-semibold text-white transition-all hover:bg-brand-ink/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <Zap size={14} />
            Buy now
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
