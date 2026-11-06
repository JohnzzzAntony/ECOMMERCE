// Admin CRUD for homepage/marketing content. Public read-only lists live in routes/content/*.
import { db } from '@/backend/lib/db'
import { adminResource } from '@/backend/lib/admin-resource'
import { HttpError } from '@/backend/lib/auth'
import { LOOK_MAX_PIECES, lookPiecesSchema, type LookPiece } from '@/shared/looks'

const display = { sortOrder: { type: 'int', min: 0, max: 100000 }, isActive: { type: 'bool' } } as const

export const testimonials = adminResource({
  model: db.testimonial,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  fields: {
    name: { type: 'text', required: true, max: 120 },
    role: { type: 'text', max: 160 },
    avatarUrl: { type: 'text', max: 1000 },
    content: { type: 'text', required: true, max: 2000 },
    rating: { type: 'int', min: 1, max: 5 },
    ...display,
  },
})

export const clients = adminResource({
  model: db.clientLogo,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  fields: {
    name: { type: 'text', required: true, max: 120 },
    logoUrl: { type: 'text', max: 1000 },
    websiteUrl: { type: 'text', max: 500 },
    ...display,
  },
})

export const slides = adminResource({
  model: db.heroSlide,
  orderBy: { sortOrder: 'asc' },
  fields: {
    imageUrl: { type: 'text', required: true, max: 1000 },
    title: { type: 'text', max: 160 },
    subtitle: { type: 'text', max: 300 },
    ctaLabel: { type: 'text', max: 60 },
    ctaUrl: { type: 'text', max: 500 },
    ...display,
  },
})

export const gallery = adminResource({
  model: db.galleryItem,
  orderBy: { sortOrder: 'asc' },
  fields: {
    imageUrl: { type: 'text', required: true, max: 1000 },
    caption: { type: 'text', max: 300 },
    category: { type: 'text', max: 60 },
    ...display,
  },
})

// Look pieces must be well-formed and point at existing products; stored normalized.
export async function validateLookItems(data: Record<string, unknown>) {
  if (!('items' in data)) return
  let pieces: LookPiece[]
  try { pieces = lookPiecesSchema.parse(JSON.parse(String(data.items ?? '[]'))) }
  catch { throw new HttpError(400, `A look holds up to ${LOOK_MAX_PIECES} products, each with a pin position`) }
  const ids = [...new Set(pieces.map((p) => p.productId))]
  if (ids.length !== pieces.length) throw new HttpError(400, 'Each product can only be added to a look once')
  if (ids.length && (await db.product.count({ where: { id: { in: ids } } })) !== ids.length) throw new HttpError(400, 'One of the products no longer exists')
  data.items = JSON.stringify(pieces)
}

export const looks = adminResource({
  model: db.look,
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  fields: {
    name: { type: 'text', required: true, max: 120 },
    imageUrl: { type: 'text', required: true, max: 1000 },
    items: { type: 'text', max: 20000 },
    ...display,
  },
  validate: validateLookItems,
})
