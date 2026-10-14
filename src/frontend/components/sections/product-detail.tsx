import { Container, SectionShell, settingsOf, type SectionProps } from './shared'
import { ProductPurchase } from './commerce-client'
import { sizedImage } from '@/frontend/lib/image'

export default function ProductDetail({ section, page }: SectionProps) {
  const s = settingsOf<{ galleryPosition: string; showBreadcrumbs: boolean; showSpecs: boolean; showReviews: boolean; buttonLabel: string }>(section)
  if (page.route.kind !== 'product') return <SectionShell section={section}><Container section={section}><p className="opacity-70">Product details appear here on product pages.</p></Container></SectionShell>
  const { product, breadcrumbs } = page.route
  let specs: [string, string][] = []
  try { specs = Object.entries(JSON.parse(product.specifications ?? '{}') as Record<string, string>).filter(([, v]) => v) } catch { specs = [] }
  const images = product.images ?? []
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-6">
        {s.showBreadcrumbs && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap gap-2 text-sm opacity-70">
              {breadcrumbs.map((c) => <li key={c.href} className="after:ml-2 after:content-['/']"><a href={c.href} className="hover:underline">{c.name}</a></li>)}
              <li aria-current="page">{product.name}</li>
            </ol>
          </nav>
        )}
        <div className="grid gap-10 md:grid-cols-2">
          <div className={`grid gap-3 ${s.galleryPosition === 'right' ? 'md:order-2' : ''}`}>
            {images.length === 0 && <div className="aspect-square rounded-[var(--radius-3,12px)] bg-black/5" />}
            {images.slice(0, 5).map((img, i) => (
              <img key={img.id} src={sizedImage(img.imageUrl, i === 0 ? 960 : 480)} srcSet={`${sizedImage(img.imageUrl, 480)} 480w, ${sizedImage(img.imageUrl, 960)} 960w, ${sizedImage(img.imageUrl, 1440)} 1440w`}
                sizes="(min-width: 768px) 50vw, 100vw" alt={img.altText || (i === 0 ? product.name : '')} width={960} height={960}
                loading={i === 0 ? 'eager' : 'lazy'} {...(i === 0 ? { fetchPriority: 'high' as const } : {})} className="aspect-square w-full rounded-[var(--radius-3,12px)] object-cover" />
            ))}
          </div>
          <div className="space-y-5">
            {product.brand && <p className="text-sm font-semibold uppercase tracking-widest opacity-70">{product.brand.name}</p>}
            <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: 'var(--font-heading-1-family, inherit)' }}>{product.name}</h1>
            {s.showReviews && product.ratingCount > 0 && <p className="text-sm opacity-80">★ {product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)</p>}
            <ProductPurchase product={product} label={s.buttonLabel} currency={page.currency} />
            {product.shortDescription && <p className="leading-relaxed opacity-90">{product.shortDescription}</p>}
            {product.description && <div className="whitespace-pre-line leading-relaxed opacity-90">{product.description}</div>}
            {s.showSpecs && specs.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-current/10 pt-4 text-sm">
                {specs.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium">{k}</dt><dd className="opacity-80">{v}</dd></div>)}
              </dl>
            )}
          </div>
        </div>
      </Container>
    </SectionShell>
  )
}
