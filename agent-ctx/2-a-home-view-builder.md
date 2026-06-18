# Task 2-a — Home View Builder

**Task ID:** 2-a
**Agent name:** Home View Builder
**Task:** Build the HOME page view component (`HomeView`) at `src/components/views/home-view.tsx` per spec section 4.1.

## File Created

- `/home/z/my-project/src/components/views/home-view.tsx` (1033 lines)
- Named export: `HomeView`
- Directive: `'use client'`

## Sections Built (14 total, per spec 4.1)

1. **HeroSlider** — Full-width carousel (~560px / 70vh), auto-play (5s `setInterval`), arrows + dots, gradient overlay, framer-motion animated content, dual CTA (gold "Shop Now" + outline "Get a Quote"). Data: `api.slider()`.
2. **TrustBar** — 4-column icon grid: Fast Delivery / Secure Payment / 24/7 Support / ISO Certified (lucide: Truck, ShieldCheck, Headphones, BadgeCheck).
3. **CategoriesSection** — "Our Categories" + "Shop by Categories" heading. 4-col / 2-col grid of category cards (circular image + name + count). Click → `navigate('products-category', { categorySlug })`. Top-level only.
4. **FeaturedProducts** — "Our premier healthcare selections" / "Exclusive Products" + "View All →". 4-col ProductCard grid from `api.products({ featured: '1', limit: '8' })`.
5. **BannerAd** — Full-width teal→cyan gradient promo banner. "Up to 30% OFF Hospital Equipment" + Shop Offers CTA. Click → `navigate('products', { onSale: true })`.
6. **CollectionsSection** — Radix Tabs labeled "Premium Collections" / "Selected Offers" / "Signature". Lazy-fetched products per active tab via `api.products({ collection: slug, limit: '4' })`. Uses derived state pattern to avoid `react-hooks/set-state-in-effect` error.
7. **OnSaleSection** — "Limited-time offers" / "On Sale Now" + "View All →". ProductCard grid from `api.products({ on_sale: '1', limit: '8' })`.
8. **FeatureGrid** — Teal-background 4×2 icon grid (Precision Engineering, ISO 9001 Certified, Global Logistics, Direct Support, Fast Delivery, 24/7 Tech Support, Competitive Pricing, Easy Financing) using lucide icons in gold circles.
9. **TestimonialsSection** — "What our Customers have shared!" heading. 3-col grid of testimonial cards (avatar, name, role, StarRating, quote). Data: `api.testimonials()`.
10. **ClientsSection** — "Our Valued Clients" heading. Seamless marquee using `.animate-marquee` CSS with duplicated client logos array. Data: `api.clients()`.
11. **BlogSection** — "From Our Blog" + "View All Posts →". 3-col blog cards (cover, category tag, date, title, excerpt, Read More). Click → `navigate('blog-detail', { slug })`. Data: `api.blog({ limit: 3 })`.
12. **NewsletterSection** — "Stay in the Loop" with email Input + Subscribe button. Calls `api.newsletter(email)`, shows `toast.success`/`toast.error` from sonner. Ink background with glow effects.
13. **InstagramSection** — "@jkrinternational" with gradient Instagram icon + "Follow on Instagram" button. 6-image grid using gallery images or picsum.photos fallbacks.
14. **GallerySection** — "Latest Gallery & Updates" heading. 4-col grid of gallery images with hover caption overlay. Click-to-open lightbox modal with ESC + click-outside to close + body scroll lock. Data: `api.gallery()`.

## Main `HomeView` Orchestration

- Parallel `Promise.all` on mount for: slider, categories, featured products, on-sale products, collections, testimonials, clients, blog, gallery.
- Each fetch has `.catch()` fallback to empty array so a single failure won't break the page.
- Shows initial skeleton while `loading` is true.
- Renders all 14 sections in spec order when data is ready.

## Implementation Decisions

- **Framer Motion** used for hero slide content fade-in (`motion.div` with initial/animate).
- **Skeleton loaders** use the `.shimmer` CSS class.
- **Marquee** uses the `.animate-marquee` CSS class with duplicated logo array for seamless infinite loop.
- **`<img>` tags** — The `@next/next/no-img-element` rule is OFF in `eslint.config.mjs`, so eslint-disable directives are unused (would generate warnings). They were removed to keep lint clean. Plain `<img>` is used throughout with `loading="lazy"`.
- **CollectionsSection state refactor** — Originally used synchronous `setActiveSlug(tabs[0].slug)` and `setLoading(true)` inside `useEffect`, which triggered `react-hooks/set-state-in-effect` error. Refactored to derived-state pattern:
  - `effectiveSlug` computed inline: `tabs.find(t => t.slug === activeSlug)?.slug ?? tabs[0]?.slug ?? ''`
  - `loading` derived from `!(effectiveSlug in productsByCol)` cache lookup
  - All setState calls happen inside async `.then()`/`.catch()` callbacks (allowed by the rule).
- **Responsive design** — Mobile-first throughout: 2-col mobile → 4-col desktop for product grids; 2-col mobile → 3-col for testimonials/blog; `max-w-7xl mx-auto px-4` container; `py-12 sm:py-16` between sections.
- **Section headings** — Consistent small uppercase cyan sub-label above large bold ink heading pattern via reusable `SectionHeading` component.

## Lint Status

- **`src/components/views/home-view.tsx`: 0 errors, 0 warnings** (verified with `npx eslint src/components/views/home-view.tsx`).
- Remaining project-wide lint errors are in OTHER view files (products-view.tsx, store-locations-view.tsx, admin-view.tsx missing, etc.) — out of scope for Task 2-a.

## Dependencies Used (already in project)

- `framer-motion` (hero animation)
- `sonner` (newsletter toast)
- `lucide-react` (icons throughout)
- `@/components/ui/tabs`, `@/components/ui/button`, `@/components/ui/input` (shadcn primitives)
- `@/components/product/product-card`, `@/components/product/star-rating` (shared product components)
- `@/store/use-store` (Zustand navigate)
- `@/lib/api` (API client)
- `@/lib/format` (formatDate)

## Notes for Downstream Agents

- The HomeView depends on API endpoints: `/api/slider`, `/api/categories`, `/api/products`, `/api/collections`, `/api/testimonials`, `/api/clients`, `/api/blog`, `/api/gallery`, `/api/newsletter` (all built in Task 1).
- The HomeView uses `navigate()` with these views: `home` (implicit), `products`, `products-category`, `products-collection`, `product-detail` (via ProductCard), `blog`, `blog-detail`, `contact`. Those view components must exist for navigation to work.
- Dev server (`bun run dev`) shows module-not-found errors for `admin-view`, etc. — those are NOT caused by home-view; they are missing view files being built by other agents in parallel.
