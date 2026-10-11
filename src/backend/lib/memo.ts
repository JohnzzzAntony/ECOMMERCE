// In-process cache for public storefront reads (theme, menus, settings, taxonomy, homepage content).
//
// Each entry lives at most TTL_MS; every admin write calls `invalidateAll()` after it commits, so
// edits show immediately on this server. With several server instances, others catch up within TTL_MS.
// Stored on globalThis so route handlers and pages share one cache in dev and production.
import { NextResponse } from 'next/server'

const TTL_MS = 60_000

type Entry = { expires: number; value: Promise<unknown> }
const g = globalThis as unknown as { __storefrontMemo?: Map<string, Entry> }
const store = (g.__storefrontMemo ??= new Map())

export function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>
  const value = load()
  store.set(key, { expires: Date.now() + TTL_MS, value })
  value.catch(() => { if (store.get(key)?.value === value) store.delete(key) }) // don't cache failures
  return value
}

export function invalidateAll() {
  store.clear()
}

/** JSON response for a memoized public read. Browsers revalidate; shared caches may serve briefly stale. */
export async function cachedJson<T>(key: string, load: () => Promise<T>) {
  return NextResponse.json(await memo(key, load), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' },
  })
}
