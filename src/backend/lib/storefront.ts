// Storefront rendering data for stores whose design comes from Figma (Store.designSource = FIGMA): published page
// versions, global sections, active design tokens, self-hosted fonts and catalog data for commerce sections.
// Figma is never called here. Results are cached in process (memo) under tenant:{id}:page:{slug}:v{n} and
// cleared on publish (invalidateAll).
import type { Prisma } from '@prisma/client'
import { db } from '@/backend/lib/db'
import { log } from '@/backend/lib/log'
import { memo } from '@/backend/lib/memo'
import { storeForHost } from '@/backend/lib/store'
import { storeDb } from '@/backend/lib/tenancy'
import { designTokensSchema, EMPTY_TOKENS } from '@/shared/design-tokens'
import { defaultSettings, newId, validateSection, type SectionInstance, type SectionType } from '@/shared/sections/registry'
import { RESERVED_SLUGS, seoSchema, type StorePageType } from '@/shared/store-pages'
import type { CollectionCard, FontFace, ProductCard, RenderedPage, RouteContext, SectionData } from '@/shared/storefront'
import type { Product } from '@/shared/types'

type StoreRow = Awaited<ReturnType<typeof storeForHost>>

/** Validates stored sections; an invalid section is skipped and logged, never breaking the page. */
export function renderableSections(raw: unknown, context: Record<string, unknown>): SectionInstance[] {
  const out: SectionInstance[] = []
  for (const s of Array.isArray(raw) ? raw : []) {
    const v = validateSection(s)
    if (v.ok) { if (!v.section.hidden) out.push(v.section) }
    else log('warn', 'skipping invalid section', { ...context, sectionId: (s as { id?: string })?.id, issue: v.issues[0] })
  }
  return out
}

async function publishedPage(storeId: string, slug: string) {
  const sdb = storeDb(storeId)
  const page = await memo(`tenant:${storeId}:page:${slug}`, () => sdb.storePage.findFirst({ where: { slug, publishedVersionId: { not: null } } }))
  if (!page) return null
  const version = await memo(`tenant:${storeId}:page:${slug}:v${page.publishedVersionId}`, () => sdb.storePageVersion.findFirst({ where: { id: page.publishedVersionId! } }))
  if (!version) return null
  return { page, sections: renderableSections(version.sections, { storeId, slug, version: version.version }) }
}

/** Figma-designed storefront is live once the store uses Figma and has a published home page. */
export async function figmaStorefront(host: string): Promise<StoreRow | null> {
  const store = await storeForHost(host)
  if (store.designSource !== 'FIGMA') return null
  return (await publishedPage(store.id, '')) ? store : null
}

// ---------------------------------------------------------------- catalog data
const listInclude = { images: { take: 1, orderBy: { sortOrder: 'asc' } }, brand: true } satisfies Prisma.ProductInclude
const listOmit = { description: true, descriptionAr: true, specifications: true, metaKeywords: true } satisfies Prisma.ProductOmit
type ListProduct = Prisma.ProductGetPayload<{ include: typeof listInclude; omit: typeof listOmit }>

function card(p: ListProduct): ProductCard {
  const img = p.images[0]
  const product = JSON.parse(JSON.stringify(p)) as Product
  return { id: p.id, slug: p.slug, name: p.name, regularPrice: p.regularPrice, salePrice: p.salePrice, onSale: p.onSale, inStock: p.inStock, badge: p.badge, image: img ? { url: img.imageUrl, alt: img.altText || p.name } : null, product }
}

async function productsBySlugs(slugs: string[]) {
  if (!slugs.length) return []
  const rows = await db.product.findMany({ where: { slug: { in: slugs } }, include: listInclude, omit: listOmit })
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is ListProduct => !!r).map(card)
}

async function productsInCollection(slug: string, limit: number, q?: string) {
  if (!slug) return []
  if (slug === 'all') {
    const where: Prisma.ProductWhereInput = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { shortDescription: { contains: q, mode: 'insensitive' } }] } : {}
    return (await db.product.findMany({ where, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }], take: limit, include: listInclude, omit: listOmit })).map(card)
  }
  const category = await db.category.findFirst({ where: { slug, isActive: true }, select: { id: true } })
  if (category && !(await db.collection.findFirst({ where: { slug }, select: { id: true } }))) {
    return (await db.product.findMany({ where: { categoryId: category.id }, orderBy: { createdAt: 'desc' }, take: limit, include: listInclude, omit: listOmit })).map(card)
  }
  const rows = await db.collectionProduct.findMany({ where: { collection: { slug, isActive: true } }, orderBy: { sortOrder: 'asc' }, take: limit, include: { product: { include: listInclude, omit: listOmit } } })
  return rows.map((r) => card(r.product))
}

/** Best sellers by quantity ordered, topped up with featured then newest products. */
async function bestSellers(limit: number) {
  const top = await db.orderItem.groupBy({ by: ['productId'], where: { productId: { not: null } }, _sum: { qty: true }, orderBy: { _sum: { qty: 'desc' } }, take: limit })
  const ids = top.map((t) => t.productId!).filter(Boolean)
  const ranked = ids.length ? await db.product.findMany({ where: { id: { in: ids } }, include: listInclude, omit: listOmit }) : []
  const out = ids.map((id) => ranked.find((p) => p.id === id)).filter((p): p is ListProduct => !!p)
  if (out.length < limit) {
    const more = await db.product.findMany({ where: { id: { notIn: out.map((p) => p.id) } }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }], take: limit - out.length, include: listInclude, omit: listOmit })
    out.push(...more)
  }
  return out.map(card)
}

async function collectionCards(slugs: string[]): Promise<CollectionCard[]> {
  const rows = await db.collection.findMany({ where: slugs.length ? { slug: { in: slugs }, isActive: true } : { isActive: true }, include: { _count: { select: { products: true } } }, orderBy: { sortOrder: 'asc' }, take: 24 })
  const ordered = slugs.length ? slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is (typeof rows)[number] => !!r) : rows
  return ordered.map((c) => ({ slug: c.slug, name: c.name, description: c.description, image: c.bannerImageUrl, count: c._count.products }))
}

/** Catalog data for each data-bound section. */
export async function sectionData(sections: SectionInstance[], route: RouteContext): Promise<SectionData> {
  const data: SectionData = {}
  for (const s of sections) {
    const st = s.settings as Record<string, unknown>
    if (s.type === 'product-grid') {
      const limit = Number(st.limit) || 8
      const products = st.source === 'manual' ? await productsBySlugs(((st.products as string[]) ?? []).slice(0, limit))
        : st.source === 'collection' ? await productsInCollection(String(st.collection ?? ''), limit)
          : st.source === 'current-collection' ? (route.kind === 'collection' ? await productsInCollection(route.collection.slug, limit, route.query) : [])
            : await bestSellers(limit)
      data[s.id] = { products }
    } else if (s.type === 'collection-list') {
      data[s.id] = { collections: await collectionCards(s.blocks.map((b) => String((b.settings as { collection?: string }).collection ?? '')).filter(Boolean)) }
    }
  }
  return data
}

export async function productForRoute(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { sortOrder: 'asc' } }, brand: true, category: { include: { parent: true } } },
  })
  if (!product) return null
  const crumbs = [{ name: 'Home', href: '/' }]
  if (product.category?.parent) crumbs.push({ name: product.category.parent.name, href: `/collections/${product.category.parent.slug}` })
  if (product.category) crumbs.push({ name: product.category.name, href: `/collections/${product.category.slug}` })
  return { product: JSON.parse(JSON.stringify(product)) as Product, breadcrumbs: crumbs }
}

export async function collectionForRoute(slug: string, q?: string): Promise<CollectionCard | null> {
  if (slug === 'all') return { slug: 'all', name: q ? `Search results for “${q}”` : 'All products', description: null, image: null, count: await db.product.count() }
  const c = await db.collection.findFirst({ where: { slug, isActive: true }, include: { _count: { select: { products: true } } } })
  if (c) return { slug: c.slug, name: c.name, description: c.description, image: c.bannerImageUrl, count: c._count.products }
  // Categories are browsable as collections too.
  const cat = await db.category.findFirst({ where: { slug, isActive: true }, include: { _count: { select: { products: true } } } })
  return cat ? { slug: cat.slug, name: cat.name, description: null, image: cat.imageUrl, count: cat._count.products } : null
}

// ---------------------------------------------------------------- page assembly
async function designAssets(storeId: string) {
  const sdb = storeDb(storeId)
  return memo(`tenant:${storeId}:design`, async () => {
    const ds = await sdb.designSystem.findFirst({ where: { status: 'ACTIVE' } })
    const parsed = ds ? designTokensSchema.safeParse(ds.tokens) : null
    const fonts = await sdb.font.findMany({})
    const faces: FontFace[] = fonts.flatMap((f) => (f.files as FontFace[]).map((file) => ({ ...file, family: f.family })))
      .filter((f) => /^https:\/\//.test(f.url) && /^[A-Za-z0-9 _-]+$/.test(f.family))
    return { tokens: parsed?.success ? parsed.data : EMPTY_TOKENS, fonts: faces }
  })
}

async function globals(storeId: string) {
  const [header, footer, announcement] = await Promise.all(['_header', '_footer', '_announcement'].map((s) => publishedPage(storeId, s)))
  return { header: header?.sections ?? [], footer: footer?.sections ?? [], announcement: announcement?.sections ?? [] }
}

const fallbackSection = (type: SectionType, settings: Record<string, unknown> = {}): SectionInstance =>
  ({ id: newId(), type, figmaNodeId: null, settings: { ...defaultSettings(type), ...settings }, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1 })

/** A published page for the storefront, or null (404). Templates fall back to a default section. */
export async function renderPage(host: string, route: { kind: 'page'; slug: string } | { kind: 'product'; slug: string } | { kind: 'collection'; slug: string; q?: string } | { kind: 'cart' }): Promise<RenderedPage | null> {
  const store = await figmaStorefront(host)
  if (!store) return null
  let routeCtx: RouteContext = { kind: 'page' }
  let slug: string
  let fallback: SectionInstance[] = []
  if (route.kind === 'page') slug = route.slug
  else if (route.kind === 'cart') { slug = RESERVED_SLUGS.CART; routeCtx = { kind: 'cart' }; fallback = [fallbackSection('cart')] }
  else if (route.kind === 'product') {
    const p = await memo(`catalog:product:${route.slug}`, () => productForRoute(route.slug))
    if (!p) return null
    routeCtx = { kind: 'product', product: p.product, breadcrumbs: p.breadcrumbs }
    slug = RESERVED_SLUGS.PRODUCT_TEMPLATE; fallback = [fallbackSection('product-detail')]
  } else {
    const q = route.q?.trim().slice(0, 100) || undefined
    const c = await memo(`catalog:collection:${route.slug}:${q ?? ''}`, () => collectionForRoute(route.slug, q))
    if (!c) return null
    routeCtx = { kind: 'collection', collection: c, ...(q ? { query: q } : {}) }
    slug = RESERVED_SLUGS.COLLECTION_TEMPLATE; fallback = [fallbackSection('product-grid', { title: c.name, source: 'current-collection', limit: 24 })]
  }
  if (slug.startsWith('_') && route.kind === 'page') return null // templates and globals aren't pages
  const found = await publishedPage(store.id, slug)
  if (!found && !fallback.length) return null
  const sections = found?.sections ?? fallback
  const [g, design] = await Promise.all([globals(store.id), designAssets(store.id)])
  const routeKey = route.kind === 'page' || route.kind === 'cart' ? route.kind : `${route.kind}:${route.slug}:${route.kind === 'collection' ? route.q ?? '' : ''}`
  const data = await memo(`tenant:${store.id}:data:${slug}:${routeKey}:${found?.page.publishedVersionId ?? 'fallback'}`, () => sectionData([...sections, ...g.header, ...g.footer], routeCtx))
  const page = found?.page
  const title = route.kind === 'product' && routeCtx.kind === 'product' ? routeCtx.product.name : route.kind === 'collection' && routeCtx.kind === 'collection' ? routeCtx.collection.name : page?.title ?? 'Cart'
  return {
    store: { id: store.id, name: store.name },
    page: { id: page?.id ?? `fallback-${slug}`, type: (page?.type ?? (route.kind === 'cart' ? 'CART' : 'PAGE')) as StorePageType, slug, title, seo: seoSchema.catch({}).parse(page?.seo ?? {}) },
    sections, globals: g, tokens: design.tokens, fonts: design.fonts, data, route: routeCtx, currency: process.env.CURRENCY || 'AED',
  }
}

/** Draft preview (admin): same rendering as the storefront, with sections supplied by the editor. */
export async function renderPreview(storeId: string, pageType: StorePageType, sections: unknown, title = 'Preview'): Promise<RenderedPage> {
  const clean = renderableSections(sections, { storeId, preview: true })
  const [g, design] = await Promise.all([globals(storeId), designAssets(storeId)])
  let route: RouteContext = { kind: 'page' }
  if (pageType === 'PRODUCT_TEMPLATE') {
    const sample = await db.product.findFirst({ orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }], select: { slug: true } })
    const p = sample ? await productForRoute(sample.slug) : null
    if (p) route = { kind: 'product', product: p.product, breadcrumbs: p.breadcrumbs }
  } else if (pageType === 'COLLECTION_TEMPLATE') {
    const c = await db.collection.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    if (c) route = { kind: 'collection', collection: (await collectionForRoute(c.slug))! }
  } else if (pageType === 'CART') route = { kind: 'cart' }
  const isGlobal = pageType === 'HEADER' || pageType === 'FOOTER' || pageType === 'ANNOUNCEMENT'
  const shownGlobals = isGlobal ? { header: [], footer: [], announcement: [] } : g
  return {
    store: { id: storeId, name: 'Preview' },
    page: { id: 'preview', type: pageType, slug: 'preview', title, seo: { noindex: true } },
    sections: clean, globals: shownGlobals, tokens: design.tokens, fonts: design.fonts,
    data: await sectionData([...clean, ...shownGlobals.header, ...shownGlobals.footer], route), route, currency: process.env.CURRENCY || 'AED',
  }
}

/** Sitemap entries for a Figma storefront: published, indexable pages, then products and collections. */
export async function sitemapEntries(storeId: string) {
  const sdb = storeDb(storeId)
  const pages = await sdb.storePage.findMany({ where: { publishedVersionId: { not: null }, type: { in: ['HOME', 'PAGE'] } } })
  const products = await db.product.findMany({ select: { slug: true, updatedAt: true }, take: 5000 })
  const collections = await db.collection.findMany({ where: { isActive: true }, select: { slug: true } })
  return [
    ...pages.filter((p) => !seoSchema.catch({}).parse(p.seo).noindex).map((p) => ({ path: p.type === 'HOME' ? '/' : `/pages/${p.slug}`, lastModified: p.updatedAt })),
    ...products.map((p) => ({ path: `/products/${encodeURIComponent(p.slug)}`, lastModified: p.updatedAt })),
    ...collections.map((c) => ({ path: `/collections/${encodeURIComponent(c.slug)}`, lastModified: null as Date | null })),
  ]
}
