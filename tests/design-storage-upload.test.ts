import { afterAll, beforeAll, expect, test } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { cloudinary } from '../src/backend/integrations/cloudinary'
import { uploadDesignBuffer } from '../src/backend/lib/design-import/cloudinary-upload'

const original = { ...cloudinary.config() }
const server = setupServer()
beforeAll(() => {
  cloudinary.config({ cloud_name: 'design-upload-test', api_key: 'test-key', api_secret: 'test-secret' })
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => { server.close(); cloudinary.config(original) })

test('uploads complete binary bytes as signed multipart and preserves private snapshot delivery', async () => {
  const data = Buffer.alloc(6 * 1024 * 1024, 97)
  server.use(http.post('https://api.cloudinary.com/v1_1/design-upload-test/raw/upload', async ({ request }) => {
    const body = await request.formData()
    expect(Buffer.from(await (body.get('file') as Blob).arrayBuffer()).equals(data)).toBe(true)
    expect(body.get('type')).toBe('authenticated')
    expect(body.get('api_key')).toBe('test-key')
    expect(body.has('api_secret')).toBe(false)
    const params = { overwrite: 'true', invalidate: 'true', type: 'authenticated', public_id: 'tenants/legacy/test.json.gz', timestamp: body.get('timestamp') }
    expect(body.get('signature')).toBe(cloudinary.utils.api_sign_request(params, 'test-secret'))
    return HttpResponse.json({ secure_url: 'https://res.cloudinary.com/test/snapshot', public_id: 'tenants/legacy/test.json.gz' })
  }))
  expect((await uploadDesignBuffer(data, { resource_type: 'raw', type: 'authenticated', public_id: 'tenants/legacy/test.json.gz' })).public_id).toBe('tenants/legacy/test.json.gz')
})

test('reports Cloudinary rejection instead of accepting an incomplete upload', async () => {
  server.use(http.post('https://api.cloudinary.com/v1_1/design-upload-test/image/upload', () => HttpResponse.json({ error: { message: 'Invalid request parameters' } }, { status: 400 })))
  await expect(uploadDesignBuffer(Buffer.from('image'), { public_id: 'tenants/legacy/test', overwrite: false })).rejects.toThrow('Cloudinary upload failed (400): Invalid request parameters')
})
