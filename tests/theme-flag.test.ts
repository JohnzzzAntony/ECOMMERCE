// Theme system feature flag: admin theme API routes answer 403 while themes are off for the store.
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

let storeRow: { id: string; domain: string | null; designSource: string; themesEnabled: boolean | null }
const findMany = mock(async () => [storeRow])
mock.module('@/backend/lib/db', () => ({ db: { store: { findMany } } }))

const { invalidateAll } = await import('../src/backend/lib/memo')
const { themesEnabled } = await import('../src/backend/lib/store')
const themes = await import('../src/app/api/admin/themes/route')
const duplicate = await import('../src/app/api/admin/themes/duplicate/route')
const exported = await import('../src/app/api/admin/themes/export/route')
const revisions = await import('../src/app/api/admin/themes/revisions/route')

const routes = [
  ['GET', themes.GET], ['POST', themes.POST], ['PUT', themes.PUT], ['DELETE', themes.DELETE],
  ['POST', duplicate.POST], ['GET', exported.GET], ['GET', revisions.GET], ['POST', revisions.POST],
] as const

const call = (method: string, handler: (r: Request) => Promise<Response>) =>
  handler(new Request('http://shop.test/api/admin/themes', { method, headers: { host: 'shop.test' } }))

const env = process.env.FEATURE_THEMES
beforeEach(() => { invalidateAll(); storeRow = { id: 'legacy', domain: null, designSource: 'THEME', themesEnabled: null } })
afterEach(() => { if (env === undefined) delete process.env.FEATURE_THEMES; else process.env.FEATURE_THEMES = env })

test('flag unset or false: every admin theme route returns 403', async () => {
  for (const value of [undefined, 'false']) {
    if (value === undefined) delete process.env.FEATURE_THEMES; else process.env.FEATURE_THEMES = value
    for (const [method, handler] of routes) {
      invalidateAll()
      const res = await call(method, handler)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Themes are disabled for this store' })
    }
  }
})

test('store override false beats FEATURE_THEMES=true', async () => {
  process.env.FEATURE_THEMES = 'true'
  storeRow.themesEnabled = false
  for (const [method, handler] of routes) { invalidateAll(); expect((await call(method, handler)).status).toBe(403) }
})

test('when enabled, requests reach the handler (which then requires an admin session)', async () => {
  delete process.env.FEATURE_THEMES
  storeRow.themesEnabled = true
  for (const [method, handler] of routes) { invalidateAll(); expect((await call(method, handler)).status).toBe(401) }
  storeRow.themesEnabled = null
  process.env.FEATURE_THEMES = 'true'
  for (const [method, handler] of routes) { invalidateAll(); expect((await call(method, handler)).status).toBe(401) }
})

test('themesEnabled: store override, then global flag, default off', () => {
  delete process.env.FEATURE_THEMES
  expect(themesEnabled({ themesEnabled: null })).toBe(false)
  expect(themesEnabled({ themesEnabled: true })).toBe(true)
  process.env.FEATURE_THEMES = 'true'
  expect(themesEnabled({ themesEnabled: null })).toBe(true)
  expect(themesEnabled({ themesEnabled: false })).toBe(false)
})
