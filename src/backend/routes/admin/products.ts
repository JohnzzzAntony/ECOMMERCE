import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { invalidateAll } from '@/backend/lib/memo'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { idParam, parseFields, readJson, uniqueSlug, type Fields } from '@/backend/lib/admin-resource'

const FIELDS: Fields = {
  name: { type: 'text', required: true, max: 500 },
  nameAr: { type: 'text', max: 300 },
  shortDescription: { type: 'text', max: 5000 },
  description: { type: 'text', max: 30000 },
  descriptionAr: { type: 'text', max: 30000 },
  specifications: { type: 'text', max: 30000 },
  barcode: { type: 'text', max: 64 },
  sku: { type: 'text', max: 100 },
  regularPrice: { type: 'number', required: true, min: 0 },
  salePrice: { type: 'number', min: 0 },
  onSale: { type: 'bool' },
  stockQty: { type: 'int', min: 0, max: 10_000_000 },
  inStock: { type: 'bool' },
  categoryId: { type: 'ref' },
  brandId: { type: 'ref' },
  isFeatured: { type: 'bool' },
  isExclusive: { type: 'bool' },
  badge: { type: 'text', max: 60 },
  metaTitle: { type: 'text', max: 500 },
  metaDescription: { type: 'text', max: 5000 },
  metaKeywords: { type: 'text', max: 2000 },
}

const slugTaken = (id?: string) => async (slug: string) =>
  !!(await db.product.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } }))

/** Custom field values: only known fields, strings only; empty values are dropped (field stays empty). */
async function cleanAttributes(value: unknown): Promise<string | undefined> {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'attributes must be an object')
  const known = new Set((await db.productField.findMany({ select: { slug: true } })).map((f) => f.slug))
  const out: Record<string, string> = {}
  for (const [slug, v] of Object.entries(value as Record<string, unknown>)) {
    if (!known.has(slug) || v === null || v === undefined) continue
    if (typeof v !== 'string' || v.length > 10000) throw new HttpError(400, `Invalid value for ${slug}`)
    if (v.trim()) out[slug] = v.trim()
  }
  return JSON.stringify(out)
}

function checkPrices(regular: unknown, sale: unknown) {
  if (typeof regular === 'number' && typeof sale === 'number' && sale >= regular) {
    throw new HttpError(400, 'Sale price must be lower than the regular price')
  }
}

/** Set (or replace) the primary image. An empty value leaves images unchanged. */
async function savePrimaryImage(productId: string, altText: string, imageUrl: unknown) {
  if (imageUrl === undefined || imageUrl === null || imageUrl === '') return
  const url = text(imageUrl, 'imageUrl', 1000, true)
  const primary = await db.productImage.findFirst({ where: { productId, isPrimary: true }, select: { id: true } })
  if (primary) await db.productImage.update({ where: { id: primary.id }, data: { imageUrl: url } })
  else await db.productImage.create({ data: { productId, imageUrl: url, altText, sortOrder: 0, isPrimary: true } })
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const data = parseFields(body, FIELDS)
    checkPrices(data.regularPrice, data.salePrice)
    const name = data.name as string
    const attributes = await cleanAttributes(body.attributes)
    const product = await db.product.create({
      data: {
        ...data,
        ...(attributes !== undefined ? { attributes } : {}),
        name,
        regularPrice: data.regularPrice as number,
        slug: await uniqueSlug(name, slugTaken()),
        sku: (data.sku as string | null) || `SKU-${Date.now().toString(36).toUpperCase()}`,
      },
    })
    await savePrimaryImage(product.id, name, body.imageUrl)
    invalidateAll()
    return NextResponse.json({ ok: true, product })
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const data = parseFields(body, FIELDS, true)
    const current = await db.product.findUnique({ where: { id }, select: { regularPrice: true, salePrice: true } })
    if (!current) throw new HttpError(404, 'Product not found')
    checkPrices(data.regularPrice ?? current.regularPrice, 'salePrice' in data ? data.salePrice : current.salePrice)
    const attributes = await cleanAttributes(body.attributes)
    const product = await db.product.update({ where: { id }, data: { ...data, ...(attributes !== undefined ? { attributes } : {}) } })
    await savePrimaryImage(id, product.name, body.imageUrl)
    invalidateAll()
    return NextResponse.json({ ok: true, product })
  } catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    // Order history keeps its own name/price snapshot (OrderItem.productId is set to null).
    await db.product.delete({ where: { id: idParam(request) } })
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
