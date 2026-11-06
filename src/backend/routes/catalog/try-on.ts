// AI try-on for shoppers: a photo of the shopper + a product id in, an image of them wearing the product out.
// The garment image is looked up server-side from the product (never a client-supplied URL). Nothing is stored.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkOrigin, failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { db } from '@/backend/lib/db'
import { rateLimit } from '@/backend/lib/rate-limit'
import { clientIp } from '@/backend/lib/tenancy'
import { normalizeImage, runTryOn } from '@/backend/lib/try-on'
import { TRY_ON_CATEGORIES } from '@/shared/try-on'

const PHOTO = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/
const bodySchema = z.object({
  productId: z.string().min(1).max(64),
  category: z.enum(TRY_ON_CATEGORIES),
  photo: z.string().max(8_000_000).regex(PHOTO, 'The photo must be a PNG, JPEG or WebP image'),
})

export async function POST(request: Request) {
  try {
    checkOrigin(request)
    const body = bodySchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid request')
    const { productId, category, photo } = body.data
    // Per shopper, then a ceiling for the whole store so one burst can't use up the shared GPU quota.
    rateLimit(`try-on:${clientIp(request) ?? 'unknown'}`, 5, 10 * 60_000)
    rateLimit('try-on:all', 100, 60 * 60_000)

    const product = await db.product.findUnique({ where: { id: productId }, select: { images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } } } })
    const imageUrl = product?.images[0]?.imageUrl
    if (!imageUrl) throw new HttpError(404, 'This product has no image to try on')

    const person = await normalizeImage(Buffer.from(photo.replace(PHOTO, '$2'), 'base64'))
    const garmentRes = await fetch(new URL(imageUrl, request.url), { signal: AbortSignal.timeout(20_000) }).catch(() => null)
    if (!garmentRes?.ok) throw new HttpError(502, 'Could not load the product image')
    const garment = await normalizeImage(Buffer.from(await garmentRes.arrayBuffer()))

    const result = await runTryOn(person, garment, category)
    return NextResponse.json({ image: `data:image/jpeg;base64,${result.toString('base64')}` }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
