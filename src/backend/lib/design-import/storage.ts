// Object storage for the design pipeline, on Cloudinary (the store's existing media provider; see AUDIT.md C5).
// Every key is prefixed with tenants/{storeId}/ so stores never share paths.
//   tenants/{storeId}/figma/{fileKey}/{importId}.json.gz      raw Figma snapshot   (private raw)
//   tenants/{storeId}/figma/{fileKey}/{importId}.ir.json.gz   IR snapshot          (private raw)
//   tenants/{storeId}/assets/{hash}                            images and SVGs      (public image)
//   tenants/{storeId}/fonts/{family}/{file}.woff2              self-hosted fonts    (public raw)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { cloudinary } from '@/backend/integrations/cloudinary'

// DESIGN_STORAGE=local keeps everything under .design-storage/ (development and E2E without Cloudinary); public
// files are served by /api/design/storage/[...key]. Never used in production.
export const LOCAL = process.env.DESIGN_STORAGE === 'local' && process.env.NODE_ENV !== 'production'
export const LOCAL_ROOT = join(process.cwd(), '.design-storage')
async function localPut(key: string, data: Buffer) { const path = join(LOCAL_ROOT, key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); return `/api/design/storage/${key}` }

const KEY = /^tenants\/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+$/

function assertKey(key: string, storeId: string) {
  if (!KEY.test(key) || !key.startsWith(`tenants/${storeId}/`) || key.includes('..')) throw new Error('Invalid storage key')
}

type UploadResult = { secure_url: string; public_id: string; width?: number; height?: number; format?: string }

function upload(data: Buffer, options: Record<string, unknown>): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ overwrite: true, invalidate: true, ...options }, (error, res) =>
      (error || !res ? reject(error ?? new Error('Upload failed')) : resolve(res as UploadResult))).end(data)
  })
}

export const snapshotKey = (storeId: string, fileKey: string, importId: string, kind: 'raw' | 'ir') =>
  `tenants/${storeId}/figma/${fileKey}/${importId}${kind === 'ir' ? '.ir' : ''}.json.gz`

/** Gzipped JSON, private (authenticated delivery). */
export async function putSnapshot(storeId: string, key: string, value: unknown) {
  assertKey(key, storeId)
  const data = gzipSync(Buffer.from(JSON.stringify(value)))
  if (LOCAL) await localPut(key, data)
  else await upload(data, { resource_type: 'raw', type: 'authenticated', public_id: key })
  return key
}

export async function getSnapshot<T>(storeId: string, key: string): Promise<T> {
  assertKey(key, storeId)
  if (LOCAL) return JSON.parse(gunzipSync(await readFile(join(LOCAL_ROOT, key))).toString('utf8')) as T
  // Authenticated raw files are fetched through the signed Admin download API (a signed delivery URL answers 401).
  const url = cloudinary.utils.private_download_url(key, '', { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 300 })
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Snapshot download failed (${res.status})`)
  return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')) as T
}

/** Public image (raster or SVG). Cloudinary serves AVIF/WebP at requested widths from this master. */
export async function putImage(storeId: string, hash: string, data: Buffer, format: string) {
  const key = `tenants/${storeId}/assets/${hash}`
  assertKey(key, storeId)
  if (LOCAL) return { key, url: await localPut(`${key}.${format}`, data) }
  const res = await upload(data, { resource_type: 'image', type: 'upload', public_id: key, format, overwrite: false })
  return { key, url: res.secure_url }
}

export async function putFontFile(storeId: string, family: string, file: string, data: Buffer) {
  const key = `tenants/${storeId}/fonts/${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${file}`
  assertKey(key, storeId)
  if (LOCAL) return localPut(key, data)
  const res = await upload(data, { resource_type: 'raw', type: 'upload', public_id: key })
  return res.secure_url
}
