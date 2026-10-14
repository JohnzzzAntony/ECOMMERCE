// Glue between the backend storefront loader and the section components (app layer: the only place both meet).
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { renderPage } from '@/backend/lib/storefront'
import { StorefrontPage } from '@/frontend/components/sections/storefront-page'
import { richTextToPlain } from '@/shared/store-pages'
import type { RenderedPage } from '@/shared/storefront'

export type StoreRoute = Parameters<typeof renderPage>[1]

export async function requestOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https')
  return { host, origin: `${proto.split(',')[0]}://${host.split(',')[0]}` }
}

export async function loadStorePage(route: StoreRoute) {
  const { host } = await requestOrigin()
  return renderPage(host, route)
}

function pathOf(page: RenderedPage) {
  if (page.route.kind === 'product') return `/products/${encodeURIComponent(page.route.product.slug)}`
  if (page.route.kind === 'collection') return `/collections/${encodeURIComponent(page.route.collection.slug)}`
  if (page.route.kind === 'cart') return '/cart'
  return page.page.type === 'HOME' ? '/' : `/pages/${page.page.slug}`
}

export async function storeMetadata(route: StoreRoute): Promise<Metadata | null> {
  const page = await loadStorePage(route)
  if (!page) return null
  const { origin } = await requestOrigin()
  const seo = page.page.seo
  const product = page.route.kind === 'product' ? page.route.product : null
  const firstText = page.sections.map((s) => (Array.isArray(s.settings.subtitle) ? richTextToPlain(s.settings.subtitle as never) : Array.isArray(s.settings.body) ? richTextToPlain(s.settings.body as never) : '')).find(Boolean)
  const description = seo.description ?? product?.metaDescription ?? product?.shortDescription ?? firstText?.slice(0, 160)
  const title = seo.title ?? product?.metaTitle ?? (page.page.type === 'HOME' ? page.store.name : `${page.page.title} | ${page.store.name}`)
  const image = seo.ogImage ?? product?.images?.[0]?.imageUrl
  return {
    title, description: description || undefined,
    alternates: { canonical: seo.canonical || `${origin}${pathOf(page)}` },
    robots: seo.noindex || page.route.kind === 'cart' ? { index: false, follow: true } : undefined,
    openGraph: { title, description: description || undefined, url: `${origin}${pathOf(page)}`, siteName: page.store.name, type: product ? 'website' : 'website', ...(image ? { images: [{ url: image }] } : {}) },
  }
}

/** Renders the page or 404s. */
export async function StoreRoutePage({ route }: { route: StoreRoute }) {
  const page = await loadStorePage(route)
  if (!page) notFound()
  const { origin } = await requestOrigin()
  return <StorefrontPage page={page} origin={origin} />
}
