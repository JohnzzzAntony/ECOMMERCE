// Same-origin guard used by every state-changing API route.
import { expect, test } from 'bun:test'
import { checkOrigin, HttpError } from '../src/backend/lib/auth'

const post = (headers: Record<string, string>) =>
  new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers })

test('accepts same-host origin even when the server binds to another address', () => {
  expect(() => checkOrigin(post({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }))).not.toThrow()
  expect(() => checkOrigin(post({ origin: 'https://shop.example.com', host: 'localhost:3000', 'x-forwarded-host': 'shop.example.com' }))).not.toThrow()
})

test('rejects cross-site and malformed origins', () => {
  expect(() => checkOrigin(post({ origin: 'https://evil.example', host: 'shop.example.com' }))).toThrow(HttpError)
  expect(() => checkOrigin(post({ origin: 'null', host: 'shop.example.com' }))).toThrow(HttpError)
  expect(() => checkOrigin(post({ host: 'shop.example.com', 'sec-fetch-site': 'cross-site' }))).toThrow(HttpError)
})

test('ignores safe methods', () => {
  expect(() => checkOrigin(new Request('http://localhost:3000/', { headers: { origin: 'https://evil.example' } }))).not.toThrow()
})

test('a database refusing queries (quota exceeded) answers 503 with a clear message', async () => {
  const { failure } = await import('../src/backend/lib/auth')
  const res = failure(new Error('Invalid `db.user.findUnique()` invocation:\nError querying the database: ERROR: Your account or project has exceeded the quota. Upgrade your plan to increase limits.'))
  expect(res.status).toBe(503)
  expect((await res.json()).error).toMatch(/database is unavailable/)
  expect(failure(new Error('something else')).status).toBe(500)
})
