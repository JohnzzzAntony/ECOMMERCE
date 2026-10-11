import { StorefrontApp } from '@/frontend/storefront-app'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { storeSettings } from '@/backend/routes/content/settings'

// Theme and settings are read per request (from the in-process cache), so admin edits show on the next load.
export const dynamic = 'force-dynamic'

const warn = (what: string) => (error: unknown) => {
  console.error(`Could not load ${what}; using defaults`, error instanceof Error ? error.message : error)
  return null
}

export default async function Home() {
  const [theme, settings] = await Promise.all([storefrontTheme().catch(warn('the active theme')), storeSettings().catch(warn('store settings'))])
  return <StorefrontApp initialTheme={theme} initialSettings={settings} />
}
