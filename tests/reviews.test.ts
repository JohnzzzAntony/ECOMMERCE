/// <reference types="bun-types" />
import { expect, mock, test } from 'bun:test'

const created = { id: 'review-1', rating: 4 }
const create = mock(async () => created)
const aggregate = mock(async () => ({ _sum: { rating: 13 }, _count: 3 }))
const update = mock(async () => ({}))
mock.module('@/backend/lib/db', () => ({ db: { productReview: { create, aggregate }, product: { update } } }))
const { POST } = await import('../src/backend/routes/catalog/reviews')
const { NextRequest } = await import('next/server')

test('review submission preserves response and rounds approved ratings to one decimal', async () => {
  const response = await POST(new NextRequest('http://localhost/api/reviews', {
    method: 'POST', body: JSON.stringify({ productId: 'product-1', authorName: 'Customer', rating: 4, reviewText: 'Good' }),
  }))
  expect(await response.json()).toEqual({ ok: true, review: created })
  expect(aggregate).toHaveBeenCalledWith({ where: { productId: 'product-1', isApproved: true }, _sum: { rating: true }, _count: true })
  expect(update).toHaveBeenCalledWith({ where: { id: 'product-1' }, data: { ratingAvg: 4.3, ratingCount: 3 } })
})

test('missing review fields still return 400 without writes', async () => {
  create.mockClear()
  const response = await POST(new NextRequest('http://localhost/api/reviews', { method: 'POST', body: '{}' }))
  expect(response.status).toBe(400)
  expect(create).not.toHaveBeenCalled()
})
