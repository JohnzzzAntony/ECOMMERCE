'use client'

import { Heart, ShoppingCart, Eye } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { StarRating } from './star-rating'
import { formatAED, discountPercent, effectivePrice } from '@/lib/format'
import { toast } from 'sonner'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  variant?: 'default' | 'compact'
}

export function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const { navigate, addToCart, toggleWishlist, isInWishlist } = useStore()
  const wished = isInWishlist(product.id)
  const primaryImage = product.images?.find((i) => i.isPrimary) || product.images?.[0]
  const price = effectivePrice(product)
  const hasDiscount = product.onSale && product.salePrice

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    addToCart(product, 1)
    toast.success(`${product.name} added to enquiry cart`)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWishlist(product.id)
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const goToDetail = () => navigate('product-detail', { slug: product.slug })

  return (
    <div
      onClick={goToDetail}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {primaryImage ? (
          <img
            src={primaryImage.imageUrl}
            alt={primaryImage.altText || product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          aria-label="Toggle wishlist"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-brand-teal shadow-sm backdrop-blur transition-all hover:bg-white hover:scale-110"
        >
          <Heart size={16} className={cn(wished && 'fill-red-500 text-red-500')} />
        </button>

        {/* Quick view on hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-3 transition-transform duration-300 group-hover:translate-y-0">
          <button
            onClick={(e) => { e.stopPropagation(); goToDetail() }}
            className="w-full rounded-lg bg-white/95 py-2 text-xs font-semibold text-brand-ink transition-colors hover:bg-white"
          >
            Quick View
          </button>
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-md bg-gray-800 px-3 py-1 text-xs font-semibold text-white">
              Out of Stock
            </span>
          </div>
        )}
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

          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-teal py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <ShoppingCart size={14} />
            Add to Enquiry
          </button>
        </div>
      </div>
    </div>
  )
}
