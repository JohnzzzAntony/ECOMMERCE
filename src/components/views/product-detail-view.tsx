'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import {
  Home, ChevronRight, Heart, ShoppingCart, Minus, Plus, Share2, Copy,
  Truck, ShieldCheck, Headphones, MessageCircle, Facebook, Star,
  Check, ChevronLeft, PackageSearch, ThumbsUp, GitCompare, Search,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { StarRating } from '@/components/product/star-rating'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { toast } from 'sonner'
import { formatAED, discountPercent, effectivePrice, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product, ProductReview } from '@/types'

export function ProductDetailView() {
  const { params, navigate, addToCart, toggleWishlist, isInWishlist, setCartDrawerOpen, toggleCompare, isInCompare, addRecentlyViewed } = useStore()
  const slug = String(params.slug ?? '')

  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [activeTab, setActiveTab] = useState('description')

  const reviewsRef = useRef<HTMLDivElement>(null)

  // Fetch product.
  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- loading + reset state must flip before async fetch */
    setLoading(true)
    setNotFound(false)
    setActiveImage(0)
    setQty(1)
    setActiveTab('description')
    /* eslint-enable react-hooks/set-state-in-effect */
    api
      .product(slug)
      .then(({ product, related }) => {
        if (!active) return
        setProduct(product)
        setRelated(related)
        addRecentlyViewed(product.id)
      })
      .catch((err) => {
        if (!active) return
        if (String(err?.message ?? '').includes('not found')) setNotFound(true)
        else setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  const specs = useMemo(() => {
    if (!product?.specifications) return []
    try {
      const parsed = JSON.parse(product.specifications)
      if (Array.isArray(parsed)) {
        return parsed as { label: string; value: string }[]
      }
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed).map(([k, v]) => ({
          label: k,
          value: String(v),
        }))
      }
      return []
    } catch {
      // Fall back to line-based parsing (Key: Value)
      return (product.specifications || '')
        .split(/\r?\n/)
        .map((line) => {
          const idx = line.indexOf(':')
          if (idx === -1) return null
          return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
        })
        .filter((x): x is { label: string; value: string } => !!x && !!x.label)
    }
  }, [product])

  const reviews: ProductReview[] = product?.reviews ?? []
  const ratingAvg = product?.ratingAvg ?? 0
  const ratingCount = product?.ratingCount ?? reviews.length

  // Rating distribution
  const distribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    reviews.forEach((r) => {
      const idx = Math.min(5, Math.max(1, Math.round(r.rating))) - 1
      dist[idx]++
    })
    return dist
  }, [reviews])

  const wished = product ? isInWishlist(product.id) : false
  const compared = product ? isInCompare(product.id) : false

  const handleAddToCart = useCallback(() => {
    if (!product) return
    addToCart(product, qty)
    toast.success(`${qty} × ${product.name} added to enquiry cart`)
    setCartDrawerOpen(true)
  }, [product, qty, addToCart, setCartDrawerOpen])

  const handleWishlist = useCallback(() => {
    if (!product) return
    toggleWishlist(product.id)
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist')
  }, [product, wished, toggleWishlist])

  const handleShare = (channel: 'whatsapp' | 'facebook' | 'copy') => {
    if (!product) return
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?product=${product.slug}`
        : ''
    if (channel === 'whatsapp') {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${product.name} — ${url}`)}`,
        '_blank'
      )
    } else if (channel === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        '_blank'
      )
    } else {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard')
      }
    }
  }

  const goToReviews = () => {
    setActiveTab('reviews')
    setTimeout(() => {
      reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  if (loading) return <ProductDetailSkeleton />
  if (notFound || !product) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <PackageSearch size={36} className="text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-brand-ink">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The product you’re looking for doesn’t exist or has been removed.
        </p>
        <Button
          onClick={() => navigate('products')}
          className="mt-6 bg-brand-teal hover:bg-brand-teal-dark"
        >
          Browse all products
        </Button>
      </div>
    )
  }

  const primaryImage = product.images?.[activeImage] || product.images?.[0]
  const price = effectivePrice(product)
  const hasDiscount = product.onSale && product.salePrice
  const discount = hasDiscount
    ? discountPercent(product.regularPrice, product.salePrice!)
    : 0

  const parentCat = product.category?.parent ?? product.category

  return (
    <div className="bg-brand-bg min-h-screen pb-12">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink
                  asChild
                  className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-brand-teal"
                >
                  <span onClick={() => navigate('home')}>
                    <Home size={12} /> Home
                  </span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {parentCat && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span
                      onClick={() =>
                        navigate('products-category', { categorySlug: parentCat.slug, categoryName: parentCat.name })
                      }
                      className="cursor-pointer text-muted-foreground hover:text-brand-teal"
                    >
                      {parentCat.name}
                    </span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1 max-w-[280px] font-medium text-brand-ink">
                  {product.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Top section: gallery + info */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-white"
              onMouseMove={(e) => {
                const el = e.currentTarget
                const rect = el.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 100
                const y = ((e.clientY - rect.top) / rect.height) * 100
                const img = el.querySelector('img[data-zoom]') as HTMLImageElement | null
                if (img) {
                  img.style.transformOrigin = `${x}% ${y}%`
                }
              }}
            >
              {primaryImage ? (
                <img
                  src={primaryImage.imageUrl}
                  alt={primaryImage.altText || product.name}
                  data-zoom
                  style={{ transform: 'scale(1)' }}
                  className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[2.5] cursor-zoom-in"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <PackageSearch size={48} />
                </div>
              )}

              {/* Zoom hint */}
              {primaryImage && (
                <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <Search size={11} /> Hover to zoom
                </div>
              )}

              {hasDiscount && (
                <span className="absolute left-3 top-3 rounded-md bg-brand-gold px-2.5 py-1 text-xs font-bold text-white shadow">
                  -{discount}% OFF
                </span>
              )}
              {product.isExclusive && (
                <span className="absolute right-3 top-3 rounded-md bg-brand-teal px-2.5 py-1 text-xs font-bold text-white shadow">
                  EXCLUSIVE
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {product.images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-all',
                      idx === activeImage
                        ? 'border-brand-teal ring-2 ring-brand-teal/30'
                        : 'border-border hover:border-brand-teal/60'
                    )}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.altText || `${product.name} ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {product.brand && (
              <button
                onClick={() =>
                  navigate('products-brand', {
                    brandSlug: product.brand!.slug,
                    brandName: product.brand!.name,
                  })
                }
                className="mb-2 inline-flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wider text-brand-cyan hover:underline"
              >
                {product.brand.name}
              </button>
            )}

            <h1 className="text-2xl font-bold leading-tight text-brand-ink md:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={goToReviews}
                className="flex items-center gap-2 hover:opacity-80"
                aria-label="See reviews"
              >
                <StarRating rating={ratingAvg} size={16} />
                <span className="text-sm font-medium text-brand-ink">
                  {ratingAvg.toFixed(1)}
                </span>
              </button>
              <span className="text-sm text-muted-foreground">
                {ratingCount} review{ratingCount === 1 ? '' : 's'}
              </span>
              <span className="text-muted-foreground">•</span>
              {product.inStock ? (
                <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                  <Check size={14} /> In Stock
                </span>
              ) : (
                <span className="text-sm font-medium text-destructive">Out of Stock</span>
              )}
              {product.sku && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    SKU: <span className="font-mono">{product.sku}</span>
                  </span>
                </>
              )}
            </div>

            {/* Price block */}
            <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4">
              <div className="flex flex-col">
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatAED(product.regularPrice)}
                  </span>
                )}
                <span className="text-3xl font-bold text-brand-teal-dark">
                  {formatAED(price)}
                </span>
              </div>
              {hasDiscount && (
                <span className="mb-1 rounded-md bg-brand-gold/15 px-2 py-1 text-xs font-bold text-brand-gold">
                  Save {discount}%
                </span>
              )}
              {hasDiscount && (
                <span className="mb-1 ml-auto text-xs text-muted-foreground">
                  You save {formatAED(product.regularPrice - product.salePrice!)}
                </span>
              )}
            </div>

            {/* Short description */}
            {product.shortDescription && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {product.shortDescription}
              </p>
            )}

            {/* Quantity + actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-border bg-white">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 items-center justify-center text-brand-ink transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  value={qty}
                  min={1}
                  onChange={(e) =>
                    setQty(Math.max(1, parseInt(e.target.value || '1', 10) || 1))
                  }
                  className="h-10 w-14 border-0 bg-transparent text-center text-sm font-semibold text-brand-ink outline-none"
                />
                <button
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 items-center justify-center text-brand-ink transition-colors hover:bg-muted"
                >
                  <Plus size={14} />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                size="lg"
                className="flex-1 bg-brand-teal text-white hover:bg-brand-teal-dark"
              >
                <ShoppingCart size={16} /> Add to Enquiry Cart
              </Button>

              <Button
                onClick={handleWishlist}
                variant="outline"
                size="lg"
                className={cn(
                  'border-brand-teal/40 text-brand-teal hover:bg-brand-teal hover:text-white',
                  wished && 'border-red-400 text-red-500 hover:bg-red-500 hover:text-white'
                )}
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart size={16} className={cn(wished && 'fill-current')} />
              </Button>

              <Button
                onClick={() => { toggleCompare(product.id); toast(compared ? 'Removed from compare' : 'Added to compare') }}
                variant="outline"
                size="lg"
                className={cn(
                  'border-brand-teal/40 text-brand-teal hover:bg-brand-teal hover:text-white',
                  compared && 'border-brand-teal bg-accent text-brand-teal'
                )}
                aria-label={compared ? 'Remove from compare' : 'Add to compare'}
              >
                <GitCompare size={16} />
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-6 grid grid-cols-1 gap-2 rounded-xl border border-border bg-white p-4 sm:grid-cols-3">
              <TrustBadge
                icon={<Truck size={18} />}
                title="Free Delivery"
                subtitle="Orders over AED 2,000"
              />
              <TrustBadge
                icon={<ShieldCheck size={18} />}
                title="Secure Payment"
                subtitle="100% protected"
              />
              <TrustBadge
                icon={<Headphones size={18} />}
                title="24/7 Support"
                subtitle="Always here to help"
              />
            </div>

            {/* Share */}
            <div className="mt-6 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Share2 size={12} /> Share
              </span>
              <button
                onClick={() => handleShare('whatsapp')}
                aria-label="Share on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 text-green-600 transition-colors hover:bg-green-500 hover:text-white"
              >
                <MessageCircle size={16} />
              </button>
              <button
                onClick={() => handleShare('facebook')}
                aria-label="Share on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
              >
                <Facebook size={16} />
              </button>
              <button
                onClick={() => handleShare('copy')}
                aria-label="Copy link"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div ref={reviewsRef} className="mt-10 scroll-mt-24">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto bg-white p-1 shadow-sm">
              <TabsTrigger value="description" className="px-5 py-2">
                Description
              </TabsTrigger>
              <TabsTrigger value="specifications" className="px-5 py-2">
                Specifications
                {specs.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({specs.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="px-5 py-2">
                Reviews
                {ratingCount > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({ratingCount})</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Description */}
            <TabsContent value="description">
              <div className="rounded-xl border border-border bg-white p-6">
                <RichTextDescription text={product.description || product.shortDescription || ''} />
              </div>
            </TabsContent>

            {/* Specifications */}
            <TabsContent value="specifications">
              <div className="rounded-xl border border-border bg-white p-6">
                {specs.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <tbody>
                        {specs.map((s, i) => (
                          <tr
                            key={i}
                            className={cn(i % 2 === 0 ? 'bg-white' : 'bg-brand-bg/50')}
                          >
                            <th
                              scope="row"
                              className="w-1/3 px-4 py-3 text-left font-semibold text-brand-ink"
                            >
                              {s.label}
                            </th>
                            <td className="px-4 py-3 text-muted-foreground">{s.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No specifications available for this product.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Reviews */}
            <TabsContent value="reviews">
              <ReviewsPanel
                reviews={reviews}
                ratingAvg={ratingAvg}
                ratingCount={ratingCount}
                distribution={distribution}
                productId={product.id}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-brand-ink">You may also like</h2>
              <button
                onClick={() => navigate('products')}
                className="text-sm font-medium text-brand-teal hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {related.map((p) => (
                <div key={p.id} className="w-[220px] shrink-0 sm:w-[260px]">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------- subcomponents -------------------- */

function TrustBadge({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-semibold text-brand-ink">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  )
}

function RichTextDescription({ text }: { text: string }) {
  // Lightweight markdown-ish renderer: ## headings, blank-line paragraphs, - bullet lists.
  const blocks = useMemo(() => {
    const lines = text.split(/\r?\n/)
    const out: { type: 'h2' | 'p' | 'li'; content: string }[] = []
    let para: string[] = []
    const flush = () => {
      if (para.length > 0) {
        out.push({ type: 'p', content: para.join(' ') })
        para = []
      }
    }
    for (const raw of lines) {
      const line = raw.trim()
      if (line.startsWith('## ')) {
        flush()
        out.push({ type: 'h2', content: line.slice(3).trim() })
      } else if (line.startsWith('# ')) {
        flush()
        out.push({ type: 'h2', content: line.slice(2).trim() })
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        flush()
        out.push({ type: 'li', content: line.slice(2).trim() })
      } else if (line === '') {
        flush()
      } else {
        para.push(line)
      }
    }
    flush()
    return out
  }, [text])

  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">No description available.</p>
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((b, i) => {
        if (b.type === 'h2')
          return (
            <h3 key={i} className="mt-4 text-lg font-bold text-brand-ink">
              {b.content}
            </h3>
          )
        if (b.type === 'li')
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
              <span>{b.content}</span>
            </div>
          )
        return <p key={i}>{b.content}</p>
      })}
    </div>
  )
}

function ReviewsPanel({
  reviews,
  ratingAvg,
  ratingCount,
  distribution,
  productId,
}: {
  reviews: ProductReview[]
  ratingAvg: number
  ratingCount: number
  distribution: number[]
  productId: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authorName.trim() || !reviewText.trim()) {
      toast.error('Please fill in your name and review text.')
      return
    }
    setSubmitting(true)
    try {
      await api.review({
        productId,
        authorName: authorName.trim(),
        rating,
        reviewText: reviewText.trim(),
      })
      toast.success('Thanks! Your review has been submitted and is pending approval.')
      setAuthorName('')
      setReviewText('')
      setRating(5)
      setShowForm(false)
    } catch (err: any) {
      toast.error(err?.message || 'Could not submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Summary */}
        <div>
          <div className="rounded-xl bg-brand-bg p-5 text-center">
            <div className="text-4xl font-bold text-brand-ink">
              {ratingAvg.toFixed(1)}
            </div>
            <StarRating rating={ratingAvg} size={18} className="mt-2 justify-center" />
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {ratingCount} review{ratingCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1]
              const pct = ratingCount > 0 ? (count / ratingCount) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="flex w-8 items-center gap-0.5 text-muted-foreground">
                    {star} <Star size={10} className="fill-amber-400 text-amber-400" />
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{count}</span>
                </div>
              )
            })}
          </div>

          <Button
            onClick={() => setShowForm((s) => !s)}
            variant="outline"
            className="mt-5 w-full border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
          >
            Write a Review
          </Button>
        </div>

        {/* Review list + form */}
        <div>
          {showForm && (
            <form
              onSubmit={submit}
              className="mb-6 rounded-xl border border-brand-teal/30 bg-brand-bg/40 p-4"
            >
              <h4 className="mb-3 text-sm font-bold text-brand-ink">
                Share your experience
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Your name *
                  </label>
                  <Input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Your rating *
                  </label>
                  <div className="flex items-center gap-1 pt-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`${s} star${s > 1 ? 's' : ''}`}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          size={22}
                          className={cn(
                            (hoverRating || rating) >= s
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-gray-200 text-gray-200'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Your review *
                </label>
                <Textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell us what you think about this product…"
                  rows={4}
                  required
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-teal hover:bg-brand-teal-dark"
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </Button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
              <ThumbsUp size={28} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-brand-ink">No reviews yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Be the first to share your feedback.
              </p>
            </div>
          ) : (
            <div className="max-h-[520px] space-y-4 overflow-y-auto pr-2 scrollbar-thin">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-border bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={r.authorName} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-brand-ink">
                        {r.authorName}
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.rating} size={12} />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.reviewText && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {r.reviewText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const colors = [
    'bg-brand-teal text-white',
    'bg-brand-cyan text-white',
    'bg-brand-gold text-white',
    'bg-brand-ink text-white',
  ]
  const idx =
    name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        colors[idx]
      )}
    >
      {initials || '?'}
    </div>
  )
}

function ProductDetailSkeleton() {
  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-20 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-12 w-48 rounded-lg" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
