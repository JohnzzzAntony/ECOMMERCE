// Store (tenant) resolution and per-store feature flags.
import { db } from '@/backend/lib/db'
import { HttpError, failure } from '@/backend/lib/auth'
import { memo } from '@/backend/lib/memo'

export const LEGACY_STORE_ID = 'legacy'

type StoreFlags = { themesEnabled: boolean | null }

function requestHost(request: Request) {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
}

/**
 * The store for a hostname: its custom domain, else "<slug>.<PLATFORM_DOMAIN>", else the legacy store.
 * Cached in process (memo); the storefront and every API route resolve stores through here.
 */
export function storeForHost(rawHost: string) {
  const host = rawHost.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  const platform = process.env.PLATFORM_DOMAIN?.toLowerCase()
  const sub = platform && host.endsWith(`.${platform}`) ? host.slice(0, -platform.length - 1) : null
  const slug = sub && /^[a-z0-9-]{1,63}$/.test(sub) ? sub : null
  return memo(`store:${host}`, async () => {
    const rows = await db.store.findMany({ where: { OR: [{ domain: host }, ...(slug ? [{ slug }] : []), { id: LEGACY_STORE_ID }] } })
    const store = rows.find((s) => s.domain === host) ?? (slug ? rows.find((s) => s.slug === slug) : undefined) ?? rows.find((s) => s.id === LEGACY_STORE_ID)
    if (!store) throw new Error('No store row: run `bun run db:deploy` (migration 1_store creates the legacy store)')
    return store
  })
}

/** The store addressed by the request's hostname; hosts without a store of their own get the legacy store. */
export function currentStore(request: Request) {
  return storeForHost(requestHost(request))
}

/** The theme system is on when the store says so, otherwise when FEATURE_THEMES=true. Off by default. */
export function themesEnabled(store: StoreFlags) {
  return store.themesEnabled ?? process.env.FEATURE_THEMES === 'true'
}

/** Wraps a theme API handler so it answers 403 while the theme system is off for the request's store. */
export function withThemes<A extends unknown[]>(handler: (request: Request, ...rest: A) => Promise<Response>) {
  return async (request: Request, ...rest: A) => {
    try {
      if (!themesEnabled(await currentStore(request))) throw new HttpError(403, 'Themes are disabled for this store')
    } catch (error) { return failure(error) }
    return handler(request, ...rest)
  }
}
