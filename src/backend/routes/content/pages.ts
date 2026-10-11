import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { memo } from '@/backend/lib/memo'

/** Published page by slug, for the storefront. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await memo(`page:${slug}`, () => db.page.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true, title: true, content: true, css: true, bodyClass: true, layout: true, hideHeaderFooter: true,
      metaTitle: true, metaDescription: true, theme: { select: { id: true, kind: true, updatedAt: true } },
    },
  }))
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  const { theme, ...rest } = page
  // Isolated pages from an HTML template are styled by that template's (large) CSS, served as a
  // separate, versioned stylesheet so browsers download it once for all the template's pages.
  const themeCssUrl = theme?.kind === 'html' ? `/api/theme-css/${theme.id}?v=${theme.updatedAt.getTime()}` : ''
  return NextResponse.json({ ...rest, themeCssUrl }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' } })
}

/** GET /api/theme-css/:id — a theme's CSS as a stylesheet. Versioned URLs are cached for a year. */
export async function themeCss(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const theme = await memo(`theme-css:${id}`, () => db.theme.findUnique({ where: { id }, select: { css: true } }))
  if (!theme) return new NextResponse('/* theme not found */', { status: 404, headers: { 'Content-Type': 'text/css' } })
  const versioned = new URL(request.url).searchParams.has('v')
  return new NextResponse(theme.css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    },
  })
}
