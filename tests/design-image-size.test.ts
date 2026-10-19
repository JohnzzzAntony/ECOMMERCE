import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { processImage } from '../src/backend/lib/design-import/assets'
test('a PNG photo over the storage limit is re-encoded as WebP', async () => {
  // A photo-like image: gradient plus fine grain, which PNG can't compress well but WebP can.
  const W = 3000, grain = randomBytes(W * W * 3), px = Buffer.alloc(W * W * 3)
  for (let i = 0; i < px.length; i++) px[i] = (((i / 3) % W) / W) * 200 + (grain[i] & 31)
  const png = await sharp(px, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer()
  expect(png.length).toBeGreaterThan(9.5 * 1024 * 1024)
  const out = await processImage(png)
  expect(out.mime).toBe('image/webp')
  expect(out.data.length).toBeLessThan(9.5 * 1024 * 1024)
}, 60_000)
