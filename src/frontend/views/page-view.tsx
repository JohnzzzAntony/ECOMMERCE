'use client'
// Custom pages (admin "Pages" section and imported template pages), at /?page=<slug>.
import { useEffect, useState } from 'react'
import { FileQuestion } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api, type PublicPage } from '@/frontend/lib/api'
import { Button } from '@/frontend/components/ui/button'
import { IsolatedFrame, SafeHtml } from '@/frontend/components/theme/html-content'

/** Fetch a published page; `undefined` while loading, `null` when missing. */
export function usePage(slug: string | undefined) {
  const [state, setState] = useState<{ slug?: string; page: PublicPage | null }>({ page: null })
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    api.page(slug)
      .then((page) => { if (!cancelled) setState({ slug, page }) })
      .catch(() => { if (!cancelled) setState({ slug, page: null }) })
    return () => { cancelled = true }
  }, [slug])
  if (!slug) return null
  return state.slug === slug ? state.page : undefined
}

/** A page rendered in place: used by the page view and the homepage "Custom page" section. */
export function PageBody({ page, fullHeight = false, showTitle = false }: { page: PublicPage; fullHeight?: boolean; showTitle?: boolean }) {
  if (page.layout === 'isolated') {
    return <IsolatedFrame title={page.title} html={page.content} css={page.css} themeCssUrl={page.themeCssUrl} bodyClass={page.bodyClass} fullHeight={fullHeight} />
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {showTitle && <h1 className="mb-6 text-3xl font-bold text-brand-ink sm:text-4xl">{page.title}</h1>}
      <SafeHtml html={page.content} css={page.css} />
    </div>
  )
}

export function PageView() {
  const slug = useStore((s) => s.params.slug)
  const navigate = useStore((s) => s.navigate)
  const setPageHidesChrome = useStore((s) => s.setPageHidesChrome)
  const page = usePage(slug)

  useEffect(() => {
    if (!page) return
    const previous = document.title
    document.title = page.metaTitle || page.title
    setPageHidesChrome(page.hideHeaderFooter)
    // Shareable address while the page is open (the rest of the SPA keeps the bare URL).
    const url = `/?page=${encodeURIComponent(page.slug)}`
    window.history.replaceState(null, '', url)
    return () => {
      document.title = previous
      setPageHidesChrome(false)
      if (window.location.pathname + window.location.search === url) window.history.replaceState(null, '', '/')
    }
  }, [page, setPageHidesChrome])

  if (page === undefined) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-14"><div className="shimmer h-10 w-1/2 rounded-lg" /><div className="shimmer h-64 rounded-lg" /></div>
  if (page === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <FileQuestion className="size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-brand-ink">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn’t exist or isn’t published.</p>
        <Button className="mt-6 bg-brand-teal hover:bg-brand-teal-dark" onClick={() => navigate('home')}>Back to home</Button>
      </div>
    )
  }
  return <PageBody page={page} fullHeight={page.hideHeaderFooter} showTitle />
}
