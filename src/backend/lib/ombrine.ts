import type { Prisma } from '@prisma/client'
import { db } from './db'
import { memo } from './memo'
import { readLookPieces } from '@/shared/looks'
import { effectivePrice } from '@/shared/storefront'
import { salonBrand, type SalonLook } from '@/shared/ombrine'
import type { StorefrontTheme } from '@/shared/theme'
import type { Product } from '@/shared/types'

export function salonCatalog(theme: StorefrontTheme): Prisma.ProductWhereInput {
  const brands = salonBrand(theme).split(',').map((slug) => slug.trim()).filter(Boolean)
  return { brand: { slug: { in: brands }, isActive: true } }
}

const productInclude = { images: { orderBy: { sortOrder: 'asc' } }, brand: true, category: true } satisfies Prisma.ProductInclude
const serialize = (row: Prisma.ProductGetPayload<{ include: typeof productInclude }>): Product => ({ ...row, createdAt: row.createdAt.toISOString() })

// Every active look shows, with exactly the products the admin placed in it (any brand).
export function salonLooks(theme: StorefrontTheme): Promise<SalonLook[]> {
  return memo('ombrine:looks', async () => {
    const rows = await db.look.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 96 })
    const looks = rows.map(({ id, name, description, modelName, audience, collection, imageUrl, items }) => ({ id, name, description, modelName, audience, collection, imageUrl, pieces: readLookPieces(items) }))
    const ids = [...new Set(looks.flatMap(({ pieces }) => pieces.map(({ productId }) => productId)))]
    const products = ids.length ? await db.product.findMany({ where: { id: { in: ids } }, include: productInclude }) : []
    const byId = new Map(products.map((row) => [row.id, serialize(row)]))
    return looks.map(({ pieces, ...look }) => ({ ...look, pieces, products: pieces.flatMap(({ productId }) => byId.get(productId) ?? []) }))
  })
}

/** Products the salon sells: its catalog brands plus anything placed in an active look. */
export async function salonShoppable(theme: StorefrontTheme): Promise<Prisma.ProductWhereInput> {
  const ids = (await salonLooks(theme)).flatMap((look) => look.products.map((product) => product.id))
  return { OR: [salonCatalog(theme), { id: { in: ids } }] }
}

export function salonCategories(theme: StorefrontTheme) {
  return db.category.findMany({
    where: { isActive: true, products: { some: salonCatalog(theme) } },
    select: { slug: true, name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function salonProduct(theme: StorefrontTheme, slug: string) {
  const product = await db.product.findFirst({ where: { slug, ...(await salonShoppable(theme)) }, include: productInclude })
  return product ? serialize(product) : null
}

export async function salonProducts(theme: StorefrontTheme, slug: string, q: string, page: number, brand?: string, sale?: boolean, sort?: string) {
  const filter = slug === 'all' ? {} : { OR: [
    { category: { slug, isActive: true } },
    { collections: { some: { collection: { slug, isActive: true } } } },
  ] }
  const match = { contains: q, mode: 'insensitive' } as const
  const where: Prisma.ProductWhereInput = {
    ...salonCatalog(theme), ...filter,
    ...(sale ? { onSale: true } : {}),
    AND: [
      ...(brand ? [{ brand: { slug: brand } }] : []),
      ...(q ? [{ OR: [
        { name: match }, { shortDescription: match }, { sku: match }, { brand: { name: match } },
      ] }] : []),
    ],
  }
  const skip = (page - 1) * 24
  if (sort === 'price-asc' || sort === 'price-desc') {
    const priced = await db.product.findMany({
      where, select: { id: true, regularPrice: true, onSale: true, salePrice: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    const direction = sort === 'price-asc' ? 1 : -1
    priced.sort((a, b) => direction * (effectivePrice(a) - effectivePrice(b)))
    const ids = priced.slice(skip, skip + 24).map(({ id }) => id)
    const rows = ids.length ? await db.product.findMany({ where: { ...where, id: { in: ids } }, include: productInclude }) : []
    const products = new Map(rows.map((row) => [row.id, serialize(row)]))
    return { products: ids.flatMap((id) => products.get(id) ?? []), count: priced.length }
  }
  const order: Prisma.ProductOrderByWithRelationInput = sort === 'newest' ? { createdAt: 'desc' } : { isFeatured: 'desc' }
  const [products, count] = await Promise.all([
    db.product.findMany({ where, include: productInclude, orderBy: [order, { name: 'asc' }, { id: 'asc' }], skip, take: 24 }),
    db.product.count({ where }),
  ])
  return { products: products.map(serialize), count }
}
