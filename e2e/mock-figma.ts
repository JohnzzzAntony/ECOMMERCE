// Mock Figma for E2E: OAuth authorize/token, /v1/me, file structure, nodes, image fills, renders and asset bytes,
// all from the recorded fixtures in tests/__fixtures__/figma. Started by playwright.config.ts.
import sharp from 'sharp'
import fixture from '../tests/__fixtures__/figma/nodes-store.json'

const PORT = Number(process.env.MOCK_FIGMA_PORT ?? 4010)
const ORIGIN = `http://127.0.0.1:${PORT}`
const png = await sharp({ create: { width: 1440, height: 640, channels: 3, background: '#0d6b8c' } }).png().toBuffer()
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#00b3d9"/></svg>'
const nodes = fixture.nodes as Record<string, { document: Record<string, unknown> }>
const version = process.env.MOCK_FIGMA_VERSION ?? '42'

const shallow = (n: Record<string, any>, depth: number): Record<string, unknown> => ({ ...n, children: depth > 0 ? (n.children ?? []).map((c: any) => shallow(c, depth - 1)) : undefined })
const json = (body: unknown, status = 200) => Response.json(body, { status })

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    if (path === '/oauth') {
      const back = new URL(url.searchParams.get('redirect_uri')!)
      back.searchParams.set('code', 'mock-code'); back.searchParams.set('state', url.searchParams.get('state')!)
      return Response.redirect(back.toString(), 302)
    }
    if (path === '/v1/oauth/token' && req.method === 'POST') return json({ access_token: 'figu_mock_access', token_type: 'bearer', expires_in: 7776000, refresh_token: 'figur_mock_refresh', user_id_string: '42' })
    if (path === '/v1/me') return json({ id: '42', handle: 'E2E Designer', email: 'designer@example.com' })
    let m = path.match(/^\/v1\/files\/([^/]+)\/nodes$/)
    if (m) {
      const ids = url.searchParams.get('ids')!.split(',')
      return json({ name: fixture.name, nodes: Object.fromEntries(ids.map((id) => [id, nodes[id] ?? null])) })
    }
    if ((m = path.match(/^\/v1\/files\/([^/]+)\/images$/))) return json({ meta: { images: { 'img-hero': `${ORIGIN}/assets/png/hero`, 'img-p1': `${ORIGIN}/assets/png/p1`, 'img-p2': `${ORIGIN}/assets/png/p2` } } })
    if ((m = path.match(/^\/v1\/files\/([^/]+)\/meta$/))) return json({ file: { version } })
    if ((m = path.match(/^\/v1\/files\/([^/]+)$/))) {
      const depth = Number(url.searchParams.get('depth') ?? 99)
      const frames = Object.values(nodes).map((n) => shallow(n.document, Math.max(0, depth - 2)))
      return json({ name: fixture.name, version, lastModified: fixture.lastModified, editorType: 'figma', thumbnailUrl: null, document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Web', type: 'CANVAS', flowStartingPoints: [], children: depth >= 2 ? frames : undefined }] } })
    }
    if ((m = path.match(/^\/v1\/images\/([^/]+)$/))) {
      const format = url.searchParams.get('format') ?? 'png'
      return json({ err: null, images: Object.fromEntries(url.searchParams.get('ids')!.split(',').map((id) => [id, `${ORIGIN}/assets/${format === 'svg' ? 'svg' : 'png'}/${encodeURIComponent(id)}`])) })
    }
    if (path.startsWith('/assets/png/')) return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
    if (path.startsWith('/assets/svg/')) return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
    return json({ status: 404, err: 'Not found' }, 404)
  },
})
console.log(`mock figma on ${ORIGIN}`)
