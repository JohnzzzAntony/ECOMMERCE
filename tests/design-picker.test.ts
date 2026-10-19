// Phase 3: Figma link parsing, responsive pairing, import plan validation, file structure, prototype flows,
// team browsing and queuing imports (RBAC + store isolation).
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import fileFixture from './__fixtures__/figma/file-depth3.json'
import nodesFixture from './__fixtures__/figma/nodes-prototype.json'
import { createFakeDb } from './helpers/fake-db'

process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long'
process.env.FIGMA_TOKEN_KEYS = `1:${randomBytes(32).toString('base64')}`

const fake = createFakeDb()
mock.module('@/backend/lib/db', () => ({ db: fake.db }))

const { parseFigmaLink, normalizeNodeId } = await import('../src/shared/figma-url')
const { frameDevice, guessPageType, importPlanSchema, pairFrames } = await import('../src/shared/design-plan')
const { structureFromFile } = await import('../src/backend/lib/figma/files')
const { encryptSecret } = await import('../src/backend/lib/figma/crypto')
const { signSession } = await import('../src/backend/lib/password')
const { invalidateAll } = await import('../src/backend/lib/memo')
const { resetRateLimits } = await import('../src/backend/lib/rate-limit')
const { resetFigmaBuckets } = await import('../src/backend/lib/figma/client')
const fileRoute = await import('../src/app/api/design/figma/files/[key]/route')
const thumbRoute = await import('../src/app/api/design/figma/files/[key]/thumbnails/route')
const flowRoute = await import('../src/app/api/design/figma/files/[key]/flow/route')
const teamRoute = await import('../src/app/api/design/figma/teams/[teamId]/route')
const projectRoute = await import('../src/app/api/design/figma/projects/[projectId]/route')
const importsRoute = await import('../src/app/api/design/imports/route')

const FILE_KEY = 'AbCdEfGhIj1234567890'

// ---------------------------------------------------------------- URL parser
describe('parseFigmaLink', () => {
  test('design, legacy file, prototype and branch links', () => {
    expect(parseFigmaLink(`https://www.figma.com/design/${FILE_KEY}/Store?node-id=1-2&t=x`))
      .toEqual({ kind: 'file', fileKey: FILE_KEY, branchKey: null, nodeId: '1:2', startNodeId: null })
    expect(parseFigmaLink(`https://figma.com/file/${FILE_KEY}/Store`)).toMatchObject({ kind: 'file', fileKey: FILE_KEY, nodeId: null })
    expect(parseFigmaLink(`https://www.figma.com/proto/${FILE_KEY}/Store?node-id=12-34&starting-point-node-id=12%3A34`))
      .toMatchObject({ kind: 'file', nodeId: '12:34', startNodeId: '12:34' })
    expect(parseFigmaLink(`https://www.figma.com/design/${FILE_KEY}/branch/ZyXwVuTsRq0987654321/Store`))
      .toMatchObject({ fileKey: FILE_KEY, branchKey: 'ZyXwVuTsRq0987654321' })
  })
  test('team links (with and without org)', () => {
    expect(parseFigmaLink('https://www.figma.com/files/team/1234567890123/Acme')).toEqual({ kind: 'team', teamId: '1234567890123' })
    expect(parseFigmaLink('https://www.figma.com/files/9988776655/team/1234567890123/Acme')).toEqual({ kind: 'team', teamId: '1234567890123' })
  })
  test('rejects FigJam, Slides, other hosts and junk', () => {
    expect(() => parseFigmaLink(`https://www.figma.com/board/${FILE_KEY}/Ideas`)).toThrow('FigJam')
    expect(() => parseFigmaLink(`https://www.figma.com/slides/${FILE_KEY}/Deck`)).toThrow('Slides')
    expect(() => parseFigmaLink(`https://evil.com/design/${FILE_KEY}/x`)).toThrow('not a figma.com link')
    expect(() => parseFigmaLink(`http://www.figma.com/design/${FILE_KEY}/x`)).toThrow()
    expect(() => parseFigmaLink('https://www.figma.com/design/short/x')).toThrow('file key')
    expect(() => parseFigmaLink('not a url')).toThrow('https://')
  })
  test('node ids: "1-2" → "1:2"; garbage → null', () => {
    expect(normalizeNodeId('1-2')).toBe('1:2')
    expect(normalizeNodeId('1:2')).toBe('1:2')
    expect(normalizeNodeId('abc')).toBeNull()
  })
})

// ---------------------------------------------------------------- pairing + plan
describe('pairing and page types', () => {
  test('device from name token, else from width', () => {
    expect(frameDevice({ id: '1', name: 'Home / Desktop', width: 375, height: 1 })).toEqual({ base: 'Home', device: 'desktop', named: true })
    expect(frameDevice({ id: '1', name: 'Home @mobile', width: 1440, height: 1 })).toMatchObject({ base: 'Home', device: 'mobile' })
    expect(frameDevice({ id: '1', name: 'About', width: 1200, height: 1 }).device).toBe('desktop')
    expect(frameDevice({ id: '1', name: 'About', width: 1199, height: 1 }).device).toBe('tablet')
    expect(frameDevice({ id: '1', name: 'About', width: 768, height: 1 }).device).toBe('tablet')
    expect(frameDevice({ id: '1', name: 'About', width: 767, height: 1 }).device).toBe('mobile')
  })

  test('pairs by name and by width; guesses types; one HOME only', () => {
    const plan = pairFrames([
      { id: '1:1', name: 'Home / Desktop', width: 1440, height: 1 },
      { id: '1:2', name: 'Home / Mobile', width: 375, height: 1 },
      { id: '1:3', name: 'Product', width: 1440, height: 1 },
      { id: '1:4', name: 'Product', width: 390, height: 1 },
      { id: '1:5', name: 'About us', width: 1440, height: 1 },
      { id: '1:6', name: 'About us', width: 1440, height: 1 },
      { id: '1:7', name: 'Homepage v2', width: 1440, height: 1 },
    ])
    expect(plan).toEqual([
      { title: 'Home', type: 'HOME', layout: 'exact', frames: { desktop: '1:1', mobile: '1:2' } },
      { title: 'Product', type: 'PRODUCT_TEMPLATE', layout: 'sections', frames: { desktop: '1:3', mobile: '1:4' } },
      { title: 'About us', type: 'PAGE', layout: 'exact', slug: 'about-us', frames: { desktop: '1:5' } },
      { title: 'About us', type: 'PAGE', layout: 'exact', slug: 'about-us-2', frames: { desktop: '1:6' } },
      { title: 'Homepage v2', type: 'PAGE', layout: 'exact', slug: 'homepage-v2', frames: { desktop: '1:7' } },
    ])
  })

  test('type guesses', () => {
    expect(guessPageType('Site header')).toBe('HEADER')
    expect(guessPageType('Footer')).toBe('FOOTER')
    expect(guessPageType('Shopping cart')).toBe('CART')
    expect(guessPageType('Category listing')).toBe('COLLECTION_TEMPLATE')
    expect(guessPageType('Contact')).toBe('PAGE')
  })

  test('plan schema enforces single types, slugs, unique frames', () => {
    const page = (over: object) => ({ title: 'P', type: 'PAGE', slug: 'p', frames: { desktop: '1:1' }, ...over })
    const check = (pages: object[]) => importPlanSchema.safeParse({ fileKey: FILE_KEY, pages })
    expect(check([page({})]).success).toBe(true)
    expect(check([]).error?.issues[0].message).toBe('Select at least one frame')
    expect(check([page({ type: 'HOME', slug: undefined }), page({ type: 'HOME', slug: undefined, frames: { desktop: '1:2' } })]).error?.issues[0].message).toContain('Only one page')
    expect(check([page({ slug: undefined })]).error?.issues[0].message).toContain('needs a URL slug')
    expect(check([page({}), page({ frames: { desktop: '1:2' } })]).error?.issues[0].message).toContain('used twice')
    expect(check([page({}), page({ slug: 'q' })]).error?.issues[0].message).toContain('only one page')
    expect(check([page({ frames: {} })]).error?.issues[0].message).toContain('at least one frame')
    expect(check([page({ slug: 'Bad Slug' })]).success).toBe(false)
    expect(check([page({ frames: { desktop: '1:1;2:3' } })]).success).toBe(false)
  })
})

// ---------------------------------------------------------------- structure
test('structure: pages, top-level frames incl. frames in sections, flows; other node types ignored', () => {
  const s = structureFromFile(fileFixture as any, FILE_KEY, null)
  expect(s).toMatchObject({ name: 'Medi Store Redesign', version: '2130034450', lastModified: '2026-10-10T09:30:00Z' })
  expect(s.pages.map((p) => p.name)).toEqual(['Web', 'Archive'])
  expect(s.pages[0].flows).toEqual([{ nodeId: '1:1', name: 'Shop flow' }])
  expect(s.pages[0].frames.map((f) => [f.id, f.width, f.section])).toEqual([
    ['1:1', 1440, null], ['1:2', 375, null], ['1:3', 1440, null], ['1:4', 390, null], ['1:5', 1440, null], ['2:2', 1280, 'Checkout'],
  ])
  expect(() => structureFromFile({ ...(fileFixture as any), editorType: 'figjam' }, FILE_KEY, null)).toThrow('Only Figma Design files')
})

// ---------------------------------------------------------------- routes (MSW + fake DB)
const figmaCalls: string[] = []
let v2Status = 200
const server = setupServer(
  http.get(`https://api.figma.com/v1/files/:key`, ({ params, request }) => {
    figmaCalls.push(new URL(request.url).pathname + new URL(request.url).search)
    if (params.key === 'NotFoundFile0000') return HttpResponse.json({ status: 404, err: 'Not found' }, { status: 404 })
    return HttpResponse.json(fileFixture)
  }),
  http.get(`https://api.figma.com/v1/files/:key/nodes`, ({ request }) => {
    const ids = new URL(request.url).searchParams.get('ids')!.split(',')
    figmaCalls.push(`nodes:${ids.join(',')}`)
    const all = nodesFixture as Record<string, unknown>
    return HttpResponse.json({ name: 'x', nodes: Object.fromEntries(ids.map((id) => [id, all[id] ? { document: all[id] } : null])) })
  }),
  http.get(`https://api.figma.com/v1/images/:key`, ({ request }) => {
    const url = new URL(request.url)
    figmaCalls.push(`images:${url.searchParams.get('scale')}:${url.searchParams.get('format')}`)
    return HttpResponse.json({ err: null, images: Object.fromEntries(url.searchParams.get('ids')!.split(',').map((id) => [id, `https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/${id}.png`])) })
  }),
  http.get('https://api.figma.com/v2/teams/:id/folders', () => (v2Status === 200 ? HttpResponse.json({ folders: [{ id: '111', name: 'Web' }] }) : HttpResponse.json({ status: v2Status, err: 'no' }, { status: v2Status }))),
  http.get('https://api.figma.com/v1/teams/:id/projects', () => HttpResponse.json({ name: 'Team', projects: [{ id: 222, name: 'Legacy project' }] })),
  http.get('https://api.figma.com/v2/folders/:id/files', () => HttpResponse.json({ files: [{ key: FILE_KEY, name: 'Medi Store Redesign', thumbnail_url: 'https://x/t.png', last_modified: '2026-10-10T09:30:00Z' }, { key: 'bad', name: 'junk' }] })),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const users = {
  editorA: { id: 'u_ed_a', email: 'e@a.test', password: 'pa', role: 'staff', isActive: true },
  viewerA: { id: 'u_vw_a', email: 'v@a.test', password: 'pv', role: 'staff', isActive: true },
  ownerB: { id: 'u_ow_b', email: 'o@b.test', password: 'pb', role: 'admin', isActive: true },
}

beforeEach(() => {
  fake.reset(); invalidateAll(); resetRateLimits(); resetFigmaBuckets(); figmaCalls.length = 0; v2Status = 200
  fake.table('store').push(
    { id: 'legacy', slug: 'legacy', name: 'A', domain: 'shop-a.test' },
    { id: 'store_b', slug: 'b', name: 'B', domain: 'shop-b.test' },
  )
  fake.table('user').push(...Object.values(users).map((u) => ({ ...u })))
  fake.table('storeMember').push(
    { id: 'm1', storeId: 'legacy', userId: users.editorA.id, role: 'EDITOR' },
    { id: 'm2', storeId: 'legacy', userId: users.viewerA.id, role: 'VIEWER' },
    { id: 'm3', storeId: 'store_b', userId: users.ownerB.id, role: 'OWNER' },
  )
  for (const storeId of ['legacy', 'store_b']) {
    const enc = encryptSecret('figd_pat_for_tests_000000', `figma:${storeId}:access`)
    fake.table('figmaConnection').push({ id: `conn_${storeId}`, storeId, figmaUserId: '1', handle: 'h', authType: 'PAT', accessTokenEnc: enc.ciphertext, keyVersion: enc.keyVersion, status: 'ACTIVE', expiresAt: null })
  }
})

function req(host: string, user: { id: string; password: string }, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('host', host)
  headers.set('cookie', `commerce_session=${signSession(user.id, user.password)}`)
  if (init.method && init.method !== 'GET') headers.set('origin', `https://${host}`)
  return new Request(`https://${host}${path}`, { ...init, headers })
}
const p = <T extends object>(v: T) => ({ params: Promise.resolve(v) })

test('GET file structure (depth=3) and branch key used as the API key', async () => {
  const res = await fileRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}`), p({ key: FILE_KEY }))
  expect(res.status).toBe(200)
  expect((await res.json()).pages).toHaveLength(2)
  expect(figmaCalls[0]).toBe(`/v1/files/${FILE_KEY}?depth=3`)
  await fileRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}?branch=ZyXwVuTsRq0987654321`), p({ key: FILE_KEY }))
  expect(figmaCalls[1]).toBe('/v1/files/ZyXwVuTsRq0987654321?depth=3')
  const missing = await fileRoute.GET(req('shop-a.test', users.editorA, '/api/design/figma/files/NotFoundFile0000'), p({ key: 'NotFoundFile0000' }))
  expect(missing.status).toBe(404)
})

test('thumbnails: low scale PNG, id validation', async () => {
  const ok = await thumbRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}/thumbnails?ids=1:1,1:2`), p({ key: FILE_KEY }))
  expect(Object.keys((await ok.json()).images)).toEqual(['1:1', '1:2'])
  expect(figmaCalls).toContain('images:0.25:png')
  const bad = await thumbRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}/thumbnails?ids=1:1,drop table`), p({ key: FILE_KEY }))
  expect(bad.status).toBe(400)
})

test('prototype flow: follows NAVIGATE links and transitionNodeID, ignores SCROLL_TO and URL actions', async () => {
  const res = await flowRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}/flow?start=1:1`), p({ key: FILE_KEY }))
  expect((await res.json()).nodeIds.sort()).toEqual(['1:1', '1:3', '2:2'])
  const notFrame = await flowRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/files/${FILE_KEY}/flow?start=5:1`), p({ key: FILE_KEY }))
  expect(notFrame.status).toBe(400)
})

test('team browsing: v2 folders, falling back to v1 projects; files filtered', async () => {
  const teamId = '1234567890123'
  let res = await teamRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/teams/${teamId}`), p({ teamId }))
  expect((await res.json()).projects).toEqual([{ id: '111', name: 'Web' }])
  v2Status = 404
  res = await teamRoute.GET(req('shop-a.test', users.editorA, `/api/design/figma/teams/${teamId}`), p({ teamId }))
  expect((await res.json()).projects).toEqual([{ id: '222', name: 'Legacy project' }])
  const files = await projectRoute.GET(req('shop-a.test', users.editorA, '/api/design/figma/projects/111'), p({ projectId: '111' }))
  expect((await files.json()).files).toEqual([{ key: FILE_KEY, name: 'Medi Store Redesign', thumbnailUrl: 'https://x/t.png', lastModified: '2026-10-10T09:30:00Z' }])
})

const plan = {
  fileKey: FILE_KEY,
  pages: [
    { title: 'Home', type: 'HOME', frames: { desktop: '1:1', mobile: '1:2' } },
    { title: 'About us', type: 'PAGE', slug: 'about-us', frames: { desktop: '1:5' } },
    { title: 'Cart', type: 'CART', frames: { desktop: '2:2' } },
  ],
}
const post = (host: string, user: { id: string; password: string }, body: unknown) =>
  importsRoute.POST(req(host, user, '/api/design/imports', { method: 'POST', body: JSON.stringify(body) }))

test('queue import: validates against the file, stores FigmaFile + QUEUED DesignImport, audits', async () => {
  const res = await post('shop-a.test', users.editorA, plan)
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body).toMatchObject({ status: 'QUEUED', figmaVersion: '2130034450', frameCount: 4, file: { fileKey: FILE_KEY, name: 'Medi Store Redesign', branchKey: null } })
  expect(fake.table('figmaFile')).toMatchObject([{ storeId: 'legacy', fileKey: FILE_KEY, branchKey: '', version: '2130034450', connectionId: 'conn_legacy' }])
  expect(fake.table('designImport')).toMatchObject([{ storeId: 'legacy', status: 'QUEUED', selectedNodeIds: ['1:1', '1:2', '1:5', '2:2'], createdBy: users.editorA.id }])
  expect(body.pages.map((page: { layout: string }) => page.layout)).toEqual(['exact', 'exact', 'sections'])
  expect(fake.table('auditLog').at(-1)).toMatchObject({ action: 'design.import.create', storeId: 'legacy' })

  // A second import of the same file reuses the FigmaFile row.
  expect((await post('shop-a.test', users.editorA, plan)).status).toBe(201)
  expect(fake.table('figmaFile')).toHaveLength(1)
})

test('queue import rejects frames that are not top-level frames of the file, and invalid plans', async () => {
  const res = await post('shop-a.test', users.editorA, { ...plan, pages: [{ title: 'X', type: 'PAGE', slug: 'x', frames: { desktop: '5:1' } }] })
  expect(res.status).toBe(400)
  expect((await res.json()).error).toContain('not a top-level frame')
  expect((await post('shop-a.test', users.editorA, { ...plan, pages: [] })).status).toBe(400)
  expect(fake.table('designImport')).toHaveLength(0)
})

test('RBAC: viewers can list imports but cannot browse Figma or queue imports', async () => {
  expect((await post('shop-a.test', users.viewerA, plan)).status).toBe(403)
  expect((await fileRoute.GET(req('shop-a.test', users.viewerA, `/api/design/figma/files/${FILE_KEY}`), p({ key: FILE_KEY }))).status).toBe(403)
  expect((await importsRoute.GET(req('shop-a.test', users.viewerA, '/api/design/imports'))).status).toBe(200)
  expect(figmaCalls).toHaveLength(0)
})

test('isolation: store B sees none of store A\'s imports, and its imports use its own Figma connection', async () => {
  await post('shop-a.test', users.editorA, plan)
  const b = await importsRoute.GET(req('shop-b.test', users.ownerB, '/api/design/imports'))
  expect(await b.json()).toEqual([])
  expect((await post('shop-b.test', users.ownerB, plan)).status).toBe(201)
  expect(fake.table('figmaFile').map((f) => [f.storeId, f.connectionId])).toEqual([['legacy', 'conn_legacy'], ['store_b', 'conn_store_b']])
  const a = await importsRoute.GET(req('shop-a.test', users.editorA, '/api/design/imports'))
  expect((await a.json()).length).toBe(1)
  // A's editor has no role in store B.
  expect((await importsRoute.GET(req('shop-b.test', users.editorA, '/api/design/imports'))).status).toBe(403)
})

test('queue import preserves an explicitly chosen section layout', async () => {
  const res = await post('shop-a.test', users.editorA, { ...plan, pages: [{ ...plan.pages[0], layout: 'sections' }] })
  expect(res.status).toBe(201)
  expect((await res.json()).pages[0].layout).toBe('sections')
})
