// Figma webhook receiver (public). The passcode is checked in constant time against the hash stored for the
// webhook id; only then is the file marked as having an update. Answers quickly; no work beyond one update.
import { NextResponse } from 'next/server'
import { failure, HttpError } from '@/backend/lib/auth'
import { rateLimit } from '@/backend/lib/rate-limit'
import { clientIp } from '@/backend/lib/tenancy'
import { handleWebhook } from '@/backend/lib/figma/resync'

export async function POST(request: Request) {
  try {
    rateLimit(`figma-webhook:${clientIp(request) ?? 'unknown'}`, 120, 60_000)
    const raw = await request.text()
    if (raw.length > 20_000) throw new HttpError(413, 'Payload too large')
    let body: unknown
    try { body = JSON.parse(raw) } catch { throw new HttpError(400, 'Invalid JSON') }
    return NextResponse.json(await handleWebhook(body))
  } catch (error) { return failure(error) }
}
