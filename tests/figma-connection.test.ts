// Phase 2: Figma connection — token encryption, OAuth (state, PKCE, replay), PAT, refresh, RBAC, store isolation.
import { afterAll, afterEach, beforeAll, beforeEach, expect, mock, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createFakeDb } from './helpers/fake-db'

process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const KEY1 = randomBytes(32).toString('base64'), KEY2 = randomBytes(32).toString('base64')
process.env.FIGMA_TOKEN_KEYS = `1:${KEY1}`
process.env.FIGMA_CLIENT_ID = 'client-id'
process.env.FIGMA_CLIENT_SECRET = 'client-secret'
process.env.FIGMA_REDIRECT_URI = 'https://shop-a.test/api/design/figma/oauth/callback'

const fake = createFakeDb()
mock.module('@/backend/lib/db', () => ({ db: fake.db }))

const { signSession } = await import('../src/backend/lib/password')
const { invalidateAll } = await import('../src/backend/lib/memo')
const { resetRateLimits } = await import('../src/backend/lib/rate-limit')
const { decryptSecret, encryptSecret, parseKeyring } = await import('../src/backend/lib/figma/crypto')
const { sha256 } = await import('../src/backend/lib/figma/oauth')
const { figmaAuth } = await import('../src/backend/lib/figma/connection')
const { redact } = await import('../src/backend/lib/log')
const { scopeArgs, storeDb } = await import('../src/backend/lib/tenancy')
const connectionRoute = await import('../src/app/api/design/figma/connection/route')
const startRoute = await import('../src/app/api/design/figma/oauth/start/route')
const callbackRoute = await import('../src/app/api/design/figma/oauth/callback/route')
const patRoute = await import('../src/app/api/design/figma/pat/route')

// ---- Figma API mock (MSW) ----
const calls = { token: [] as URLSearchParams[], refresh: 0, authHeaders: [] as string[] }
let refreshStatus = 200
const server = setupServer(
  http.post('https://api.figma.com/v1/oauth/token', async ({ request }) => {
    calls.authHeaders.push(request.headers.get('authorization') ?? '')
    calls.token.push(new URLSearchParams(await request.text()))
    return HttpResponse.json({ access_token: 'figu_access_1', token_type: 'bearer', expires_in: 7776000, refresh_token: 'figur_refresh_1', user_id_string: '42' })
  }),
  http.post('https://api.figma.com/v1/oauth/refresh', async () => {
    calls.refresh++
    if (refreshStatus !== 200) return HttpResponse.json({ error: true, message: 'invalid_grant' }, { status: refreshStatus })
    return HttpResponse.json({ access_token: `figu_access_refreshed_${calls.refresh}`, token_type: 'bearer', expires_in: 7776000 })
  }),
  http.get('https://api.figma.com/v1/me', ({ request }) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? request.headers.get('x-figma-token')
    if (token === 'figd_bad_token_0000000000') return HttpResponse.json({ status: 403, err: 'Invalid token' }, { status: 403 })
    return HttpResponse.json({ id: '42', handle: 'Dana Designer', email: 'dana@example.com', img_url: '' })
  }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

// ---- Two stores, users with roles ----
const users = {
  ownerA: { id: 'u_owner_a', email: 'owner@a.test', password: 'hash-a', role: 'admin', isActive: true },
  editorA: { id: 'u_editor_a', email: 'editor@a.test', password: 'hash-e', role: 'staff', isActive: true },
  viewerA: { id: 'u_viewer_a', email: 'viewer@a.test', password: 'hash-v', role: 'staff', isActive: true },
  ownerB: { id: 'u_owner_b', email: 'owner@b.test', password: 'hash-b', role: 'admin', isActive: true },
}

beforeEach(() => {
  fake.reset()
  invalidateAll(); resetRateLimits()
  calls.token = []; calls.refresh = 0; calls.authHeaders = []; refreshStatus = 200
  process.env.FIGMA_TOKEN_KEYS = `1:${KEY1}`
  fake.table('store').push(
    { id: 'legacy', slug: 'legacy', name: 'A', domain: 'shop-a.test', designSource: 'THEME', themesEnabled: null },
    { id: 'store_b', slug: 'b', name: 'B', domain: 'shop-b.test', designSource: 'FIGMA', themesEnabled: null },
  )
  fake.table('user').push(...Object.values(users).map((u) => ({ ...u })))
  fake.table('storeMember').push(
    { id: 'm1', storeId: 'legacy', userId: users.ownerA.id, role: 'OWNER' },
    { id: 'm2', storeId: 'legacy', userId: users.editorA.id, role: 'EDITOR' },
    { id: 'm3', storeId: 'legacy', userId: users.viewerA.id, role: 'VIEWER' },
    { id: 'm4', storeId: 'store_b', userId: users.ownerB.id, role: 'OWNER' },
  )
})
afterEach(() => server.resetHandlers())

function req(host: string, user: { id: string; password: string } | null, path: string, init: RequestInit & { sessionAt?: number } = {}) {
  const headers = new Headers(init.headers)
  headers.set('host', host)
  if (init.method && init.method !== 'GET') headers.set('origin', `https://${host}`)
  if (user) headers.set('cookie', `commerce_session=${signSession(user.id, user.password, init.sessionAt)}`)
  return new Request(`https://${host}${path}`, { ...init, headers })
}

async function connectViaOAuth(host = 'shop-a.test', user = users.ownerA) {
  const start = await startRoute.POST(req(host, user, '/api/design/figma/oauth/start', { method: 'POST' }))
  expect(start.status).toBe(200)
  const url = new URL((await start.json()).url)
  const state = url.searchParams.get('state')!
  const res = await callbackRoute.GET(req(host, user, `/api/design/figma/oauth/callback?code=the-code&state=${state}`))
  return { url, state, res }
}

// ---- Encryption ----
test('envelope encryption round-trips and binds the context', () => {
  const ring = parseKeyring(`1:${KEY1}`)
  const { ciphertext, keyVersion } = encryptSecret('figu_secret', 'figma:legacy:access', ring)
  expect(keyVersion).toBe(1)
  expect(ciphertext).not.toContain('figu_secret')
  expect(decryptSecret(ciphertext, 1, 'figma:legacy:access', ring)).toBe('figu_secret')
  expect(() => decryptSecret(ciphertext, 1, 'figma:store_b:access', ring)).toThrow()
  const [wrapped, value] = ciphertext.split('.')
  const flipped = Buffer.from(value, 'base64url'); flipped[flipped.length - 1] ^= 1
  expect(() => decryptSecret(`${wrapped}.${flipped.toString('base64url')}`, 1, 'figma:legacy:access', ring)).toThrow()
})

test('key rotation: old versions still decrypt, new values use the newest key', () => {
  const old = encryptSecret('t', 'c', parseKeyring(`1:${KEY1}`))
  const ring = parseKeyring(`1:${KEY1},2:${KEY2}`)
  expect(decryptSecret(old.ciphertext, 1, 'c', ring)).toBe('t')
  expect(encryptSecret('t', 'c', ring).keyVersion).toBe(2)
  expect(() => decryptSecret(old.ciphertext, 1, 'c', parseKeyring(`2:${KEY2}`))).toThrow('key version 1 is not configured')
  expect(() => parseKeyring('1:short')).toThrow('FIGMA_TOKEN_KEYS is invalid')
  expect(() => parseKeyring('')).toThrow('FIGMA_TOKEN_KEYS is not configured')
  expect(() => parseKeyring('figd_abc-123')).toThrow('contains a Figma token')
  try { parseKeyring('figd_abc-123') } catch (e) { expect((e as Error).message).not.toContain('abc-123'); expect((e as { status: number }).status).toBe(503) }
})

test('log redaction hides tokens by key and by value', () => {
  expect(redact({ access_token: 'x', nested: { Authorization: 'Bearer abc' }, msg: 'sent Bearer abc.def and figd_123-x', ok: 1 }))
    .toEqual({ access_token: '[REDACTED]', nested: { Authorization: '[REDACTED]' }, msg: 'sent Bearer [REDACTED] and [REDACTED]', ok: 1 })
})

test('scopeArgs adds the store to filters and data and never moves rows', () => {
  expect(scopeArgs('findMany', { where: { a: 1 } }, 's')).toEqual({ where: { a: 1, storeId: 's' } })
  expect(scopeArgs('create', { data: { a: 1, storeId: 'other' } }, 's')).toEqual({ data: { a: 1, storeId: 's' } })
  expect(scopeArgs('createMany', { data: [{ a: 1 }] }, 's')).toEqual({ data: [{ a: 1, storeId: 's' }] })
  expect(scopeArgs('update', { where: { id: 'x' }, data: { storeId: 'other', a: 2 } }, 's')).toEqual({ where: { id: 'x', storeId: 's' }, data: { a: 2 } })
  expect(scopeArgs('upsert', { where: { id: 'x' }, create: { a: 1 }, update: { storeId: 'o' } }, 's'))
    .toEqual({ where: { id: 'x', storeId: 's' }, create: { a: 1, storeId: 's' }, update: {} })
  expect(scopeArgs('deleteMany', undefined, 's')).toEqual({ where: { storeId: 's' } })
})

test('storeDb sets app.store_id for row level security in the same transaction', async () => {
  await storeDb('legacy').figmaConnection.findFirst({})
  expect(fake.rawCalls).toEqual(["SELECT set_config('app.store_id', 'legacy', TRUE)"])
})

// ---- OAuth ----
test('OAuth: authorize URL uses exact redirect URI, minimal scopes, state and PKCE S256', async () => {
  const start = await startRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/oauth/start', { method: 'POST' }))
  const url = new URL((await start.json()).url)
  expect(url.origin + url.pathname).toBe('https://www.figma.com/oauth')
  expect(url.searchParams.get('redirect_uri')).toBe(process.env.FIGMA_REDIRECT_URI!)
  expect(url.searchParams.get('scope')).toBe('current_user:read file_content:read file_metadata:read folders:read webhooks:write')
  expect(url.searchParams.get('response_type')).toBe('code')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  const state = url.searchParams.get('state')!
  expect(state.length).toBeGreaterThanOrEqual(43)
  const stored = fake.table('figmaOAuthState')[0]
  expect(stored.id).toBe(sha256(state)) // the raw state is never stored
  expect(stored.storeId).toBe('legacy')
  expect(url.searchParams.get('code_challenge')).toBe(sha256(stored.codeVerifier))
  expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000)
})

test('OAuth: callback exchanges the code, stores encrypted tokens and audits', async () => {
  const { res } = await connectViaOAuth()
  expect(res.status).toBe(303)
  expect(res.headers.get('location')).toBe('/admin?section=figma&figma=connected')
  expect(calls.authHeaders[0]).toBe(`Basic ${Buffer.from('client-id:client-secret').toString('base64')}`)
  const body = calls.token[0]
  expect(body.get('grant_type')).toBe('authorization_code')
  expect(body.get('code')).toBe('the-code')
  expect(body.get('redirect_uri')).toBe(process.env.FIGMA_REDIRECT_URI!)
  expect(body.get('code_verifier')).toBeTruthy()

  const [conn] = fake.table('figmaConnection')
  expect(conn).toMatchObject({ storeId: 'legacy', authType: 'OAUTH', handle: 'Dana Designer', status: 'ACTIVE', keyVersion: 1 })
  expect(JSON.stringify(conn)).not.toContain('figu_access_1')
  expect(JSON.stringify(conn)).not.toContain('figur_refresh_1')
  expect(fake.table('figmaOAuthState')).toHaveLength(0)
  expect(fake.table('auditLog')).toMatchObject([{ storeId: 'legacy', actorId: users.ownerA.id, action: 'figma.connect' }])

  const status = await connectionRoute.GET(req('shop-a.test', users.ownerA, '/api/design/figma/connection'))
  const text = await status.text()
  expect(JSON.parse(text).connection).toMatchObject({ handle: 'Dana Designer', authType: 'OAUTH', status: 'ACTIVE' })
  expect(text).not.toMatch(/figu_|figur_|Enc/)
})

test('OAuth: a replayed state is rejected and does not exchange again', async () => {
  const { state } = await connectViaOAuth()
  const replay = await callbackRoute.GET(req('shop-a.test', users.ownerA, `/api/design/figma/oauth/callback?code=other&state=${state}`))
  expect(replay.headers.get('location')).toBe('/admin?section=figma&figma=error')
  expect(calls.token).toHaveLength(1)
})

test('OAuth: state is bound to the session, the user, the store and a 10 minute TTL', async () => {
  const start = async () => {
    const res = await startRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/oauth/start', { method: 'POST' }))
    return new URL((await res.json()).url).searchParams.get('state')!
  }
  // Another session of the same user (different cookie).
  let state = await start()
  let res = await callbackRoute.GET(req('shop-a.test', users.ownerA, `/api/design/figma/oauth/callback?code=c&state=${state}`, { sessionAt: Date.now() - 60_000 }))
  expect(res.headers.get('location')).toContain('figma=error')
  // Another store's admin cannot complete it, even with a valid state.
  state = await start()
  res = await callbackRoute.GET(req('shop-b.test', users.ownerB, `/api/design/figma/oauth/callback?code=c&state=${state}`))
  expect(res.headers.get('location')).toContain('figma=error')
  expect(fake.table('figmaOAuthState').some((s) => s.id === sha256(state))).toBe(true) // still unused in store A
  // Expired.
  fake.table('figmaOAuthState').forEach((s) => { s.expiresAt = new Date(Date.now() - 1) })
  res = await callbackRoute.GET(req('shop-a.test', users.ownerA, `/api/design/figma/oauth/callback?code=c&state=${state}`))
  expect(res.headers.get('location')).toContain('figma=error')
  expect(calls.token).toHaveLength(0)
  expect(fake.table('figmaConnection')).toHaveLength(0)
})

test('OAuth start is rate limited', async () => {
  for (let i = 0; i < 10; i++) expect((await startRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/oauth/start', { method: 'POST' }))).status).toBe(200)
  expect((await startRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/oauth/start', { method: 'POST' }))).status).toBe(429)
})

test('OAuth start rejects cross-site requests (CSRF)', async () => {
  const r = req('shop-a.test', users.ownerA, '/api/design/figma/oauth/start', { method: 'POST' })
  const headers = new Headers(r.headers); headers.set('origin', 'https://evil.test')
  expect((await startRoute.POST(new Request(r.url, { method: 'POST', headers }))).status).toBe(403)
})

// ---- Personal access token ----
test('PAT: validated with GET /v1/me before saving; rejected tokens are not stored', async () => {
  const bad = await patRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/pat', { method: 'POST', body: JSON.stringify({ token: 'figd_bad_token_0000000000' }) }))
  expect(bad.status).toBe(400)
  expect(fake.table('figmaConnection')).toHaveLength(0)

  const ok = await patRoute.POST(req('shop-a.test', users.ownerA, '/api/design/figma/pat', { method: 'POST', body: JSON.stringify({ token: 'figd_good_token_000000000' }) }))
  expect(ok.status).toBe(200)
  expect(JSON.stringify(await ok.json())).not.toContain('figd_good')
  const [conn] = fake.table('figmaConnection')
  expect(conn).toMatchObject({ authType: 'PAT', expiresAt: null, refreshTokenEnc: null })
  const auth = await figmaAuth({ db: storeDb('legacy'), store: { id: 'legacy' } })
  expect(auth).toEqual({ type: 'PAT', token: 'figd_good_token_000000000', key: 'legacy' })
})

// ---- RBAC ----
test('RBAC: only OWNER/ADMIN connect or disconnect; members can read status; outsiders get 403', async () => {
  const post = (u: typeof users.ownerA) => startRoute.POST(req('shop-a.test', u, '/api/design/figma/oauth/start', { method: 'POST' }))
  expect((await post(users.editorA)).status).toBe(403)
  expect((await post(users.viewerA)).status).toBe(403)
  expect((await connectionRoute.DELETE(req('shop-a.test', users.editorA, '/api/design/figma/connection', { method: 'DELETE' }))).status).toBe(403)
  expect((await patRoute.POST(req('shop-a.test', users.viewerA, '/api/design/figma/pat', { method: 'POST', body: '{"token":"figd_good_token_000000000"}' }))).status).toBe(403)

  const viewer = await connectionRoute.GET(req('shop-a.test', users.viewerA, '/api/design/figma/connection'))
  expect(viewer.status).toBe(200)
  expect((await viewer.json()).canManage).toBe(false)
  expect((await connectionRoute.GET(req('shop-a.test', users.ownerB, '/api/design/figma/connection'))).status).toBe(403)
  expect((await connectionRoute.GET(req('shop-a.test', null, '/api/design/figma/connection'))).status).toBe(401)
})

// ---- Store isolation ----
test('isolation: store B cannot see or delete store A\'s connection', async () => {
  await connectViaOAuth()
  const b = await connectionRoute.GET(req('shop-b.test', users.ownerB, '/api/design/figma/connection'))
  expect((await b.json()).connection).toBeNull()
  await connectionRoute.DELETE(req('shop-b.test', users.ownerB, '/api/design/figma/connection', { method: 'DELETE' }))
  expect(fake.table('figmaConnection')).toHaveLength(1)
  await expect(figmaAuth({ db: storeDb('store_b'), store: { id: 'store_b' } })).rejects.toThrow('Connect a Figma account first')
  // Even a copied ciphertext does not decrypt under another store's context.
  const conn = fake.table('figmaConnection')[0]
  fake.table('figmaConnection').push({ ...conn, id: 'copy', storeId: 'store_b' })
  await expect(figmaAuth({ db: storeDb('store_b'), store: { id: 'store_b' } })).rejects.toThrow()
})

// ---- Disconnect ----
test('disconnect deletes tokens, audits and returns revoke instructions', async () => {
  await connectViaOAuth()
  const res = await connectionRoute.DELETE(req('shop-a.test', users.ownerA, '/api/design/figma/connection', { method: 'DELETE' }))
  expect(res.status).toBe(200)
  expect((await res.json()).revokeHelp).toContain('Settings')
  expect(fake.table('figmaConnection')).toHaveLength(0)
  expect(fake.table('auditLog').map((a) => a.action)).toEqual(['figma.connect', 'figma.disconnect'])
})

// ---- Refresh ----
const ctxA = () => ({ db: storeDb('legacy'), store: { id: 'legacy' } })

test('refresh: tokens close to expiry are refreshed once, even with concurrent callers', async () => {
  await connectViaOAuth()
  const conn = fake.table('figmaConnection')[0]
  expect((await figmaAuth(ctxA())).token).toBe('figu_access_1') // far from expiry: no refresh
  conn.expiresAt = new Date(Date.now() + 60_000)
  const [a, b] = await Promise.all([figmaAuth(ctxA()), figmaAuth(ctxA())])
  expect(calls.refresh).toBe(1)
  expect(a.token).toBe('figu_access_refreshed_1')
  expect(b.token).toBe('figu_access_refreshed_1')
  expect(conn.expiresAt.getTime()).toBeGreaterThan(Date.now() + 80 * 86400_000)
  expect((await figmaAuth(ctxA())).token).toBe('figu_access_refreshed_1')
})

test('refresh re-encrypts with the newest key after rotation', async () => {
  await connectViaOAuth()
  const conn = fake.table('figmaConnection')[0]
  process.env.FIGMA_TOKEN_KEYS = `1:${KEY1},2:${KEY2}`
  conn.expiresAt = new Date(Date.now() + 60_000)
  await figmaAuth(ctxA())
  expect(conn.keyVersion).toBe(2)
  process.env.FIGMA_TOKEN_KEYS = `2:${KEY2}`
  expect((await figmaAuth(ctxA())).token).toBe('figu_access_refreshed_1')
})

test('refresh rejected by Figma marks NEEDS_REAUTH and audits; transient failures do not', async () => {
  await connectViaOAuth()
  const conn = fake.table('figmaConnection')[0]
  conn.expiresAt = new Date(Date.now() + 60_000)

  refreshStatus = 500
  await expect(figmaAuth(ctxA())).rejects.toMatchObject({ status: 502 })
  expect(conn.status).toBe('ACTIVE')

  refreshStatus = 400
  await expect(figmaAuth(ctxA())).rejects.toMatchObject({ status: 409 })
  expect(conn.status).toBe('NEEDS_REAUTH')
  expect(fake.table('auditLog').at(-1)).toMatchObject({ action: 'figma.reauth_required', actorId: null, storeId: 'legacy' })
  await expect(figmaAuth(ctxA())).rejects.toMatchObject({ status: 409 })
  expect(calls.refresh).toBe(2)

  // Reconnecting restores the connection.
  await connectViaOAuth()
  expect(fake.table('figmaConnection')[0].status).toBe('ACTIVE')
})
