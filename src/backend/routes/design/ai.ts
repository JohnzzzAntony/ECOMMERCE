// AI section generator API: screenshots / video frames / code / instructions in, custom-code section settings out.
// The editor inserts the result as a draft section; publishing goes through the normal page publish flow.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { rateLimit } from '@/backend/lib/rate-limit'
import { audit, requireStoreRole } from '@/backend/lib/tenancy'
import { generateSection } from '@/backend/lib/ai-design'

const IMAGE = z.string().max(8_000_000).regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, 'Images must be PNG, JPEG, WebP or GIF')
const CODE = z.string().max(200_000)
const bodySchema = z.object({
  images: z.array(IMAGE).max(8).default([]),
  fromVideo: z.boolean().default(false),
  code: z.string().max(100_000).default(''),
  instructions: z.string().max(4000).default(''),
  current: z.object({ label: z.string().max(120).default(''), html: CODE, css: CODE, js: CODE }).optional(),
})

export async function generate(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const body = bodySchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid request')
    const input = body.data
    if (!input.images.length && !input.code.trim() && !input.instructions.trim()) throw new HttpError(400, 'Add a screenshot, a video, some code or instructions.')
    rateLimit(`ai-design:${ctx.store.id}`, 30, 60 * 60_000)
    const result = await generateSection(input)
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.ai-generate', entityType: 'StorePage', diff: { images: input.images.length, fromVideo: input.fromVideo, code: input.code.length > 0, refine: !!input.current, label: result.label } })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
