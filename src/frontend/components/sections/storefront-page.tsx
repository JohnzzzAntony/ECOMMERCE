// A Figma-designed storefront page: design tokens as CSS variables, self-hosted fonts, global sections, the page's
// sections and structured data. Server component; each section's code is loaded only when it is used.
import { SECTION_COMPONENTS } from './index'
import { tokensCss, tokenSlug } from '@/shared/design-tokens'
import type { RenderedPage } from '@/shared/storefront'
import type { SectionInstance } from '@/shared/sections/registry'

const FAMILY = /^[A-Za-z0-9 _-]{1,60}$/
const URL_OK = /^https:\/\/[^\s"'()<>]+$/
const RANGE = /^[U+0-9A-Fa-f?, -]{1,2000}$/

export function fontFaceCss(page: Pick<RenderedPage, 'fonts'>) {
  return page.fonts.filter((f) => FAMILY.test(f.family) && URL_OK.test(f.url)).map((f) =>
    `@font-face{font-family:"${f.family}";font-style:${f.style === 'italic' ? 'italic' : 'normal'};font-weight:${Number(f.weight) || 400};font-display:swap;src:url("${f.url}") format("${f.format === 'woff2' ? 'woff2' : f.format === 'woff' ? 'woff' : f.format === 'opentype' ? 'opentype' : 'truetype'}")${f.unicodeRange && RANGE.test(f.unicodeRange) ? `;unicode-range:${f.unicodeRange}` : ''}}`).join('')
}

/** Tokens, fonts and the few base rules sections rely on (grid columns per breakpoint, heading fonts). */
export function baseCss(page: Pick<RenderedPage, 'tokens' | 'fonts'>, scope = '.figma-store') {
  const t = page.tokens
  const heading = (i: number) => t.typography.find((x) => tokenSlug(x.name) === `heading-${i}`) ?? t.typography[i - 1]
  const h = [1, 2, 3].map((i) => heading(i)).map((x, i) => (x ? `${scope} h${i + 1}{font-family:var(--font-${tokenSlug(x.name)}-family);font-size:clamp(${Math.round(x.size * 0.6)}px, ${(x.size / 14.4).toFixed(2)}vw, ${x.size}px);font-weight:var(--font-${tokenSlug(x.name)}-weight);line-height:var(--font-${tokenSlug(x.name)}-line-height)}` : '')).join('')
  return [
    tokensCss(t, scope),
    fontFaceCss(page),
    `${scope}{background:var(--color-background,#fff);color:var(--color-text,#111827)}`,
    `${scope} .s-grid{grid-template-columns:repeat(var(--s-cols,3),minmax(0,1fr))}`,
    `@media (max-width:1199px){${scope} .s-grid{grid-template-columns:repeat(var(--s-cols-t,2),minmax(0,1fr))}}`,
    `@media (max-width:767px){${scope} .s-grid{grid-template-columns:repeat(var(--s-cols-m,var(--s-cols-m-default,1)),minmax(0,1fr))}}`,
    h,
  ].join('')
}

export async function SectionList({ sections, page, firstPriority = false }: { sections: SectionInstance[]; page: RenderedPage; firstPriority?: boolean }) {
  const components = await Promise.all(sections.map((s) => SECTION_COMPONENTS[s.type]().then((m) => m.default)))
  return <>{sections.map((s, i) => { const C = components[i]; return <C key={s.id} section={s} data={page.data[s.id]} page={page} priority={firstPriority && i === 0} /> })}</>
}

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

function structuredData(page: RenderedPage, origin: string) {
  const items: object[] = []
  if (page.page.type === 'HOME') items.push({ '@context': 'https://schema.org', '@type': 'Organization', name: page.store.name, url: origin })
  if (page.route.kind === 'product') {
    const p = page.route.product
    items.push({
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku ?? undefined, description: p.shortDescription ?? p.description ?? undefined,
      image: (p.images ?? []).map((i) => i.imageUrl).slice(0, 5), brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
      offers: { '@type': 'Offer', priceCurrency: page.currency, price: p.onSale && p.salePrice ? p.salePrice : p.regularPrice, availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`, url: `${origin}/products/${encodeURIComponent(p.slug)}` },
      ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
    })
    items.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [...page.route.breadcrumbs, { name: p.name, href: `/products/${encodeURIComponent(p.slug)}` }].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${origin}${c.href}` })) })
  } else if (page.page.type !== 'HOME') {
    const path = page.route.kind === 'collection' ? `/collections/${encodeURIComponent(page.route.collection.slug)}` : page.route.kind === 'cart' ? '/cart' : `/pages/${page.page.slug}`
    items.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: page.page.title, item: `${origin}${path}` }] })
  }
  return items
}

export async function StorefrontPage({ page, origin }: { page: RenderedPage; origin: string }) {
  const firstFont = page.fonts.find((f) => f.format === 'woff2' && URL_OK.test(f.url))
  return (
    <div className="figma-store min-h-screen">
      <style>{baseCss(page)}</style>
      {firstFont && <link rel="preload" href={firstFont.url} as="font" type="font/woff2" crossOrigin="anonymous" />}
      {structuredData(page, origin).map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(d) }} />)}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <SectionList sections={page.globals.announcement} page={page} />
      <SectionList sections={page.globals.header} page={page} />
      <main id="main"><SectionList sections={page.sections} page={page} firstPriority /></main>
      <SectionList sections={page.globals.footer} page={page} />
    </div>
  )
}
