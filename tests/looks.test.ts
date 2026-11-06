/// <reference types="bun-types" />
// "Try the Look": stored pieces are validated on admin writes and read defensively.
import { beforeEach, describe, expect, mock, test } from 'bun:test'

const count = mock(async () => 2)
mock.module('@/backend/lib/db', () => ({ db: { product: { count } } }))

const { validateLookItems } = await import('../src/backend/routes/admin/content')
const { readLookPieces } = await import('../src/shared/looks')

const pieces = [{ productId: 'p1', x: 50, y: 30 }, { productId: 'p2', x: 48.5, y: 70 }]
const run = async (items: unknown) => {
  const data: Record<string, unknown> = { items: typeof items === 'string' || items === null ? items : JSON.stringify(items) }
  await validateLookItems(data)
  return data.items
}

beforeEach(() => { count.mockImplementation(async () => 2) })

describe('looks', () => {
  test('normalizes pieces and drops unknown keys', async () => {
    expect(await run([{ ...pieces[0], extra: 'dropped' }, pieces[1]])).toBe(JSON.stringify(pieces))
  })

  test('no pieces stores an empty list; updates without items are left alone', async () => {
    expect(await run(null)).toBe('[]')
    const data: Record<string, unknown> = { name: 'x' }
    await validateLookItems(data)
    expect('items' in data).toBe(false)
  })

  test('rejects malformed, out-of-range, duplicate, too many and unknown products', async () => {
    await expect(run('not json')).rejects.toThrow(/up to 6 products/)
    await expect(run([{ productId: 'p1', x: 120, y: 10 }])).rejects.toThrow(/pin position/)
    await expect(run([pieces[0], pieces[0]])).rejects.toThrow(/only be added to a look once/)
    await expect(run(Array.from({ length: 7 }, (_, i) => ({ productId: `p${i}`, x: 1, y: 1 })))).rejects.toThrow(/up to 6/)
    count.mockImplementation(async () => 1)
    await expect(run(pieces)).rejects.toThrow(/no longer exists/)
  })

  test('reads stored pieces defensively', () => {
    expect(readLookPieces(JSON.stringify(pieces))).toEqual(pieces)
    expect(readLookPieces('{oops')).toEqual([])
    expect(readLookPieces(null)).toEqual([])
    expect(readLookPieces(JSON.stringify([{ productId: 'p1' }]))).toEqual([])
  })
})
