// Field allowlist/validation used by every admin write endpoint.
import { expect, test } from 'bun:test'
import { parseFields, uniqueSlug, type Fields } from '../src/backend/lib/admin-resource'
import { HttpError } from '../src/backend/lib/auth'

const fields: Fields = {
  name: { type: 'text', required: true, max: 10 },
  note: { type: 'text' },
  price: { type: 'number', required: true, min: 0 },
  sale: { type: 'number', min: 0 },
  rating: { type: 'int', min: 1, max: 5 },
  active: { type: 'bool' },
  parentId: { type: 'ref' },
}

test('keeps only listed fields and normalises blanks to null', () => {
  const data = parseFields({ name: ' Chair ', note: '', price: '12.5', sale: '', parentId: '', role: 'admin', id: 'x' }, fields)
  expect(data).toEqual({ name: 'Chair', note: null, price: 12.5, sale: null, parentId: null })
})

test('create requires required fields; partial update does not', () => {
  expect(() => parseFields({ price: 1 }, fields)).toThrow(HttpError)
  expect(parseFields({ rating: 4 }, fields, true)).toEqual({ rating: 4 })
})

test('rejects wrong types and out-of-range values', () => {
  expect(() => parseFields({ name: 'a', price: 1, rating: 6 }, fields)).toThrow('rating must be at most 5')
  expect(() => parseFields({ name: 'a', price: -1 }, fields)).toThrow('price must be at least 0')
  expect(() => parseFields({ name: 'a', price: 'abc' }, fields)).toThrow('Invalid price')
  expect(() => parseFields({ name: 'a', price: 1, rating: 2.5 }, fields)).toThrow('Invalid rating')
  expect(() => parseFields({ name: 'a', price: 1, active: 'yes' }, fields)).toThrow('Invalid active')
  expect(() => parseFields({ name: 'way too long', price: 1 }, fields)).toThrow('Invalid name')
  expect(() => parseFields({ name: '   ', price: 1 }, fields)).toThrow(HttpError)
})

test('uniqueSlug appends a counter until free', async () => {
  const taken = new Set(['home-care', 'home-care-2'])
  expect(await uniqueSlug('Home Care', async (s) => taken.has(s))).toBe('home-care-3')
  expect(await uniqueSlug('New One', async (s) => taken.has(s))).toBe('new-one')
})
