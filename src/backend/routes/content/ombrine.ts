import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/backend/lib/db'
import { checkOrigin, failure, requireAdmin } from '@/backend/lib/auth'
import { rateLimit } from '@/backend/lib/rate-limit'
import { clientIp } from '@/backend/lib/tenancy'
import { storefrontTheme } from '@/backend/lib/theme-store'
import { salonLooks, salonShoppable } from '@/backend/lib/ombrine'
import { isOmbrine, productSizes } from '@/shared/ombrine'

export async function GET(request: NextRequest) {
  try {
    const preview = request.nextUrl.searchParams.get('previewBrand')
    if (preview !== null) {
      await requireAdmin(request)
      if (!preview || preview.length > 150) return NextResponse.json({ error: 'Invalid catalog brand.' }, { status: 400 })
    }
    const theme = await storefrontTheme()
    if (preview) return NextResponse.json(await salonLooks({ ...theme, settings: { ...theme.settings, ombrine_brand: preview } }), { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json(isOmbrine(theme) ? await salonLooks(theme) : [])
  } catch (error) { return failure(error) }
}

const requestSchema = z.object({ productId: z.string().min(1).max(64), email: z.string().trim().email().max(200), size: z.string().max(32).optional() })

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    rateLimit(`salon-notify:${clientIp(request) ?? 'unknown'}`, 5, 60_000)
    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    const theme = await storefrontTheme()
    if (!isOmbrine(theme)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    const { productId, email, size } = parsed.data
    const product = await db.product.findFirst({ where: { id: productId, ...(await salonShoppable(theme)) } })
    if (!product) return NextResponse.json({ error: 'This piece is no longer available.' }, { status: 404 })
    if (product.inStock) return NextResponse.json({ error: 'This piece is available now. Refresh to shop it.' }, { status: 409 })
    if (size && !productSizes(product).includes(size)) return NextResponse.json({ error: 'Choose an available size.' }, { status: 400 })
    const normalizedEmail = email.toLowerCase()
    const id = 'stock-' + createHash('sha256').update(JSON.stringify([productId, normalizedEmail, size ?? ''])).digest('hex')
    await db.enquiry.upsert({ where: { id }, update: {}, create: {
      id, customerName: 'Stock notification', email: normalizedEmail,
      message: `Back-in-stock request for ${product.name}${size ? ` (${size})` : ''}`,
      itemsJson: JSON.stringify([{ productId, productName: product.name, name: product.name, qty: 1 }]),
    } })
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
