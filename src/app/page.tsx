import type { Metadata } from 'next'
import { StorefrontApp } from '@/frontend/storefront-app'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { storeSettings } from '@/backend/routes/content/settings'
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

export default async function Home() {
  if (await loadStorePage({ kind: 'page', slug: '' }).catch(warn('the Figma home page'))) return <StoreRoutePage route={{ kind: 'page', slug: '' }} />
  const [theme, settings] = await Promise.all([storefrontTheme().catch(warn('the active theme')), storeSettings().catch(warn('store settings'))])
  return <StorefrontApp initialTheme={theme} initialSettings={settings} />
}
