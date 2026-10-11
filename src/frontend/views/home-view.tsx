'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Truck, ShieldCheck, Headphones, BadgeCheck,
  ArrowRight, ChevronLeft, ChevronRight,
  Cpu, Award, Globe, LifeBuoy, Zap, Clock, DollarSign, CreditCard,
  Instagram, X, Mail, ArrowUpRight,
} from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { ProductCard } from '@/frontend/components/product/product-card'
import { RecentlyViewed } from '@/frontend/components/product/recently-viewed'
import { CountdownTimer } from '@/frontend/components/product/countdown-timer'
import { StarRating } from '@/frontend/components/product/star-rating'
import { Button } from '@/frontend/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/frontend/components/ui/tabs'
import { Input } from '@/frontend/components/ui/input'
import { formatDate } from '@/frontend/lib/format'
import { useFollowLink, useTheme } from '@/frontend/lib/theme'
import { SafeHtml } from '@/frontend/components/theme/html-content'
import { PageBody, usePage } from '@/frontend/views/page-view'
import { LINK_GRID_TILES, resolveSettings, sectionSchema, type SectionType, type ThemeSection, type ThemeSettings } from '@/shared/theme'
import { SectionFrame } from '@/frontend/components/theme/section-frame'
import type {
  Product, Category, Collection, BlogPost, Testimonial,
  ClientLogo, HeroSlide, GalleryItem,
} from '@/shared/types'

// ---------- small helpers ----------

type SectionSettings = Record<string, string>

function SectionHeading({
  sub,
  title,
  action,
}: {
  sub: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
          {sub}
        </p>
        <h2 className="mt-1.5 text-2xl font-bold text-brand-ink sm:text-3xl md:text-4xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className ?? ''}`} />
}

function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- 1. Hero Slider ----------

function HeroSlider({ slides: mediaSlides, settings }: { slides: HeroSlide[]; settings: ThemeSettings }) {
  const { navigate } = useStore()
  const followLink = useFollowLink()
  const [current, setCurrent] = useState(0)
  const text = (key: string) => (typeof settings[key] === 'string' ? (settings[key] as string) : '')

  // A section image replaces the Media slides with one fixed banner.
  const image = text('image')
  const slides: HeroSlide[] = image
    ? [{ id: 'section-image', imageUrl: image, title: null, subtitle: null, ctaLabel: null, ctaUrl: null, sortOrder: 0, isActive: true }]
    : mediaSlides
  const autoplay = Number(settings.autoplay ?? 5)
  const height = `min(${Number(settings.height) || 560}px, 85vh)`
  const align = settings.content_align === 'center' || settings.content_align === 'right' ? settings.content_align : 'left'
  const shade = Math.max(0, Math.min(100, Number(settings.overlay ?? 85)))
  const ink = (pct: number) => `color-mix(in srgb, var(--brand-ink) ${Math.round(pct)}%, transparent)`
  const overlay = align === 'center'
    ? ink(shade * 0.7)
    : `linear-gradient(to ${align === 'left' ? 'right' : 'left'}, ${ink(shade)}, ${ink(shade * 0.6)}, transparent)`

  useEffect(() => {
    if (slides.length <= 1 || autoplay <= 0) return
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), autoplay * 1000)
    return () => clearInterval(t)
  }, [slides.length, autoplay])

  const go = useCallback(
    (i: number) => setCurrent((i + slides.length) % slides.length),
    [slides.length]
  )

  if (slides.length === 0) {
    return (
      <section className="relative w-full bg-brand-ink" style={{ height }}>
        <Skeleton className="h-full w-full rounded-none" />
      </section>
    )
  }

  const slide = slides[current % slides.length]
  const eyebrow = text('eyebrow') || slide.subtitle
  const title = text('title') || slide.title
  const body = text('text')
  const ctaLabel = text('button_label') || slide.ctaLabel
  const onCta = () => {
    if (text('link') && followLink(text('link'))) return
    // Media slides set ctaUrl to a full URL or a storefront page name such as "offers".
    const link = slide.ctaUrl?.trim().replace(/^\//, '') || 'products'
    if (/^https?:\/\//i.test(slide.ctaUrl || '')) window.location.href = slide.ctaUrl!
    else navigate(link as Parameters<typeof navigate>[0])
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-brand-ink"
      style={{ height }}
      aria-roledescription="carousel"
      aria-label="Featured promotions"
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
          aria-hidden={i !== current}
        >
          <img
            src={s.imageUrl}
            alt={s.title || ''}
            className="h-full w-full object-cover"
            fetchPriority={i === 0 ? 'high' : undefined}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
          <div className="absolute inset-0" style={{ background: overlay }} />
        </div>
      ))}

      <div className={`relative z-10 mx-auto flex h-full max-w-[1600px] items-end px-6 pb-16 sm:px-10 sm:pb-20 ${align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : ''}`}>
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-3xl text-white"
        >
          {eyebrow && (
            <p className="mb-3 text-sm text-white/90">
              {eyebrow}
            </p>
          )}
          {title && (
            <h1 className="text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">
              {title}
            </h1>
          )}
          {body && <p className="mt-4 text-base text-white/85 sm:text-lg">{body}</p>}
          <div className={`mt-6 flex flex-wrap gap-3 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
            {ctaLabel && (
              <button onClick={onCta} className="btn-outline on-image">{ctaLabel}</button>
            )}
            {settings.show_quote_button !== false && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('contact')}
                className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              >
                Get a Quote
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(current - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => go(current + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'w-8 bg-brand-gold' : 'w-2 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ---------- 2. Trust Bar ----------

function TrustBar({ s }: { s: SectionSettings }) {
  const items = [
    { icon: Truck, title: 'Fast Delivery', desc: 'Across UAE & GCC' },
    { icon: ShieldCheck, title: 'Secure Payment', desc: '100% protected' },
    { icon: Headphones, title: '24/7 Support', desc: 'Dedicated help' },
    { icon: BadgeCheck, title: 'ISO Certified', desc: 'Quality assured' },
  ].map((it, i) => ({ ...it, title: s[`item_${i + 1}_title`] || it.title, desc: s[`item_${i + 1}_text`] || it.desc }))
  return (
    <section className="border-b border-border bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4 sm:py-6">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-brand-teal">
              <it.icon size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-ink">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- 3. Shop by Categories ----------

function CategoryCard({ category }: { category: Category }) {
  const { navigate } = useStore()
  return (
    <button
      onClick={() => navigate('products-category', { categorySlug: category.slug })}
      className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-white p-5 text-center transition-all hover:-translate-y-1 hover:border-brand-teal hover:shadow-lg"
    >
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-accent">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl font-bold text-brand-teal">
            {category.name.charAt(0)}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-brand-ink group-hover:text-brand-teal">
        {category.name}
      </h3>
      {category._count && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {category._count.products} products
        </p>
      )}
    </button>
  )
}

function CategoriesSection({ categories, s }: { categories: Category[]; s: SectionSettings }) {
  const { navigate } = useStore()
  const top = categories.filter((c) => !c.parentId).slice(0, 8)
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Shop by Categories'}
          title={s.title || 'Our Categories'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        {top.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {top.map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 4. Featured Products ----------

function FeaturedProducts({ products, s }: { products: Product[]; s: SectionSettings }) {
  const { navigate } = useStore()
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Exclusive Products'}
          title={s.title || 'Our premier healthcare selections'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        {products.length === 0 ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 5. Banner Ad ----------

function BannerAd({ s }: { s: SectionSettings }) {
  const { navigate } = useStore()
  const followLink = useFollowLink()
  return (
    <section className="bg-white pb-4">
      <div className="mx-auto max-w-7xl px-4">
        <button
          onClick={() => { if (!s.link || !followLink(s.link)) navigate('products', { onSale: true }) }}
          className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-r from-brand-teal via-brand-teal-dark to-brand-cyan p-8 text-left text-white sm:p-12"
        >
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-brand-gold/30 blur-2xl" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">
                {s.eyebrow || 'Limited Time Offer'}
              </p>
              <h3 className="mt-2 text-2xl font-bold sm:text-3xl md:text-4xl">
                {s.title || 'Up to 30% OFF Hospital Equipment'}
              </h3>
              <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
                {s.text || 'Premium medical devices at unbeatable prices. Stock up before the offer ends.'}
              </p>
              <div className="mt-4">
                <CountdownTimer variant="light" />
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-teal-dark shadow-sm transition-transform group-hover:scale-105">
              {s.button_label || 'Shop Offers'} <ArrowRight size={16} />
            </span>
          </div>
        </button>
      </div>
    </section>
  )
}

// ---------- 6. Tabbed Collections ----------

const COLLECTION_TAB_LABELS = ['Premium Collections', 'Selected Offers', 'Signature']

function CollectionsSection({ collections, s }: { collections: Collection[]; s: SectionSettings }) {
  const { navigate } = useStore()
  const tabs = collections.slice(0, 3)
  const [activeSlug, setActiveSlug] = useState<string>('')
  const [productsByCol, setProductsByCol] = useState<Record<string, Product[]>>({})

  // Derive effective slug: prefer user-selected if valid, else first tab.
  // Avoids synchronous setState-in-effect for the initial value.
  const effectiveSlug =
    tabs.find((t) => t.slug === activeSlug)?.slug ?? tabs[0]?.slug ?? ''
  // Loading = we have a slug but haven't fetched its data yet.
  const loading = !!effectiveSlug && !(effectiveSlug in productsByCol)

  useEffect(() => {
    if (!effectiveSlug) return
    if (effectiveSlug in productsByCol) return // already cached

    let cancelled = false
    api
      .products({ collection: effectiveSlug, limit: '4' })
      .then((res) => {
        if (cancelled) return
        setProductsByCol((prev) => ({ ...prev, [effectiveSlug]: res.products }))
      })
      .catch(() => {
        if (cancelled) return
        setProductsByCol((prev) => ({ ...prev, [effectiveSlug]: [] }))
      })
    return () => {
      cancelled = true
    }
  }, [effectiveSlug, productsByCol])

  if (tabs.length === 0) return null

  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Curated Collections'}
          title={s.title || 'Shop our collections'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        <Tabs value={effectiveSlug} onValueChange={setActiveSlug} className="w-full">
          <TabsList className="h-auto flex-wrap">
            {tabs.map((c, i) => (
              <TabsTrigger
                key={c.id}
                value={c.slug}
                className="px-4 py-2 text-sm"
              >
                {COLLECTION_TAB_LABELS[i] || c.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((c) => (
            <TabsContent key={c.id} value={c.slug} className="mt-6">
              {loading && !productsByCol[c.slug] ? (
                <ProductGridSkeleton count={4} />
              ) : productsByCol[c.slug]?.length ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {productsByCol[c.slug].map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No products in this collection yet.
                </div>
              )}
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={() => navigate('products-collection', { collectionSlug: c.slug })}
                  className="border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
                >
                  Browse {c.name} <ArrowRight size={16} />
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

// ---------- 7. On Sale Now ----------

function OnSaleSection({ products, s }: { products: Product[]; s: SectionSettings }) {
  const { navigate } = useStore()
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'On Sale Now'}
          title={s.title || 'Limited-time offers'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products', { onSale: true })}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        {/* Countdown banner */}
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-white">
              <Clock size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-brand-ink">Offer ends soon!</p>
              <p className="text-xs text-muted-foreground">Don&apos;t miss out on these deals</p>
            </div>
          </div>
          <CountdownTimer variant="dark" />
        </div>
        {products.length === 0 ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 7b. New Arrivals ----------

function NewArrivalsSection({ products, s }: { products: Product[]; s: SectionSettings }) {
  const { navigate } = useStore()
  if (products.length === 0) return null
  return (
    <section className="bg-gradient-to-b from-secondary to-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Just Landed'}
          title={s.title || 'New Arrivals'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- 7c. Best Sellers ----------

function BestSellersSection({ products, s }: { products: Product[]; s: SectionSettings }) {
  const { navigate } = useStore()
  if (products.length === 0) return null
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Customer Favorites'}
          title={s.title || 'Best Sellers'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('products')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All <ArrowRight size={16} />
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 4).map((p, i) => (
            <div key={p.id} className="relative">
              {/* Rank badge */}
              <span className="absolute -left-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-amber-600 text-xs font-bold text-white shadow-lg">
                #{i + 1}
              </span>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- 8. Feature Grid ----------

function FeatureGrid({ s }: { s: SectionSettings }) {
  const features = [
    { icon: Cpu, label: 'Precision Engineering' },
    { icon: Award, label: 'ISO 9001 Certified' },
    { icon: Globe, label: 'Global Logistics' },
    { icon: LifeBuoy, label: 'Direct Support' },
    { icon: Zap, label: 'Fast Delivery' },
    { icon: Clock, label: '24/7 Tech Support' },
    { icon: DollarSign, label: 'Competitive Pricing' },
    { icon: CreditCard, label: 'Easy Financing' },
  ]
  return (
    <section className="bg-brand-teal py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">
            {s.eyebrow || 'Why Choose Us'}
          </p>
          <h2 className="mt-1.5 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            {s.title || 'Built on trust & precision'}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-3 rounded-xl bg-white/10 p-5 text-center backdrop-blur transition hover:bg-white/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold text-white">
                <f.icon size={22} />
              </div>
              <p className="text-sm font-semibold text-white">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- 9. Testimonials ----------

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-6 shadow-sm">
      <StarRating rating={t.rating} size={16} />
      <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
        &ldquo;{t.content}&rdquo;
      </p>
      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-brand-teal">
          {t.avatarUrl ? (
            <img
              src={t.avatarUrl}
              alt={t.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-bold">{t.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-ink">{t.name}</p>
          {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
        </div>
      </div>
    </div>
  )
}

function TestimonialsSection({ testimonials, s }: { testimonials: Testimonial[]; s: SectionSettings }) {
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading sub={s.eyebrow || 'Testimonials'} title={s.title || 'What our Customers have shared!'} />
        {testimonials.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.slice(0, 6).map((t) => (
              <TestimonialCard key={t.id} t={t} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 10. Trusted Partners / Clients ----------

function ClientsSection({ clients, s }: { clients: ClientLogo[]; s: SectionSettings }) {
  if (clients.length === 0) return null
  const doubled = [...clients, ...clients]
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading sub={s.eyebrow || 'Our Partners'} title={s.title || 'Our Valued Clients'} />
      </div>
      <div className="relative overflow-hidden">
        <div className="flex w-max animate-marquee gap-12 px-4">
          {doubled.map((c, i) => (
            <div
              key={`${c.id}-${i}`}
              className="flex h-20 w-44 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-4"
            >
              {c.logoUrl ? (
                <img
                  src={c.logoUrl}
                  alt={c.name}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-sm font-semibold text-brand-ink">{c.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- 11. Blog ----------

function BlogCard({ post }: { post: BlogPost }) {
  const { navigate } = useStore()
  return (
    <article
      onClick={() => navigate('blog-detail', { slug: post.slug })}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ArrowUpRight size={32} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-brand-teal px-2.5 py-1 text-xs font-semibold text-white">
          {post.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</p>
        <h3 className="mt-2 line-clamp-2 text-base font-semibold text-brand-ink group-hover:text-brand-teal">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
        )}
        <div className="mt-auto pt-4">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal">
            Read More <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  )
}

function BlogSection({ posts, s }: { posts: BlogPost[]; s: SectionSettings }) {
  const { navigate } = useStore()
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub={s.eyebrow || 'Insights & News'}
          title={s.title || 'From Our Blog'}
          action={
            <Button
              variant="ghost"
              onClick={() => navigate('blog')}
              className="text-brand-teal hover:text-brand-teal-dark"
            >
              View All Posts <ArrowRight size={16} />
            </Button>
          }
        />
        {posts.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, 3).map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 12. Newsletter ----------

function NewsletterSection({ s }: { s: SectionSettings }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    try {
      await api.newsletter(email)
      toast.success('Subscribed! Thanks for joining our newsletter.')
      setEmail('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-brand-ink p-8 sm:p-12">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-cyan/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-brand-gold/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="max-w-lg">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold text-white">
                <Mail size={22} />
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                {s.title || 'Stay in the Loop'}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {s.text || 'Get the latest product launches, exclusive offers, and industry insights delivered to your inbox.'}
              </p>
            </div>
            <form
              onSubmit={handleSubscribe}
              className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
            >
              <Input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:border-brand-cyan focus-visible:ring-brand-cyan/40"
              />
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="h-11 bg-brand-gold text-white hover:bg-brand-gold/90"
              >
                {submitting ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- 13. Instagram Feed ----------

function InstagramSection({ gallery, s }: { gallery: GalleryItem[]; s: SectionSettings }) {
  // Use first 6 gallery images, fallback to picsum placeholders
  const images: string[] =
    gallery.length >= 6
      ? gallery.slice(0, 6).map((g) => g.imageUrl)
      : Array.from({ length: 6 }).map(
          (_, i) =>
            gallery[i]?.imageUrl ||
            `https://picsum.photos/seed/jkr-insta-${i}/400/400`
        )

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 text-white">
            <Instagram size={20} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            {s.eyebrow || 'Follow Us'}
          </p>
          <h2 className="text-2xl font-bold text-brand-ink sm:text-3xl">{s.title || '@yourstore'}</h2>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark"
          >
            <Instagram size={16} />
            Follow on Instagram
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {images.map((src, i) => (
            <a
              key={i}
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg bg-secondary"
            >
              <img
                src={src}
                alt={`Instagram post ${i + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-brand-ink/0 opacity-0 transition-all group-hover:bg-brand-ink/50 group-hover:opacity-100">
                <Instagram size={22} className="text-white" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- 14. Gallery with Lightbox ----------

function GallerySection({ gallery, s }: { gallery: GalleryItem[]; s: SectionSettings }) {
  const [active, setActive] = useState<GalleryItem | null>(null)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [active])

  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading sub={s.eyebrow || 'Gallery'} title={s.title || 'Latest Gallery & Updates'} />
        {gallery.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.slice(0, 8).map((g) => (
              <button
                key={g.id}
                onClick={() => setActive(g)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-white"
              >
                <img
                  src={g.imageUrl}
                  alt={g.caption || g.category}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-brand-ink/70 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <div>
                    <span className="rounded bg-brand-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {g.category}
                    </span>
                    {g.caption && (
                      <p className="mt-1 line-clamp-2 text-xs text-white">{g.caption}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
            onClick={() => setActive(null)}
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
          <div
            className="relative max-h-[90vh] max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={active.imageUrl}
              alt={active.caption || active.category}
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
            {(active.caption || active.category) && (
              <div className="mt-3 text-center text-white">
                <span className="rounded bg-brand-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                  {active.category}
                </span>
                {active.caption && (
                  <p className="mt-2 text-sm">{active.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------- Editorial sections (DESIGN.md) ----------

/** Full-width photo with a large serif heading and an outlined button. */
function ImageBanner({ s }: { s: SectionSettings }) {
  const followLink = useFollowLink()
  const align = s.content_align === 'center' || s.content_align === 'right' ? s.content_align : 'left'
  const vertical = s.content_vertical === 'top' ? 'items-start' : s.content_vertical === 'center' ? 'items-center' : 'items-end'
  const shade = Math.max(0, Math.min(90, Number(s.overlay) || 0)) / 100
  return (
    <section className={s.full_width === 'false' ? 'mx-auto max-w-7xl px-4 py-6' : ''}>
      <div className="relative w-full overflow-hidden bg-brand-ink" style={{ height: `min(${Number(s.height) || 640}px, 90vh)` }}>
        {s.image && (
          <picture>
            {s.mobile_image && <source media="(max-width: 639px)" srcSet={s.mobile_image} />}
            <img src={s.image} alt={s.title || ''} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </picture>
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgb(0 0 0 / ${shade}), rgb(0 0 0 / ${shade * 0.4}))` }} />
        <div className={`relative mx-auto flex h-full max-w-[1600px] px-6 py-12 sm:px-10 sm:py-16 ${vertical} ${align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : ''}`}>
          <div className="max-w-3xl text-white">
            {s.eyebrow && <p className="mb-3 text-sm">{s.eyebrow}</p>}
            {s.title && <h2 className="text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">{s.title}</h2>}
            {s.text && <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{s.text}</p>}
            {s.button_label && (
              <button onClick={() => followLink(s.link || 'view:products')} className="btn-outline on-image mt-8">{s.button_label}</button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Large photo beside a heading, short copy and an underlined link. */
function SplitFeature({ s }: { s: SectionSettings }) {
  const followLink = useFollowLink()
  const imageRight = s.image_side === 'right'
  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto grid max-w-[1600px] items-center gap-8 px-4 sm:px-8 md:grid-cols-2 md:gap-16">
        <div className={`overflow-hidden bg-secondary ${imageRight ? 'md:order-2' : ''}`} style={{ aspectRatio: s.image_ratio || '4/5' }}>
          {s.image && <img src={s.image} alt={s.title || ''} className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="max-w-lg">
          {s.eyebrow && <p className="mb-3 text-sm text-muted-foreground">{s.eyebrow}</p>}
          {s.title && <h2 className="text-3xl leading-tight text-brand-ink sm:text-5xl">{s.title}</h2>}
          {s.text && <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-brand-ink/80">{s.text}</p>}
          {s.button_label && <button onClick={() => followLink(s.link || 'view:products')} className="text-link mt-8 text-brand-ink">{s.button_label}</button>}
        </div>
      </div>
    </section>
  )
}

/** Up to LINK_GRID_TILES configured links; falls back to the store categories when none are set. */
function LinkGrid({ s, categories }: { s: SectionSettings; categories: Category[] }) {
  const followLink = useFollowLink()
  const configured = Array.from({ length: LINK_GRID_TILES }, (_, i) => i + 1)
    .map((n) => ({ label: s[`tile_${n}_label`], link: s[`tile_${n}_link`], image: s[`tile_${n}_image`] }))
    .filter((tile) => tile.label)
  const tiles = configured.length
    ? configured
    : categories.map((c) => ({ label: c.name, link: `category:${c.slug}`, image: c.imageUrl ?? '' }))
  if (!tiles.length) return null
  const cols = Math.max(2, Math.min(6, Number(s.columns) || 4))
  const images = s.style === 'tiles'
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
        {s.eyebrow && <p className="mb-2 text-sm text-muted-foreground">{s.eyebrow}</p>}
        {s.title && <h2 className="mb-8 text-3xl text-brand-ink sm:text-4xl">{s.title}</h2>}
        <div
          className={`grid grid-cols-2 lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] ${images ? 'gap-4' : 'gap-x-6 gap-y-3'}`}
          style={{ '--cols': cols } as React.CSSProperties}
        >
          {tiles.map((tile, i) => (
            <button key={`${tile.label}-${i}`} onClick={() => followLink(tile.link)} className="group text-left">
              {images && (
                <div className="mb-3 aspect-[3/4] overflow-hidden bg-secondary">
                  {tile.image && <img src={tile.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />}
                </div>
              )}
              <span className="text-base font-semibold text-brand-ink underline-offset-4 group-hover:underline">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Horizontally scrolling product row with a heading and a text link. */
function ProductSlider({ products, s }: { products: Product[]; s: SectionSettings }) {
  const followLink = useFollowLink()
  if (!products.length) return null
  const perView = Math.max(2, Math.min(6, Number(s.per_view) || 4))
  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            {s.eyebrow && <p className="mb-1 text-sm text-muted-foreground">{s.eyebrow}</p>}
            {s.title && <h2 className="text-3xl text-brand-ink sm:text-4xl">{s.title}</h2>}
          </div>
          {s.link_label && <button onClick={() => followLink(s.link || 'view:products')} className="text-link shrink-0 text-brand-ink">{s.link_label}</button>}
        </div>
        <div className="scroll-row" style={{ '--per-view': perView + 0.3 } as React.CSSProperties}>
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  )
}

// ---------- Main HomeView ----------

export function HomeView() {
  const [data, setData] = useState<{
    slider: HeroSlide[]
    categories: Category[]
    featured: Product[]
    onSale: Product[]
    newArrivals: Product[]
    bestSellers: Product[]
    collections: Collection[]
    testimonials: Testimonial[]
    clients: ClientLogo[]
    blog: BlogPost[]
    gallery: GalleryItem[]
  }>({
    slider: [],
    categories: [],
    featured: [],
    onSale: [],
    newArrivals: [],
    bestSellers: [],
    collections: [],
    testimonials: [],
    clients: [],
    blog: [],
    gallery: [],
  })
  const [loading, setLoading] = useState(true)

  const { sections, settings } = useTheme()
  // Only load what the enabled sections show (an imported template homepage needs none of it).
  const needed = useMemo(() => [...new Set(sections.filter((sec) => sec.enabled).map((sec) => (
    sec.type === 'product_slider' ? String(sec.settings.source || 'new_arrivals') : sec.type
  )))].sort().join(','), [sections])

  useEffect(() => {
    let cancelled = false
    const want = new Set(needed.split(','))
    const has = (...types: SectionType[]) => types.some((t) => want.has(t))
    const none = <T,>(value: T) => Promise.resolve(value)
    const noProducts = { products: [] as Product[] }
    Promise.all([
      has('hero') ? api.slider().catch(() => [] as HeroSlide[]) : none([] as HeroSlide[]),
      has('categories', 'link_grid') ? api.categories().catch(() => [] as Category[]) : none([] as Category[]),
      has('featured') ? api.products({ featured: '1', limit: '8' }).catch(() => noProducts) : none(noProducts),
      has('on_sale') ? api.products({ on_sale: '1', limit: '8' }).catch(() => noProducts) : none(noProducts),
      has('new_arrivals') ? api.products({ sort: 'newest', limit: '10' }).catch(() => noProducts) : none(noProducts),
      has('best_sellers') ? api.products({ sort: 'rating', limit: '10' }).catch(() => noProducts) : none(noProducts),
      has('collections') ? api.collections().catch(() => [] as Collection[]) : none([] as Collection[]),
      has('testimonials') ? api.testimonials().catch(() => [] as Testimonial[]) : none([] as Testimonial[]),
      has('clients') ? api.clients().catch(() => [] as ClientLogo[]) : none([] as ClientLogo[]),
      has('blog') ? api.blog({ limit: 3 }).catch(() => [] as BlogPost[]) : none([] as BlogPost[]),
      has('instagram', 'gallery') ? api.gallery().catch(() => [] as GalleryItem[]) : none([] as GalleryItem[]),
    ])
      .then(([slider, categories, featured, onSale, newArrivals, bestSellers, collections, testimonials, clients, blog, gallery]) => {
        if (cancelled) return
        setData({
          slider,
          categories,
          featured: featured.products,
          onSale: onSale.products,
          newArrivals: newArrivals.products,
          bestSellers: bestSellers.products,
          collections,
          testimonials,
          clients,
          blog,
          gallery,
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [needed])

  const chromeHidden = settings.hide_chrome_on_home === true
  const visible = sections.filter((sec) => sec.enabled)
  // While data loads, one skeleton stands in for all data-driven sections.
  const firstDataSection = visible.findIndex((sec) => DATA_SECTIONS.has(sec.type))

  return (
    <div className="bg-background">
      {visible.map((sec, i) => {
        if (loading && DATA_SECTIONS.has(sec.type)) {
          if (i !== firstDataSection) return null
          return (
            <div key="loading" className="mx-auto max-w-7xl px-4 py-16">
              <Skeleton className="mb-6 h-8 w-1/3" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
              </div>
            </div>
          )
        }
        return <HomeSection key={sec.id} section={sec} data={data} fullHeight={chromeHidden && visible.length === 1} />
      })}
      {!chromeHidden && <RecentlyViewed />}
    </div>
  )
}

// ---------- Theme-driven sections ----------

const DATA_SECTIONS = new Set<SectionType>(['product_slider', 'link_grid', 'categories', 'featured', 'collections', 'new_arrivals', 'best_sellers', 'on_sale', 'testimonials', 'clients', 'blog', 'instagram', 'gallery'])

type HomeData = {
  slider: HeroSlide[]; categories: Category[]; featured: Product[]; onSale: Product[]; newArrivals: Product[]
  bestSellers: Product[]; collections: Collection[]; testimonials: Testimonial[]; clients: ClientLogo[]
  blog: BlogPost[]; gallery: GalleryItem[]
}

function HomeSection({ section, data, fullHeight }: { section: ThemeSection; data: HomeData; fullHeight: boolean }) {
  const settings = useMemo(() => resolveSettings(sectionSchema(section.type), section.settings), [section])
  const content = sectionContent(section.type, settings, data, fullHeight)
  if (!content) return null
  return <SectionFrame section={section} settings={settings}>{content}</SectionFrame>
}

function sectionContent(type: SectionType, settings: ThemeSettings, data: HomeData, fullHeight: boolean) {
  const s: SectionSettings = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v)]))
  switch (type) {
    case 'hero': return <HeroSlider slides={data.slider} settings={settings} />
    case 'trust_bar': return <TrustBar s={s} />
    case 'categories': return <CategoriesSection categories={data.categories} s={s} />
    // Product rows with nothing to show are hidden instead of showing placeholders.
    case 'featured': return data.featured.length ? <FeaturedProducts products={data.featured} s={s} /> : null
    case 'banner': return <BannerAd s={s} />
    case 'collections': return <CollectionsSection collections={data.collections} s={s} />
    case 'new_arrivals': return data.newArrivals.length ? <NewArrivalsSection products={data.newArrivals} s={s} /> : null
    case 'best_sellers': return data.bestSellers.length ? <BestSellersSection products={data.bestSellers} s={s} /> : null
    case 'on_sale': return data.onSale.length ? <OnSaleSection products={data.onSale} s={s} /> : null
    case 'features': return <FeatureGrid s={s} />
    case 'testimonials': return <TestimonialsSection testimonials={data.testimonials} s={s} />
    case 'clients': return <ClientsSection clients={data.clients} s={s} />
    case 'blog': return <BlogSection posts={data.blog} s={s} />
    case 'newsletter': return <NewsletterSection s={s} />
    case 'instagram': return <InstagramSection gallery={data.gallery} s={s} />
    case 'gallery': return <GallerySection gallery={data.gallery} s={s} />
    case 'image_banner': return <ImageBanner s={s} />
    case 'split_feature': return <SplitFeature s={s} />
    case 'link_grid': return <LinkGrid s={s} categories={data.categories} />
    case 'product_slider': {
      const lists = { new_arrivals: data.newArrivals, best_sellers: data.bestSellers, featured: data.featured, on_sale: data.onSale }
      return <ProductSlider s={s} products={lists[s.source as keyof typeof lists] ?? data.newArrivals} />
    }
    case 'rich_text':
      return (
        <section className="bg-background py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            {s.title && <h2 className="mb-6 text-2xl font-bold text-brand-ink sm:text-3xl">{s.title}</h2>}
            <SafeHtml html={s.html ?? ''} />
          </div>
        </section>
      )
    case 'page': return <EmbeddedPage slug={s.page} fullHeight={fullHeight} />
  }
}

function EmbeddedPage({ slug, fullHeight }: { slug?: string; fullHeight: boolean }) {
  const page = usePage(slug)
  if (page === undefined) return <div className="mx-auto max-w-7xl px-4 py-16"><Skeleton className="h-64 w-full" /></div>
  if (!page) return null
  return <PageBody page={page} fullHeight={fullHeight} />
}
