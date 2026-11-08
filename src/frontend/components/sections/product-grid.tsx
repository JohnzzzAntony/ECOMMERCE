import { Container, Heading, SectionShell, grid, settingsOf, type SectionProps } from './shared'
import { AddToCartButton } from './commerce-client'
import { sizedImage } from '@/frontend/lib/image'
import { formatPrice } from '@/shared/storefront'
import { ProductRail } from './product-rail'

export default function ProductGrid({ section, data, page }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; columns: number; showPrice: boolean; showAddToCart: boolean; display?: 'grid' | 'carousel' }>(section)
  const products = data?.products ?? []
  const g = grid(s.columns, 2)
  const nameLevel = s.title ? (s.headingLevel === 'h1' ? 'h2' : 'h3') : 'h2'
  const NameTag = nameLevel as 'h2' | 'h3'
  const items = products.map((p) => (
    <li key={p.id} className="flex flex-col gap-3">
      <a href={`/products/${encodeURIComponent(p.slug)}`} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-3,12px)] bg-black/[0.035] [perspective:900px]">
          {p.image && <img src={sizedImage(p.image.url, 480)} srcSet={`${sizedImage(p.image.url, 320)} 320w, ${sizedImage(p.image.url, 480)} 480w, ${sizedImage(p.image.url, 720)} 720w`} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 32vw, 78vw" alt={p.image.alt} width={480} height={600} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transform-none" />}
          {p.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black shadow-sm">{p.badge}</span>}
        </div>
        <NameTag className="mt-4 line-clamp-2 text-sm font-medium tracking-wide transition-colors group-hover:opacity-70">{p.name}</NameTag>
      </a>
      {s.showPrice && (
        <p className="text-sm font-semibold">
          {formatPrice(p.onSale && p.salePrice ? p.salePrice : p.regularPrice, page.currency)}
          {p.onSale && p.salePrice && p.salePrice < p.regularPrice && <s className="ml-2 font-normal opacity-60">{formatPrice(p.regularPrice, page.currency)}</s>}
        </p>
      )}
      {s.showAddToCart && <div className="mt-auto"><AddToCartButton product={p.product} compact /></div>}
    </li>
  ))
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        {products.length === 0 ? <p className="opacity-70">No products to show.</p> : (
          s.display === 'carousel'
            ? <ProductRail label={s.title || 'Products'}>{items}</ProductRail>
            : <ul className={g.className} style={g.style}>{items}</ul>
        )}
      </Container>
    </SectionShell>
  )
}
