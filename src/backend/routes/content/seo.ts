// Per-store robots.txt and sitemap.xml. Theme stores keep the robots.txt that used to be a static file (and no
// sitemap, as before); Figma-designed stores list their published pages, products and collections.
import { storeForHost } from '@/backend/lib/store'
import { figmaStorefront, sitemapEntries } from '@/backend/lib/storefront'

const THEME_ROBOTS = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
`

function origin(request: Request) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host).split(',')[0].trim()
  const proto = (request.headers.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https')).split(',')[0]
  return { host, origin: `${proto}://${host}` }
}

const text = (body: string, type: string) => new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, max-age=0, s-maxage=300' } })
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function robots(request: Request) {
  const { host, origin: base } = origin(request)
  const store = await figmaStorefront(host).catch(() => null)
  if (!store) return text(THEME_ROBOTS, 'text/plain')
  return text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /design-preview/\nDisallow: /cart\n\nSitemap: ${base}/sitemap.xml\n`, 'text/plain')
}

export async function sitemap(request: Request) {
  const { host, origin: base } = origin(request)
  const store = await figmaStorefront(host).catch(() => null)
  if (!store) return new Response('Not found', { status: 404 })
  const entries = await sitemapEntries(store.id)
  const body = entries.map((e) => `<url><loc>${xml(base + e.path)}</loc>${e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : ''}</url>`).join('')
  return text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, 'application/xml')
}
