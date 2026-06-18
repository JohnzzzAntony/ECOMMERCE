'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Truck, ShieldCheck, Headphones, BadgeCheck,
  ArrowRight, ChevronLeft, ChevronRight,
  Cpu, Award, Globe, LifeBuoy, Zap, Clock, DollarSign, CreditCard,
  Instagram, X, Mail, ArrowUpRight,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { ProductCard } from '@/components/product/product-card'
import { StarRating } from '@/components/product/star-rating'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'
import type {
  Product, Category, Collection, BlogPost, Testimonial,
  ClientLogo, HeroSlide, GalleryItem,
} from '@/types'

// ---------- small helpers ----------

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

function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const { navigate } = useStore()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [slides.length])

  const go = useCallback(
    (i: number) => setCurrent((i + slides.length) % slides.length),
    [slides.length]
  )

  if (slides.length === 0) {
    return (
      <section className="relative w-full bg-brand-ink" style={{ height: 'min(560px, 70vh)' }}>
        <Skeleton className="h-full w-full rounded-none" />
      </section>
    )
  }

  const slide = slides[current]

  return (
    <section
      className="relative w-full overflow-hidden bg-brand-ink"
      style={{ height: 'min(560px, 70vh)' }}
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
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-ink/85 via-brand-ink/50 to-transparent" />
        </div>
      ))}

      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-xl text-white"
        >
          {slide.subtitle && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-cyan">
              {slide.subtitle}
            </p>
          )}
          {slide.title && (
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {slide.title}
            </h1>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {slide.ctaLabel && (
              <Button
                size="lg"
                onClick={() => navigate('products')}
                className="bg-brand-gold text-white hover:bg-brand-gold/90"
              >
                {slide.ctaLabel}
                <ArrowRight size={16} />
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('contact')}
              className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            >
              Get a Quote
            </Button>
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

function TrustBar() {
  const items = [
    { icon: Truck, title: 'Fast Delivery', desc: 'Across UAE & GCC' },
    { icon: ShieldCheck, title: 'Secure Payment', desc: '100% protected' },
    { icon: Headphones, title: '24/7 Support', desc: 'Dedicated help' },
    { icon: BadgeCheck, title: 'ISO Certified', desc: 'Quality assured' },
  ]
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

function CategoriesSection({ categories }: { categories: Category[] }) {
  const { navigate } = useStore()
  const top = categories.filter((c) => !c.parentId).slice(0, 8)
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub="Shop by Categories"
          title="Our Categories"
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

function FeaturedProducts({ products }: { products: Product[] }) {
  const { navigate } = useStore()
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub="Exclusive Products"
          title="Our premier healthcare selections"
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

function BannerAd() {
  const { navigate } = useStore()
  return (
    <section className="bg-white pb-4">
      <div className="mx-auto max-w-7xl px-4">
        <button
          onClick={() => navigate('products', { onSale: true })}
          className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-r from-brand-teal via-brand-teal-dark to-brand-cyan p-8 text-left text-white sm:p-12"
        >
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-brand-gold/30 blur-2xl" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">
                Limited Time Offer
              </p>
              <h3 className="mt-2 text-2xl font-bold sm:text-3xl md:text-4xl">
                Up to 30% OFF Hospital Equipment
              </h3>
              <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
                Premium medical devices at unbeatable prices. Stock up before the offer ends.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-teal-dark shadow-sm transition-transform group-hover:scale-105">
              Shop Offers <ArrowRight size={16} />
            </span>
          </div>
        </button>
      </div>
    </section>
  )
}

// ---------- 6. Tabbed Collections ----------

const COLLECTION_TAB_LABELS = ['Premium Collections', 'Selected Offers', 'Signature']

function CollectionsSection({ collections }: { collections: Collection[] }) {
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
          sub="Curated Collections"
          title="Shop our collections"
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

function OnSaleSection({ products }: { products: Product[] }) {
  const { navigate } = useStore()
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub="On Sale Now"
          title="Limited-time offers"
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

// ---------- 8. Feature Grid ----------

function FeatureGrid() {
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
            Why Choose Us
          </p>
          <h2 className="mt-1.5 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Built on trust & precision
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

function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading sub="Testimonials" title="What our Customers have shared!" />
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

function ClientsSection({ clients }: { clients: ClientLogo[] }) {
  if (clients.length === 0) return null
  const doubled = [...clients, ...clients]
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading sub="Our Partners" title="Our Valued Clients" />
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

function BlogSection({ posts }: { posts: BlogPost[] }) {
  const { navigate } = useStore()
  return (
    <section className="bg-secondary py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          sub="Insights & News"
          title="From Our Blog"
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

function NewsletterSection() {
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
                Stay in the Loop
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Get the latest product launches, exclusive offers, and industry insights
                delivered to your inbox.
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

function InstagramSection({ gallery }: { gallery: GalleryItem[] }) {
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
            Follow Us
          </p>
          <h2 className="text-2xl font-bold text-brand-ink sm:text-3xl">@jkrinternational</h2>
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

function GallerySection({ gallery }: { gallery: GalleryItem[] }) {
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
        <SectionHeading sub="Gallery" title="Latest Gallery & Updates" />
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

// ---------- Main HomeView ----------

export function HomeView() {
  const [data, setData] = useState<{
    slider: HeroSlide[]
    categories: Category[]
    featured: Product[]
    onSale: Product[]
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
    collections: [],
    testimonials: [],
    clients: [],
    blog: [],
    gallery: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.slider().catch(() => [] as HeroSlide[]),
      api.categories().catch(() => [] as Category[]),
      api.products({ featured: '1', limit: '8' }).catch(() => ({ products: [] as Product[] })),
      api.products({ on_sale: '1', limit: '8' }).catch(() => ({ products: [] as Product[] })),
      api.collections().catch(() => [] as Collection[]),
      api.testimonials().catch(() => [] as Testimonial[]),
      api.clients().catch(() => [] as ClientLogo[]),
      api.blog({ limit: 3 }).catch(() => [] as BlogPost[]),
      api.gallery().catch(() => [] as GalleryItem[]),
    ])
      .then(([slider, categories, featured, onSale, collections, testimonials, clients, blog, gallery]) => {
        if (cancelled) return
        setData({
          slider,
          categories,
          featured: featured.products,
          onSale: onSale.products,
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
  }, [])

  return (
    <div className="bg-background">
      <HeroSlider slides={data.slider} />
      <TrustBar />

      {loading ? (
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Skeleton className="mb-6 h-8 w-1/3" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <CategoriesSection categories={data.categories} />
          <FeaturedProducts products={data.featured} />
          <BannerAd />
          <CollectionsSection collections={data.collections} />
          <OnSaleSection products={data.onSale} />
          <FeatureGrid />
          <TestimonialsSection testimonials={data.testimonials} />
          <ClientsSection clients={data.clients} />
          <BlogSection posts={data.blog} />
          <NewsletterSection />
          <InstagramSection gallery={data.gallery} />
          <GallerySection gallery={data.gallery} />
        </>
      )}
    </div>
  )
}
