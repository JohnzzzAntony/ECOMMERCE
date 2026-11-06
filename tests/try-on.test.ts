/// <reference types="bun-types" />
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import sharp from 'sharp'

const findUnique = mock(async () => ({ images: [{ imageUrl: 'https://cdn.example/dress.jpg' }] }))
mock.module('@/backend/lib/db', () => ({ db: { product: { findUnique } } }))

const { guessTryOnKind } = await import('../src/shared/try-on')
const { parseGradioStream, normalizeImage } = await import('../src/backend/lib/try-on')
const { POST } = await import('../src/backend/routes/catalog/try-on')
const { resetRateLimits } = await import('../src/backend/lib/rate-limit')

const jpeg = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#c00' } }).jpeg().toBuffer()
const photo = `data:image/jpeg;base64,${jpeg.toString('base64')}`
const realFetch = globalThis.fetch
let fetched: string[] = []

function request(body: unknown, ip = '1.2.3.4') {
  return new Request('http://shop.test/api/try-on', { method: 'POST', headers: { 'content-type': 'application/json', host: 'shop.test', origin: 'http://shop.test', 'x-real-ip': ip }, body: JSON.stringify(body) })
}

beforeEach(() => {
  resetRateLimits()
  fetched = []
  // Fake product CDN and FASHN Space: upload → call → SSE stream → result file.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    fetched.push(url)
    if (url === 'https://cdn.example/dress.jpg') return new Response(new Uint8Array(jpeg))
    if (url.endsWith('/gradio_api/upload')) return Response.json([`/tmp/gradio/${fetched.length}.jpg`])
    if (url.endsWith('/gradio_api/call/try_on')) return Response.json({ event_id: 'ev1' })
    if (url.endsWith('/gradio_api/call/try_on/ev1')) return new Response('event: heartbeat\ndata: null\n\nevent: complete\ndata: [{"url": "https://fashn-ai-fashn-vton-1-5.hf.space/gradio_api/file=/tmp/out.webp"}]\n')
    if (url.endsWith('/out.webp')) return new Response(new Uint8Array(jpeg))
    return new Response('not found', { status: 404 })
  }) as typeof fetch
})
afterAll(() => { globalThis.fetch = realFetch })

describe('AI try-on', () => {
  test.each([
    ['Red floral wrap dress', 'one-pieces'],
    ['Linen shirt dress', 'one-pieces'],
    ['Slim fit jeans', 'bottoms'],
    ['Cap sleeve blouse', 'tops'],
    ['Oversized hoodie', 'tops'],
    ['Aviator sunglasses', 'accessory'],
    ['Denim baseball cap', 'accessory'],
    ['Gold earrings', 'accessory'],
    ['Product 42', null],
  ])('guesses %s as %s', (name, kind) => {
    expect(guessTryOnKind(name)).toBe(kind as never)
  })

  test('falls back to the category name when the product name says nothing', () => {
    expect(guessTryOnKind('Summer Collection #3', 'Skirts')).toBe('bottoms')
  })

  test('reads the complete event of a Gradio stream and surfaces errors', () => {
    expect(parseGradioStream('event: heartbeat\ndata: null\n\nevent: complete\ndata: [1]\n')).toEqual([1])
    expect(() => parseGradioStream('event: error\ndata: "ZeroGPU quota exceeded"\n')).toThrow(/quota/)
    expect(() => parseGradioStream('event: heartbeat\ndata: null\n')).toThrow(/no result/)
  })

  test('normalizes photos to bounded JPEGs and rejects non-images', async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 4, background: '#0f0' } }).png().toBuffer()
    const meta = await sharp(await normalizeImage(big)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1024, 683])
    await expect(normalizeImage(Buffer.from('not an image'))).rejects.toThrow(/could not be read/)
  })

  test('returns the generated image and uses the product image from the database', async () => {
    const res = await POST(request({ productId: 'p1', category: 'one-pieces', photo }))
    expect(res.status).toBe(200)
    expect((await res.json()).image).toStartWith('data:image/jpeg;base64,')
    expect(fetched[0]).toBe('https://cdn.example/dress.jpg')
    expect(fetched.filter((u) => u.endsWith('/upload'))).toHaveLength(2)
  })

  test('validates input', async () => {
    expect((await POST(request({ productId: 'p1', category: 'hats', photo }))).status).toBe(400)
    expect((await POST(request({ productId: 'p1', category: 'tops', photo: 'data:image/svg+xml;base64,PHN2Zz4=' }))).status).toBe(400)
    expect((await POST(request({ productId: 'p1', category: 'tops', photo: 'data:image/png;base64,aGVsbG8=' }))).status).toBe(400)
    findUnique.mockImplementationOnce(async () => null as never)
    expect((await POST(request({ productId: 'missing', category: 'tops', photo }))).status).toBe(404)
  })

  test('rejects cross-site requests', async () => {
    const res = await POST(new Request('http://shop.test/api/try-on', { method: 'POST', headers: { host: 'shop.test', origin: 'https://evil.example' }, body: '{}' }))
    expect(res.status).toBe(403)
  })

  test('rate-limits each shopper', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await POST(request({ productId: 'p1', category: 'tops', photo }, '9.9.9.9'))).status)
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  test('reports the service as unavailable instead of leaking upstream errors', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes('cdn.example') ? new Response(new Uint8Array(jpeg)) : new Response('boom', { status: 500 })) as typeof fetch
    const res = await POST(request({ productId: 'p1', category: 'tops', photo }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/busy or unavailable/)
  })
})

test('reports an error event from the model (exhausted free GPU quota) as the usage limit', async () => {
  const fake = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).endsWith('/call/try_on/ev1') ? new Response('event: error\ndata: null\n') : fake(input)) as typeof fetch
  const res = await POST(request({ productId: 'p1', category: 'tops', photo }, '5.5.5.5'))
  expect(res.status).toBe(503)
  expect((await res.json()).error).toMatch(/usage limit/)
})
