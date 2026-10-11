import { expect, test } from 'bun:test'
import { sizedImage } from '../src/frontend/lib/image'

test('resizes Cloudinary and Shopify images, leaves others alone', () => {
  expect(sizedImage('https://res.cloudinary.com/x/image/upload/v1/products/a.jpg', 600)).toBe('https://res.cloudinary.com/x/image/upload/w_600,c_limit,q_auto,f_auto/v1/products/a.jpg')
  expect(sizedImage('https://res.cloudinary.com/x/image/upload/q_auto,f_auto/products/a.jpg', 600)).toBe('https://res.cloudinary.com/x/image/upload/q_auto,f_auto/products/a.jpg')
  expect(sizedImage('https://cdn.shopify.com/s/files/a.jpg?v=1', 600)).toBe('https://cdn.shopify.com/s/files/a.jpg?v=1&width=600')
  expect(sizedImage('https://example.com/a.jpg', 600)).toBe('https://example.com/a.jpg')
  expect(sizedImage(null, 600)).toBe('')
})
