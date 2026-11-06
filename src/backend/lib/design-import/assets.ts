// Asset pipeline: sniff, sanitize, deduplicate, store uploaded images.
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { encode as encodeBlurhash } from 'blurhash'
import { optimize } from 'svgo'
import DOMPurify from 'isomorphic-dompurify'
import type { StoreDb } from '@/backend/lib/tenancy'
import { putImage } from './storage'

const MAX_STORED_IMAGE_BYTES = 9.5 * 1024 * 1024

export class AssetError extends Error {}

/** Content type from the bytes, never from headers or names. */
export function sniff(data: Buffer): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml' | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 6 && /^GIF8[79]a$/.test(data.subarray(0, 6).toString('latin1'))) return 'image/gif'
  if (data.length >= 12 && data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  const head = data.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml'
  return null
}

// External references are removed: only same-document fragment links (#id) survive.
let hooked = false
function purifier() {
  if (!hooked) {
    hooked = true
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      for (const attr of ['href', 'xlink:href', 'src']) {
        const v = node.getAttribute?.(attr)
        if (v !== null && v !== undefined && !v.trim().startsWith('#')) node.removeAttribute(attr)
      }
      const style = node.getAttribute?.('style')
      if (style && /url\(\s*['"]?(?!#)/i.test(style)) node.setAttribute('style', style.replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none'))
      for (const name of node.getAttributeNames?.() ?? []) if (/^on/i.test(name)) node.removeAttribute(name)
    })
  }
  return DOMPurify
}

/** svgo then DOMPurify (SVG profile): no scripts, event handlers, foreignObject or external references. */
export function sanitizeSvg(svg: string): string {
  const optimized = optimize(svg, { multipass: true, plugins: ['preset-default', 'removeScripts'] }).data
  const clean = purifier().sanitize(optimized, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'embed', 'object'], FORBID_ATTR: ['onload', 'onerror'] })
  if (!/^<svg[\s>]/i.test(clean.trim())) throw new AssetError('SVG did not survive sanitizing')
  return clean
}

export const RESPONSIVE_WIDTHS = [320, 640, 960, 1280, 1920, 2560]

export type ProcessedImage = { data: Buffer; mime: string; format: string; width: number; height: number; blurhash: string | null }

/** Raster: auto-orient, strip metadata (sharp drops it unless asked), cap at 4096px, re-encode; blurhash for placeholders. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const mime = sniff(input)
  if (!mime) throw new AssetError('Unsupported or unrecognised image data')
  if (mime === 'image/svg+xml') {
    const svg = Buffer.from(sanitizeSvg(input.toString('utf8')))
    const meta = await sharp(svg).metadata().catch(() => ({ width: 24, height: 24 }))
    return { data: svg, mime, format: 'svg', width: meta.width ?? 24, height: meta.height ?? 24, blurhash: null }
  }
  const image = sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
  const format = mime === 'image/jpeg' ? 'jpeg' : mime === 'image/png' ? 'png' : 'webp'
  const encoded = format === 'jpeg' ? image.jpeg({ quality: 90, mozjpeg: true }) : format === 'png' ? image.png({ compressionLevel: 9 }) : image.webp({ quality: 90 })
  let { data, info } = await encoded.toBuffer({ resolveWithObject: true })
  let finalFormat: string = format
  // Storage rejects files over 10 MB (Cloudinary): large lossless PNG photos are re-encoded as WebP.
  if (data.length > MAX_STORED_IMAGE_BYTES) {
    ({ data, info } = await sharp(data).webp({ quality: 85, alphaQuality: 90 }).toBuffer({ resolveWithObject: true }))
    finalFormat = 'webp'
  }
  if (data.length > MAX_STORED_IMAGE_BYTES) throw new AssetError('Image is too large to store even after compression')
  const small = await sharp(data).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const blurhash = encodeBlurhash(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 4, 3)
  return { data, mime: `image/${finalFormat}`, format: finalFormat === 'jpeg' ? 'jpg' : finalFormat, width: info.width, height: info.height, blurhash }
}

export type StoredAsset = { id: string; url: string; width: number; height: number; blurhash: string | null; mime: string }

/** Stores processed bytes once per store (content hash); returns the existing asset on a duplicate. */
export async function storeAsset(ctx: { db: StoreDb; store: { id: string } }, image: ProcessedImage, meta: { sourceNodeId?: string; alt?: string }): Promise<StoredAsset> {
  const hash = createHash('sha256').update(image.data).digest('hex').slice(0, 40)
  const existing = await ctx.db.asset.findFirst({ where: { hash } })
  if (existing) return { id: existing.id, url: existing.url, width: existing.width, height: existing.height, blurhash: existing.blurhash, mime: existing.mime }
  const { key, url } = await putImage(ctx.store.id, hash, image.data, image.format)
  const variants = image.mime === 'image/svg+xml' ? [] : RESPONSIVE_WIDTHS.filter((w) => w < image.width).concat(image.width)
  const asset = await ctx.db.asset.create({
    data: { storeId: ctx.store.id, hash, sourceNodeId: meta.sourceNodeId ?? null, storageKey: key, url, mime: image.mime, width: image.width, height: image.height, variants, alt: (meta.alt ?? '').slice(0, 300), altReviewed: false, blurhash: image.blurhash },
  })
  return { id: asset.id, url: asset.url, width: asset.width, height: asset.height, blurhash: asset.blurhash, mime: asset.mime }
}
