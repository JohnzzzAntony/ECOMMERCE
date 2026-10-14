// Integration: full import pipeline on recorded Figma fixtures (MSW), install, edit with optimistic concurrency,
// publish checklist, storefront render, rollback, webhook verification, re-sync with admin overrides kept,
// Figma 429 handling, and store isolation of the new routes.
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import sharp from 'sharp'
import fixture from './__fixtures__/figma/nodes-store.json'
import { createFakeDb } from './helpers/fake-db'

process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long'
process.env.FIGMA_TOKEN_KEYS = `1:${randomBytes(32).toString('base64')}`
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000' // no public HTTPS URL: re-sync falls back to polling

const fake = createFakeDb()
mock.module('@/backend/lib/db', () => ({ db: fake.db }))
const stored = new Map<string, unknown>()
mock.module('@/backend/lib/design-import/storage', () => ({
  snapshotKey: (storeId: string, fileKey: string, importId: string, kind: string) => `tenants/${storeId}/figma/${fileKey}/${importId}${kind === 'ir' ? '.ir' : ''}.json.gz`,
  putSnapshot: async (_s: string, key: string, value: unknown) => { stored.set(key, JSON.parse(JSON.stringify(value))); return key },
  getSnapshot: async (_s: string, key: string) => { if (!stored.has(key)) throw new Error('missing snapshot'); return structuredClone(stored.get(key)) },
  putImage: async (storeId: string, hash: string, _d: Buffer, format: string) => ({ key: `tenants/${storeId}/assets/${hash}`, url: `https://res.cloudinary.com/demo/image/upload/tenants/${storeId}/assets/${hash}.${format}` }),
  putFontFile: async (storeId: string, family: string, file: string) => `https://res.cloudinary.com/demo/raw/upload/tenants/${storeId}/fonts/${family.toLowerCase().replace(/\W+/g, '-')}/${file}`,
}))

const { encryptSecret } = await import('../src/backend/lib/figma/crypto')
const { signSession } = await import('../src/backend/lib/password')
const { invalidateAll } = await import('../src/backend/lib/memo')
const { resetRateLimits } = await import('../src/backend/lib/rate-limit')
const { figmaRequest, resetFigmaBuckets, timing } = await import('../src/backend/lib/figma/client')
const { runImport } = await import('../src/backend/lib/design-import/pipeline')
const { renderPage } = await import('../src/backend/lib/storefront')
const importRoute = await import('../src/app/api/design/imports/[id]/route')
const installRoute = await import('../src/app/api/design/imports/[id]/install/route')
const remapRoute = await import('../src/app/api/design/imports/[id]/sections/route')
const diffRoute = await import('../src/app/api/design/imports/[id]/diff/route')
const applyRoute = await import('../src/app/api/design/imports/[id]/apply/route')
const filesRoute = await import('../src/app/api/design/files/route')
const resyncRoute = await import('../src/app/api/design/files/[fileId]/resync/route')
const pagesRoute = await import('../src/app/api/design/pages/route')
const pageRoute = await import('../src/app/api/design/pages/[id]/route')
const draftRoute = await import('../src/app/api/design/pages/[id]/draft/route')
const publishRoute = await import('../src/app/api/design/pages/[id]/publish/route')
const rollbackRoute = await import('../src/app/api/design/pages/[id]/rollback/route')
const webhookRoute = await import('../src/app/api/design/figma/webhooks/route')
const systemRoute = await import('../src/app/api/design/system/route')

const FILE_KEY = 'AbCdEfGhIj1234567890'
let version = '42'
let heroTitle = 'Care that moves with you'
const calls: string[] = []
const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#0d6b8c' } }).png().toBuffer()
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><script>alert(1)</script><circle cx="24" cy="24" r="20" fill="#00b3d9"/></svg>'

function nodesFor(ids: string[]) {
  const all = structuredClone(fixture.nodes) as Record<string, any>
  const title = all['10:1'].document.children[1].children[0]
  title.characters = heroTitle
  return Object.fromEntries(ids.map((id) => [id, all[id] ?? null]))
}

let throttleOnce = false
const server = setupServer(
  http.get('https://api.figma.com/v1/files/:key/nodes', ({ request }) => {
    const ids = new URL(request.url).searchParams.get('ids')!.split(',')
    calls.push(`nodes:${ids.join(',')}`)
    return HttpResponse.json({ name: fixture.name, nodes: nodesFor(ids) })
  }),
  http.get('https://api.figma.com/v1/files/:key/images', () => {
    calls.push('fills')
    return HttpResponse.json({ meta: { images: { 'img-hero': 'https://s3-alpha-sig.figma.com/img/hero', 'img-p1': 'https://s3-alpha-sig.figma.com/img/p1', 'img-p2': 'https://evil.example/steal' } } })
  }),
  http.get('https://api.figma.com/v1/files/:key/meta', () => HttpResponse.json({ file: { version } })),
  http.get('https://api.figma.com/v1/files/:key', ({ request }) => {
    calls.push(`file:${new URL(request.url).search}`)
    return HttpResponse.json({ name: fixture.name, version, lastModified: fixture.lastModified, editorType: 'figma', document: { id: '0:0', name: 'Doc', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Web', type: 'CANVAS', children: [] }] } })
  }),
  http.get('https://api.figma.com/v1/images/:key', ({ request }) => {
    const url = new URL(request.url)
    const ids = url.searchParams.get('ids')!.split(',')
    const format = url.searchParams.get('format')
    calls.push(`images:${format}`)
    return HttpResponse.json({ err: null, images: Object.fromEntries(ids.map((id) => [id, `https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/${format}/${encodeURIComponent(id)}`])) })
  }),
  http.get('https://s3-alpha-sig.figma.com/img/:name', () => new HttpResponse(png, { headers: { 'Content-Type': 'image/png' } })),
  http.get('https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/svg/:id', () => new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } })),
  http.get('https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/png/:id', () => new HttpResponse(png, { headers: { 'Content-Type': 'image/png' } })),
  http.get('https://fonts.googleapis.com/css2', ({ request }) => {
    const family = new URL(request.url).searchParams.get('family')!.split(':')[0]
    return new HttpResponse(`/* latin */\n@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/${encodeURIComponent(family)}/400.woff2) format('woff2'); unicode-range: U+0000-00FF; }\n/* latin */\n@font-face { font-family: '${family}'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/s/${encodeURIComponent(family)}/700.woff2) format('woff2'); unicode-range: U+0000-00FF; }`, { headers: { 'Content-Type': 'text/css' } })
  }),
  http.get('https://fonts.gstatic.com/s/:family/:file', () => new HttpResponse(Buffer.concat([Buffer.from('wOF2'), randomBytes(32)]), { headers: { 'Content-Type': 'font/woff2' } })),
  http.get('https://api.figma.com/v1/throttled', () => {
    if (throttleOnce) { throttleOnce = false; return HttpResponse.json({ status: 429 }, { status: 429, headers: { 'Retry-After': '2' } }) }
    return HttpResponse.json({ ok: true })
  }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const users = {
  editorA: { id: 'u_ed_a', email: 'e@a.test', password: 'pa', role: 'staff', isActive: true },
  ownerB: { id: 'u_ow_b', email: 'o@b.test', password: 'pb', role: 'admin', isActive: true },
}
function req(host: string, user: { id: string; password: string }, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('host', host)
  headers.set('cookie', `commerce_session=${signSession(user.id, user.password)}`)
  if (init.method && init.method !== 'GET') headers.set('origin', `https://${host}`)
  return new Request(`https://${host}${path}`, { ...init, headers })
}
const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
const p = <T extends object>(v: T) => ({ params: Promise.resolve(v) })
const A = 'shop-a.test', B = 'shop-b.test'

function seed() {
  fake.reset(); stored.clear(); invalidateAll(); resetRateLimits(); resetFigmaBuckets(); calls.length = 0
  version = '42'; heroTitle = 'Care that moves with you'
  fake.table('store').push(
    { id: 'legacy', slug: 'legacy', name: 'Store A', domain: A, designSource: 'FIGMA', themesEnabled: null },
    { id: 'store_b', slug: 'b', name: 'Store B', domain: B, designSource: 'FIGMA', themesEnabled: null },
  )
  fake.table('user').push(...Object.values(users).map((u) => ({ ...u })))
  fake.table('storeMember').push({ id: 'm1', storeId: 'legacy', userId: users.editorA.id, role: 'EDITOR' }, { id: 'm2', storeId: 'store_b', userId: users.ownerB.id, role: 'OWNER' })
  for (const storeId of ['legacy', 'store_b']) {
    const enc = encryptSecret('figd_pat_for_tests_000000', `figma:${storeId}:access`)
    fake.table('figmaConnection').push({ id: `conn${storeId.replace(/\W/g, '')}000`, storeId, figmaUserId: '1', handle: 'h', authType: 'PAT', accessTokenEnc: enc.ciphertext, keyVersion: 1, status: 'ACTIVE', expiresAt: null })
  }
  fake.table('figmaFile').push({ id: 'file00000001', storeId: 'legacy', fileKey: FILE_KEY, branchKey: '', name: fixture.name, version: '41', lastModified: new Date(), webhookId: null, latestVersion: null, lastCheckedAt: null })
  fake.table('designImport').push({
    id: 'imp000000001', storeId: 'legacy', fileId: 'file00000001', kind: 'INSTALL', status: 'QUEUED', figmaVersion: '41', selectedNodeIds: ['10:1', '10:2'],
    pageAssignments: [{ title: 'Home', type: 'HOME', frames: { desktop: '10:1', mobile: '10:2' } }], warnings: [], stats: {}, result: null, attempts: 0, lockedAt: null, runAfter: new Date(), createdBy: users.editorA.id, createdAt: new Date(),
  })
}

describe('import → install → edit → publish → storefront → rollback → re-sync', () => {
  beforeAll(seed)
  let pageId = ''
  let revision = 0

  test('pipeline runs every stage and stops at REVIEW', async () => {
    await runImport('legacy', 'imp000000001')
    const job = fake.table('designImport')[0]
    expect(job.error).toBeNull()
    expect(job.status).toBe('REVIEW')
    expect(job.rawSnapshotKey).toBe(`tenants/legacy/figma/${FILE_KEY}/imp000000001.json.gz`)
    expect(job.irSnapshotKey).toBe(`tenants/legacy/figma/${FILE_KEY}/imp000000001.ir.json.gz`)
    expect(job.figmaVersion).toBe('42')
    expect(fake.table('figmaFile')[0]).toMatchObject({ version: '42', latestVersion: '42' })
    const page = job.result.pages[0]
    expect(page.sections.map((s: any) => s.type)).toEqual(['announcement-bar', 'hero', 'feature-grid', 'product-grid', 'faq', 'rich-text'])
    expect(page.sections[1].settings.image.url).toMatch(/^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/tenants\/legacy\/assets\//)
    expect(Object.keys(job.result.frameRenders).sort()).toEqual(['10:1', '10:2'])
  })

  test('assets: deduplicated per store, SVGs sanitized, disallowed hosts blocked', async () => {
    const assets = fake.table('asset')
    expect(assets.every((a) => a.storeId === 'legacy')).toBe(true)
    expect(assets.filter((a) => a.mime === 'image/svg+xml')).toHaveLength(1) // three identical icons → one asset
    expect(new Set(assets.map((a) => a.hash)).size).toBe(assets.length)
    const warnings = fake.table('designImport')[0].warnings as { code: string; message: string }[]
    expect(warnings.some((w) => w.code === 'MISSING_FONT' && w.message.includes('Acme Sans'))).toBe(true)
    expect(warnings.some((w) => w.code === 'NO_AUTO_LAYOUT')).toBe(true)
    expect(fake.table('font').map((f) => [f.family, f.source, f.files.length]).sort()).toEqual([['Inter', 'GOOGLE', 2], ['Plus Jakarta Sans', 'GOOGLE', 2]])
  })

  test('stages are idempotent: a resumed job skips finished stages', async () => {
    const job = fake.table('designImport')[0]
    const nodeCalls = calls.filter((c) => c.startsWith('nodes:')).length
    job.status = 'MAPPING'; job.result = { ...job.result, pages: undefined, assetsDone: false }
    await runImport('legacy', job.id)
    expect(job.status).toBe('REVIEW')
    expect(calls.filter((c) => c.startsWith('nodes:')).length).toBe(nodeCalls) // no re-fetch
    expect(job.result.pages[0].sections).toHaveLength(6)
  })

  test('review: change a section type and remember it for this Figma node', async () => {
    const page = fake.table('designImport')[0].result.pages[0]
    const res = await remapRoute.PATCH(req(A, users.editorA, '/x', { method: 'PATCH', body: JSON.stringify({ pageIndex: 0, sectionId: page.sections[5].id, type: 'freeform' }) }), p({ id: 'imp000000001' }))
    expect(res.status).toBe(200)
    expect((await res.json()).section).toMatchObject({ type: 'freeform', mappingConfidence: 1 })
    expect(fake.table('sectionMapping')).toMatchObject([{ storeId: 'legacy', fileKey: FILE_KEY, nodeId: '16:1', sectionType: 'freeform' }])
  })

  test('install creates draft pages and an active design system; nothing is published', async () => {
    const res = await installRoute.POST(req(A, users.editorA, '/x', json({})), p({ id: 'imp000000001' }))
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.pages).toEqual([{ pageId: expect.any(String), slug: '', version: 1 }])
    expect(out.designSystem).toMatchObject({ version: 1, status: 'ACTIVE' })
    pageId = out.pages[0].pageId
    expect(fake.table('storePage')[0]).toMatchObject({ type: 'HOME', slug: '' })
    expect(fake.table('storePage')[0].publishedVersionId).toBeFalsy()
    expect(fake.table('storePageVersion')[0]).toMatchObject({ status: 'DRAFT', version: 1, sourceImportId: 'imp000000001' })
    expect(fake.table('designImport')[0].status).toBe('INSTALLED')
    expect(await renderPage(A, { kind: 'page', slug: '' })).toBeNull() // not published yet
    expect(fake.table('auditLog').map((a) => a.action)).toContain('design.import.install')
  })

  test('publish is blocked by the checklist (missing alt text)', async () => {
    const res = await publishRoute.POST(req(A, users.editorA, '/x', json({})), p({ id: pageId }))
    expect(res.status).toBe(422)
    expect((await res.json()).checklist.map((c: { code: string }) => c.code)).toContain('MISSING_ALT')
  })

  test('draft autosave uses optimistic concurrency', async () => {
    const page = await (await pageRoute.GET(req(A, users.editorA, '/x'), p({ id: pageId }))).json()
    revision = page.draft.revision
    const sections = page.draft.sections.map((s: any) => s.type === 'hero' ? { ...s, settings: { ...s.settings, image: { ...s.settings.image, alt: 'Nurse helping a patient' }, ctaLink: { kind: 'collection', slug: 'all' } }, overriddenFields: ['image', 'ctaLink'] } : s)
      .map((s: any) => (s.type === 'freeform' ? { ...s, settings: { ...s.settings } } : s))
    const ok = await draftRoute.PUT(req(A, users.editorA, '/x', { method: 'PUT', body: JSON.stringify({ sections, revision }) }), p({ id: pageId }))
    expect(ok.status).toBe(200)
    revision = (await ok.json()).revision
    const stale = await draftRoute.PUT(req(A, users.editorA, '/x', { method: 'PUT', body: JSON.stringify({ sections, revision: revision - 1 }) }), p({ id: pageId }))
    expect(stale.status).toBe(409)
    const invalid = await draftRoute.PUT(req(A, users.editorA, '/x', { method: 'PUT', body: JSON.stringify({ sections: [{ id: 'x', type: 'hero', settings: { ctaLink: { kind: 'url', url: 'javascript:alert(1)' } } }], revision }) }), p({ id: pageId }))
    expect(invalid.status).toBe(400)
  })

  test('publish succeeds and the storefront renders the published version with tokens and fonts', async () => {
    const draft = fake.table('storePageVersion').find((v) => v.status === 'DRAFT')!
    // Fix remaining blockers the checklist reports (e.g. alt text for freeform/feature icons) then publish.
    const items = await (await import('../src/app/api/design/pages/[id]/checklist/route')).GET(req(A, users.editorA, '/x'), p({ id: pageId }))
    const blocking = (await items.json()).items.filter((i: { level: string }) => i.level === 'error')
    expect(blocking).toEqual([])
    const res = await publishRoute.POST(req(A, users.editorA, '/x', json({ revision: draft.revision })), p({ id: pageId }))
    expect(res.status).toBe(200)
    expect((await res.json()).version).toBe(1)
    invalidateAll()
    const rendered = await renderPage(A, { kind: 'page', slug: '' })
    expect(rendered?.sections.map((s) => s.type)).toEqual(['announcement-bar', 'hero', 'feature-grid', 'product-grid', 'faq', 'freeform'])
    expect(rendered?.tokens.colors.some((c) => c.name === 'Brand/Primary')).toBe(true)
    expect(rendered?.fonts.map((f) => f.family)).toEqual(expect.arrayContaining(['Inter', 'Plus Jakarta Sans']))
    expect(rendered?.data[rendered.sections[3].id]).toEqual({ products: [] }) // commerce data comes from the catalog
    expect(await renderPage(B, { kind: 'page', slug: '' })).toBeNull() // store B has no published page
  })

  test('an invalid stored section is skipped, never breaking the page', async () => {
    const v = fake.table('storePageVersion').find((x) => x.status === 'PUBLISHED')!
    v.sections = [...v.sections, { id: 'bad', type: 'hero', settings: { title: 42 } }]
    invalidateAll()
    expect((await renderPage(A, { kind: 'page', slug: '' }))?.sections.some((s) => s.id === 'bad')).toBe(false)
    v.sections = v.sections.filter((s: { id: string }) => s.id !== 'bad')
  })

  test('rollback publishes an older version as a new version', async () => {
    const page = await (await pageRoute.GET(req(A, users.editorA, '/x'), p({ id: pageId }))).json()
    const sections = page.draft.sections.map((s: any) => (s.type === 'announcement-bar' ? { ...s, settings: { ...s.settings, text: 'Changed' } } : s))
    const saved = await draftRoute.PUT(req(A, users.editorA, '/x', { method: 'PUT', body: JSON.stringify({ sections, revision: 0 }) }), p({ id: pageId }))
    expect(saved.status).toBe(200)
    expect((await publishRoute.POST(req(A, users.editorA, '/x', json({})), p({ id: pageId }))).status).toBe(200)
    const v1 = fake.table('storePageVersion').find((v) => v.version === 1)!
    const res = await rollbackRoute.POST(req(A, users.editorA, '/x', json({ versionId: v1.id })), p({ id: pageId }))
    expect(res.status).toBe(200)
    expect((await res.json()).version).toBe(3)
    invalidateAll()
    expect((await renderPage(A, { kind: 'page', slug: '' }))?.sections[0].settings.text).toBe('Free delivery over 500 AED')
    expect(fake.table('storePageVersion').map((v) => [v.version, v.status])).toEqual([[1, 'ARCHIVED'], [2, 'ARCHIVED'], [3, 'PUBLISHED']])
  })

  test('webhook passcodes are verified in constant time; only valid events mark updates', async () => {
    const passcode = 'correct-horse-battery-staple'
    Object.assign(fake.table('figmaFile')[0], { webhookId: 'wh1', webhookPasscodeHash: createHash('sha256').update(passcode).digest('hex') })
    const post = (body: unknown) => webhookRoute.POST(new Request('https://shop-a.test/api/design/figma/webhooks', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': '1.2.3.4' } }))
    expect((await post({ event_type: 'FILE_VERSION_UPDATE', passcode: 'wrong', webhook_id: 'wh1', file_key: FILE_KEY, version_id: '43' })).status).toBe(401)
    expect((await post({ event_type: 'FILE_VERSION_UPDATE', passcode, webhook_id: 'nope', file_key: FILE_KEY, version_id: '43' })).status).toBe(401)
    expect((await post({ event_type: 'PING', passcode, webhook_id: 'wh1' })).status).toBe(200)
    expect((await post({ event_type: 'FILE_VERSION_UPDATE', passcode, webhook_id: 'wh1', file_key: FILE_KEY, version_id: '43' })).status).toBe(200)
    expect(fake.table('figmaFile')[0].latestVersion).toBe('43')
    const files = await (await filesRoute.GET(req(A, users.editorA, '/api/design/files'))).json()
    expect(files[0]).toMatchObject({ updateAvailable: true, watching: 'webhook' })
  })

  test('re-sync: diff by Figma node, overridden fields kept, result is a new draft (not published)', async () => {
    version = '43'; heroTitle = 'Care that moves with your family'
    const start = await resyncRoute.POST(req(A, users.editorA, '/x', json({})), p({ fileId: 'file00000001' }))
    expect(start.status).toBe(201)
    const { id } = await start.json()
    await runImport('legacy', id)
    const job = fake.table('designImport').find((j) => j.id === id)!
    expect(job.status).toBe('REVIEW')
    const diff = await (await diffRoute.GET(req(A, users.editorA, '/x'), p({ id }))).json()
    const hero = diff.pages[0].changes.find((c: any) => c.kind === 'changed' && c.after.type === 'hero')
    expect(hero.fields).toEqual(expect.arrayContaining([{ field: 'title', overridden: false }, { field: 'image', overridden: true }]))
    const res = await applyRoute.POST(req(A, users.editorA, '/x', json({ decisions: { '': { [hero.key]: { accept: true } } }, acceptTokens: false })), p({ id }))
    expect(res.status).toBe(200)
    const draft = fake.table('storePageVersion').find((v) => v.status === 'DRAFT')!
    const heroAfter = draft.sections.find((s: any) => s.type === 'hero')
    expect(heroAfter.settings.title).toBe('Care that moves with your family')
    expect(heroAfter.settings.image.alt).toBe('Nurse helping a patient') // admin's edit kept
    expect(draft.version).toBe(4)
    invalidateAll()
    expect((await renderPage(A, { kind: 'page', slug: '' }))?.sections[1].settings.title).toBe('Care that moves with you') // live page unchanged
    expect(fake.table('figmaFile')[0].version).toBe('43')
  })

  test('isolation: store B cannot read or change store A pages, imports or design system', async () => {
    expect((await pageRoute.GET(req(B, users.ownerB, '/x'), p({ id: pageId }))).status).toBe(404)
    expect((await draftRoute.PUT(req(B, users.ownerB, '/x', { method: 'PUT', body: JSON.stringify({ sections: [], revision: 0 }) }), p({ id: pageId }))).status).toBe(404)
    expect((await publishRoute.POST(req(B, users.ownerB, '/x', json({})), p({ id: pageId }))).status).toBe(404)
    expect((await importRoute.GET(req(B, users.ownerB, '/x'), p({ id: 'imp000000001' }))).status).toBe(404)
    expect(await (await pagesRoute.GET(req(B, users.ownerB, '/x'))).json()).toEqual([])
    expect((await (await systemRoute.GET(req(B, users.ownerB, '/x'))).json()).editing).toBeNull()
    expect((await pageRoute.GET(req(A, users.ownerB, '/x'), p({ id: pageId }))).status).toBe(403) // B's owner has no role in A
  })
})

describe('asset downloads (SSRF guard)', () => {
  test('only HTTPS on allowlisted hosts; redirects must stay on allowlisted hosts; size is capped', async () => {
    const { safeFetch, FIGMA_ASSET_HOSTS } = await import('../src/backend/lib/design-import/assets')
    server.use(
      http.get('https://s3-alpha-sig.figma.com/img/redirect-out', () => new HttpResponse(null, { status: 302, headers: { Location: 'https://169.254.169.254/latest/meta-data' } })),
      http.get('https://s3-alpha-sig.figma.com/img/redirect-in', () => new HttpResponse(null, { status: 302, headers: { Location: 'https://s3-alpha-sig.figma.com/img/hero' } })),
      http.get('https://s3-alpha-sig.figma.com/img/huge', () => new HttpResponse(new Uint8Array(2048))),
    )
    await expect(safeFetch('https://evil.example/x.png', FIGMA_ASSET_HOSTS)).rejects.toThrow('Blocked asset host evil.example')
    await expect(safeFetch('http://s3-alpha-sig.figma.com/img/hero', FIGMA_ASSET_HOSTS)).rejects.toThrow('Blocked')
    await expect(safeFetch('https://s3-alpha-sig.figma.com:8443/img/hero', FIGMA_ASSET_HOSTS)).rejects.toThrow('Blocked')
    await expect(safeFetch('https://s3-alpha-sig.figma.com/img/redirect-out', FIGMA_ASSET_HOSTS)).rejects.toThrow('Blocked asset host 169.254.169.254')
    expect((await safeFetch('https://s3-alpha-sig.figma.com/img/redirect-in', FIGMA_ASSET_HOSTS)).data.equals(png)).toBe(true)
    await expect(safeFetch('https://s3-alpha-sig.figma.com/img/huge', FIGMA_ASSET_HOSTS, 1024)).rejects.toThrow('too large')
  })
})

describe('Figma client', () => {
  beforeEach(() => { resetFigmaBuckets() })
  test('429 waits for Retry-After, then retries', async () => {
    const waits: number[] = []
    const sleep = timing.sleep
    timing.sleep = async (ms) => { waits.push(ms) }
    try {
      throttleOnce = true
      expect(await figmaRequest<{ ok: boolean }>('/v1/throttled', { type: 'PAT', token: 't', key: 'k' })).toEqual({ ok: true })
      expect(waits).toContain(2000)
    } finally { timing.sleep = sleep }
  })
  test('the token bucket spaces out bursts per connection', async () => {
    const waits: number[] = []
    const sleep = timing.sleep, now = timing.now
    let clock = 1_000_000
    timing.now = () => clock
    timing.sleep = async (ms) => { waits.push(ms); clock += ms }
    try {
      for (let i = 0; i < 12; i++) await figmaRequest('/v1/throttled', { type: 'PAT', token: 't', key: 'burst' })
      expect(waits.length).toBe(2) // 10 immediately, then one per 6 s
      expect(waits.every((w) => w >= 5000 && w <= 6000)).toBe(true)
    } finally { timing.sleep = sleep; timing.now = now }
  })
})
