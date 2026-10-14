import { Container, Heading, SectionShell, grid, settingsOf, type SectionProps } from './shared'
import { AddToCartButton } from './commerce-client'
import { sizedImage } from '@/frontend/lib/image'
import { formatPrice } from '@/shared/storefront'

export default function ProductGrid({ section, data, page }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; columns: number; showPrice: boolean; showAddToCart: boolean }>(section)
  const products = data?.products ?? []
  const g = grid(s.columns, 2)
  const nameLevel = s.title ? (s.headingLevel === 'h1' ? 'h2' : 'h3') : 'h2'
  const NameTag = nameLevel as 'h2' | 'h3'
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        {products.length === 0 ? <p className="opacity-70">No products to show.</p> : (
          <ul className={g.className} style={g.style}>
            {products.map((p) => (
              <li key={p.id} className="flex flex-col gap-3">
                <a href={`/products/${encodeURIComponent(p.slug)}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-[var(--radius-3,12px)] bg-black/5">
                    {p.image && <img src={sizedImage(p.image.url, 480)} srcSet={`${sizedImage(p.image.url, 320)} 320w, ${sizedImage(p.image.url, 480)} 480w, ${sizedImage(p.image.url, 720)} 720w`} sizes="(min-width: 1024px) 25vw, 50vw" alt={p.image.alt} width={480} height={480} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                    {p.badge && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-black">{p.badge}</span>}
                  </div>
                  <NameTag className="mt-3 line-clamp-2 text-sm font-medium group-hover:underline">{p.name}</NameTag>
                </a>
                {s.showPrice && (
                  <p className="text-sm font-semibold">
                    {formatPrice(p.onSale && p.salePrice ? p.salePrice : p.regularPrice, page.currency)}
                    {p.onSale && p.salePrice && p.salePrice < p.regularPrice && <s className="ml-2 font-normal opacity-60">{formatPrice(p.regularPrice, page.currency)}</s>}
                  </p>
                )}
                {s.showAddToCart && <div className="mt-auto"><AddToCartButton product={p.product} compact /></div>}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </SectionShell>
  )
}
