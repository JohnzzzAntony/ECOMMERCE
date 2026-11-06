// AI try-on through the FASHN VTON v1.5 Hugging Face Space (Apache-2.0; tops, bottoms, one-pieces).
// Images only pass through memory: nothing is written to the database, disk or Cloudinary here.
// The Space runs on shared ZeroGPU with a daily quota per caller; HF_TOKEN (optional, free account) raises it.
import sharp from 'sharp'
import { HttpError } from '@/backend/lib/auth'
import type { TryOnCategory } from '@/shared/try-on'

const SPACE = 'https://fashn-ai-fashn-vton-1-5.hf.space'
const API = `${SPACE}/gradio_api`
const TIMEOUT_MS = 150_000

/** Re-encodes an image as a JPEG of at most `max` px on the long edge, applying and then dropping EXIF (GPS etc.). */
export async function normalizeImage(input: Buffer, max = 1024): Promise<Buffer> {
  try {
    return await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(max, max, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()
  } catch {
    throw new HttpError(400, 'That photo could not be read. Try a JPEG or PNG.')
  }
}

function headers(extra: Record<string, string> = {}) {
  const token = process.env.HF_TOKEN?.trim()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

async function upload(image: Buffer, name: string, signal: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('files', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), name)
  const res = await fetch(`${API}/upload`, { method: 'POST', body: form, headers: headers(), signal })
  if (!res.ok) throw new Error(`upload ${res.status}`)
  const [path] = (await res.json()) as string[]
  if (typeof path !== 'string') throw new Error('upload returned no path')
  return path
}

/** Reads the Gradio SSE stream and returns the data of the `complete` event (or throws on `error`). */
export function parseGradioStream(text: string): unknown {
  let event = ''
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:') && (event === 'complete' || event === 'error')) {
      const data = line.slice(5).trim()
      if (event === 'error') throw new TryOnUnavailable(data && data !== 'null' ? data : 'The try-on model reported an error')
      return JSON.parse(data)
    }
  }
  throw new TryOnUnavailable('The try-on model returned no result')
}

class TryOnUnavailable extends Error {}

/** Dresses the person in the garment. Both inputs are normalized JPEGs; returns the result as a JPEG. */
export async function runTryOn(person: Buffer, garment: Buffer, category: TryOnCategory): Promise<Buffer> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const [personPath, garmentPath] = await Promise.all([upload(person, 'person.jpg', signal), upload(garment, 'garment.jpg', signal)])
    const file = (path: string) => ({ path, meta: { _type: 'gradio.FileData' } })
    // person, garment, category, garment photo type, timesteps, guidance, seed, segmentation-free.
    // "model" works for both on-model and flat-lay product photos in testing, so it is fixed.
    const call = await fetch(`${API}/call/try_on`, {
      method: 'POST', signal, headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: [file(personPath), file(garmentPath), category, 'model', 30, 1.5, 42, true] }),
    })
    if (!call.ok) throw new Error(`call ${call.status}`)
    const { event_id } = (await call.json()) as { event_id?: string }
    if (!event_id) throw new Error('call returned no event id')
    const stream = await fetch(`${API}/call/try_on/${encodeURIComponent(event_id)}`, { headers: headers(), signal })
    if (!stream.ok) throw new Error(`result ${stream.status}`)
    const [output] = parseGradioStream(await stream.text()) as [{ url?: string } | undefined]
    // Only fetch files served by the Space itself.
    const url = output?.url && new URL(output.url)
    if (!url || url.origin !== SPACE) throw new Error('unexpected result url')
    const image = await fetch(url, { headers: headers(), signal })
    if (!image.ok) throw new Error(`download ${image.status}`)
    return await normalizeImage(Buffer.from(await image.arrayBuffer()), 1536)
  } catch (error) {
    console.error('AI try-on failed:', error instanceof Error ? error.message : error)
    // The Space reports an exhausted ZeroGPU quota as an error event without details (we always send valid
    // inputs), so any error event from the model is treated as the usage limit; network/HTTP failures are not.
    throw new HttpError(503, error instanceof TryOnUnavailable
      ? 'The free try-on service has reached its usage limit for now. Please try again later.'
      : 'The try-on service is busy or unavailable right now. Please try again in a minute.')
  }
}
