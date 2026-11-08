import type { Metadata } from 'next'
import { OmbrineHome } from '@/frontend/components/theme/ombrine-salon'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { storeSettings } from '@/backend/routes/content/settings'
import { loadOmbrineTheme } from './_storefront/ombrine-route'
import { salonLooks } from '@/backend/lib/ombrine'
import { loadStorePage, storeMetadata, StoreRoutePage } from './_storefront/store-route'

// Theme and settings are read per request (from the in-process cache), so admin edits show on the next load.
export const dynamic = 'force-dynamic'

const warn = (what: string) => (error: unknown) => {
  console.error(`Could not load ${what}; using defaults`, error instanceof Error ? error.message : error)
  return null
}

// Stores designed in Figma with a published home page render it; every other store keeps the theme storefront.
export async function generateMetadata(): Promise<Metadata> {
  return (await storeMetadata({ kind: 'page', slug: '' }).catch(warn('the Figma home page'))) ?? {}
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [ombrine, params] = await Promise.all([loadOmbrineTheme(), searchParams])
  const preview = !!(params['theme-editor'] || params['theme-preview'])
  if (!preview && ombrine) return <OmbrineHome theme={ombrine} initialLooks={await salonLooks(ombrine)} />
  if (!preview && await loadStorePage({ kind: 'page', slug: '' }).catch(warn('the Figma home page'))) return <StoreRoutePage route={{ kind: 'page', slug: '' }} />
  const [{ StorefrontApp }, theme, settings, looks] = await Promise.all([
    import('@/frontend/storefront-app'),
    storefrontTheme().catch(warn('the active theme')),
    storeSettings().catch(warn('store settings')),
    ombrine ? salonLooks(ombrine) : undefined,
  ])
  return <StorefrontApp initialTheme={theme} initialSettings={settings} initialLooks={looks} />
}
