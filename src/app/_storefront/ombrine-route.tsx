import Link from 'next/link'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/backend/lib/db'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { salonCategories, salonLooks, salonProduct, salonProducts } from '@/backend/lib/ombrine'
import { collectionForRoute } from '@/backend/lib/storefront'
import { BagContents, OmbrineShell } from '@/frontend/components/theme/ombrine-shell'
import { OmbrineProductPurchase, OmbrineQuickAdd } from '@/frontend/components/theme/ombrine-purchase'
import { SafeHtml } from '@/frontend/components/theme/html-content'
import { isOmbrine, SALON_SORTS, salonCurrency, salonPrice } from '@/shared/ombrine'
import { effectivePrice } from '@/shared/storefront'
import type { StorefrontTheme } from '@/shared/theme'
import type { StoreRoute } from './store-route'

export const loadOmbrineTheme = cache(async () => {
  const theme = await storefrontTheme().catch(() => null)
  return isOmbrine(theme) ? theme : null
})

export const ombrineContentPage = cache(async (slug: string, themeId: string) => db.page.findFirst({
  where: { slug, isPublished: true, OR: [{ themeId }, { themeId: null }], layout: 'standard' },
  select: { title: true, content: true, metaTitle: true, metaDescription: true },
}))

export function OmbrineIndexHeading({ title, summary, theme }: { title: string; summary: string; theme: StorefrontTheme }) {
  return <header className="om-index-heading">
    <h1>{title}</h1>
    <div><em>{String(theme.settings.ombrine_season || '')}</em><p>{summary}</p></div>
  </header>
}

export async function OmbrineRoute({ route, theme }: { route: StoreRoute; theme: StorefrontTheme }) {
  if (route.kind === 'cart') return <OmbrineShell theme={theme}><section className="om-cart" aria-label="Your bag"><BagContents theme={theme} /></section></OmbrineShell>

  if (route.kind === 'product') {
    const product = await salonProduct(theme, route.slug)
    if (!product) notFound()
    return <OmbrineShell theme={theme}>
      <article className="om-content om-product-layout">
        <div>{product.images.map((image, i) => <div className="om-product-image" key={image.id}><img src={image.imageUrl} alt={image.altText || product.name} loading={i ? 'lazy' : 'eager'} /></div>)}</div>
        <div>
          <Link href="/collection" className="om-link">← Collection</Link>
          <h1>{product.name}</h1>
          {product.brand && <p className="om-muted">{product.brand.name}</p>}
          {product.shortDescription && <p>{product.shortDescription}</p>}
          <OmbrineProductPurchase product={product} theme={theme} />
          {product.description && <SafeHtml spaNavigation={false} className="om-editorial" html={product.description} />}
        </div>
      </article>
    </OmbrineShell>
  }

  if (route.kind === 'collection') {
    const q = route.q?.trim().slice(0, 100) ?? ''
    const page = Math.min(1000, Math.max(1, Math.floor(route.page || 1)))
    const brand = typeof route.brand === 'string' ? route.brand.trim().slice(0, 120) : undefined
    const sort = SALON_SORTS.find(([value]) => value === route.sort)?.[0] ?? 'featured'
    const [collection, { products, count }, categories, looks] = await Promise.all([
      collectionForRoute(route.slug), salonProducts(theme, route.slug, q, page, brand, route.sale, sort),
      salonCategories(theme), salonLooks(theme),
    ])
    if (!collection) notFound()
    const title = q ? `Results for “${q}”` : route.slug === 'all' ? 'The collection' : collection.name
    const href = (slug: string, n = 1) => {
      const path = slug === 'all' ? '/collection' : `/collections/${encodeURIComponent(slug)}`
      const query = new URLSearchParams({ ...(q ? { q } : {}), ...(brand ? { brand } : {}), ...(route.sale ? { sale: '1' } : {}), ...(sort === 'featured' ? {} : { sort }), ...(n === 1 ? {} : { page: String(n) }) })
      return query.size ? `${path}?${query}` : path
    }
    const matches = q && route.slug === 'all' && page === 1 ? looks.filter((look) => [look.name, look.description, ...look.products.map((p) => p.name)].some((text) => text?.toLowerCase().includes(q.toLowerCase()))) : []
    return <OmbrineShell theme={theme}>
      <section className="om-index">
        <OmbrineIndexHeading title={title} summary={`${count} ${count === 1 ? 'piece' : 'pieces'}, ${looks.length} ${looks.length === 1 ? 'look' : 'looks'}`} theme={theme} />
        <div className="om-index-bar">
          <nav aria-label="Collection filters"><Link href={href('all')} aria-current={route.slug === 'all' ? 'page' : undefined}>All</Link>
            {categories.map((item) => <Link key={item.slug} href={href(item.slug)} aria-current={route.slug === item.slug ? 'page' : undefined}>{item.name}</Link>)}
          </nav>
          <form className="om-sort" action={route.slug === 'all' ? '/collection' : `/collections/${encodeURIComponent(route.slug)}`}>
            {q && <input name="q" value={q} type="hidden" />}{brand && <input name="brand" value={brand} type="hidden" />}{route.sale && <input name="sale" value="1" type="hidden" />}
            <label>Sort <select name="sort" defaultValue={sort}>{SALON_SORTS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <button type="submit" aria-label="Apply sort">→</button>
          </form>
        </div>
        <div className="om-index-grid">
          {collection.description && <p className="om-muted">{collection.description}</p>}
          {!products.length && <p>No pieces found.</p>}
          <div className="om-collection">{products.map((product) => <article className="om-collection-item" key={product.id}>
            <div className="om-index-photo">
              <Link href={`/products/${encodeURIComponent(product.slug)}`} className="om-product-image" aria-label={product.name}>{product.images[0] && <img src={product.images[0].imageUrl} alt={product.images[0].altText || product.name} loading="lazy" />}</Link>
              {product.inStock && <OmbrineQuickAdd product={product} theme={theme} />}
            </div>
            <Link href={`/products/${encodeURIComponent(product.slug)}`}><h2>{product.name}</h2></Link>
            <p>{salonPrice(effectivePrice(product), salonCurrency(theme))}{!product.inStock && ' · Sold out'}</p>
          </article>)}</div>
          {!!matches.length && <section className="om-search-looks"><h2>Matching looks</h2><ul>{matches.map((look) => <li key={look.id}><Link className="om-link" href={`/looks/${encodeURIComponent(look.id)}`}>{look.name} →</Link></li>)}</ul></section>}
          {(page > 1 || count > page * 24) && <nav className="om-pagination" aria-label="Collection pages">
            {page > 1 ? <Link className="om-link" href={href(route.slug, page - 1)}>← Previous</Link> : <span />}
            <span>Page {page}</span>
            {count > page * 24 ? <Link className="om-link" href={href(route.slug, page + 1)}>Next →</Link> : <span />}
          </nav>}
        </div>
      </section>
    </OmbrineShell>
  }

  const page = await ombrineContentPage(route.slug, theme.id)
  if (!page) notFound()
  return <OmbrineShell theme={theme}><article className="om-content"><header><h1>{page.title}</h1></header><SafeHtml spaNavigation={false} className="om-editorial" html={page.content} /></article></OmbrineShell>
}
