import { cloudinary } from '@/backend/integrations/cloudinary'

type UploadResult = { secure_url: string; public_id: string; width?: number; height?: number; format?: string }

/** Use fetch multipart instead of Node streams: large streamed uploads can fail under Bun on Windows. */
export async function uploadDesignBuffer(data: Buffer, options: Record<string, unknown>): Promise<UploadResult> {
  const config = cloudinary.config()
  if (!config.cloud_name || !config.api_key || !config.api_secret) throw new Error('Configure Cloudinary before importing design assets')
  const { resource_type = 'image', ...rest } = options
  const params = { overwrite: true, invalidate: true, ...rest, timestamp: Math.floor(Date.now() / 1000) }
  const body = new FormData()
  for (const [key, value] of Object.entries(params)) body.set(key, String(value))
  body.set('api_key', config.api_key)
  body.set('signature', cloudinary.utils.api_sign_request(params, config.api_secret))
  body.set('file', new Blob([new Uint8Array(data)], { type: 'application/octet-stream' }), 'asset')
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloud_name)}/${resource_type}/upload`, {
    method: 'POST', body, signal: AbortSignal.timeout(120_000), redirect: 'error',
  })
  const result = await response.json().catch(() => null) as (UploadResult & { error?: { message?: string } }) | null
  if (!response.ok || !result?.secure_url || !result.public_id) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${result?.error?.message ?? 'Invalid response'}`)
  }
  return result
}

