// Serves public files of the local storage driver (DESIGN_STORAGE=local, development/E2E only). Figma snapshots
// are private and never served.
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { LOCAL, LOCAL_ROOT } from '@/backend/lib/design-import/storage'

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join('/')
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  if (!LOCAL || !/^tenants\/[\w-]+\/(assets|fonts)\/[\w./-]+$/.test(key) || key.includes('..') || !TYPES[ext]) return new Response('Not found', { status: 404 })
  const path = normalize(join(LOCAL_ROOT, key))
  if (!path.startsWith(LOCAL_ROOT)) return new Response('Not found', { status: 404 })
  try {
    return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': TYPES[ext], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', ...(ext === 'svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}) } })
  } catch { return new Response('Not found', { status: 404 }) }
}
