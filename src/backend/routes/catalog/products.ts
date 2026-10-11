import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/backend/lib/db'
import { categoryWithDescendants } from '@/backend/lib/category-tree'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const brand = searchParams.get('brand')
  const collection = searchParams.get('collection')
  const onSale = searchParams.get('on_sale')
  const inStock = searchParams.get('in_stock')
  const search = searchParams.get('search')
  const featured = searchParams.get('featured')
  const exclusive = searchParams.get('exclusive')
  const minPrice = searchParams.get('min_price')
  const maxPrice = searchParams.get('max_price')
  const sort = searchParams.get('sort') || 'featured'
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? String(Math.min(Math.max(parseInt(limitParam) || 1, 1), 200)) : null
  const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('page_size') || '12') || 12, 1), 100)

  const ids = searchParams.get('ids')?.split(',').filter(Boolean).slice(0, 200)
  const slugs = searchParams.get('slugs')?.split(',').filter(Boolean).slice(0, 200)
  // Listings skip the long text fields; detail views (`ids`, `full=1`, admin) need them.
  const full = !!ids || searchParams.get('full') === '1'

  const where: Prisma.ProductWhereInput = {}
  const and: Prisma.ProductWhereInput[] = []
  if (ids) where.id = { in: ids }
  if (slugs) where.slug = { in: slugs }
  if (category) and.push({ categoryId: { in: await categoryWithDescendants(category) } })
  if (brand) where.brand = { slug: brand }
  if (collection) where.collections = { some: { collection: { slug: collection } } }
  if (onSale === '1' || onSale === 'true') where.onSale = true
  if (inStock === '1' || inStock === 'true') where.inStock = true
  if (featured === '1' || featured === 'true') where.isFeatured = true
  if (exclusive === '1' || exclusive === 'true') where.isExclusive = true
  if (search) {
    and.push({ OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { shortDescription: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ] })
  }
  if (and.length) where.AND = and
  const badge = searchParams.get('badge')
  if (badge) {
    where.badge = { equals: badge, mode: 'insensitive' }
  }
  if (minPrice || maxPrice) {
    where.regularPrice = {
      ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
      ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
    }
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = { createdAt: 'desc' }
  if (sort === 'featured') orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
  else if (sort === 'price_asc') orderBy = { regularPrice: 'asc' }
  else if (sort === 'price_desc') orderBy = { regularPrice: 'desc' }
  else if (sort === 'rating') orderBy = { ratingAvg: 'desc' }
  else if (sort === 'newest') orderBy = { createdAt: 'desc' }

  const take = ids ? ids.length : slugs ? slugs.length : limit ? parseInt(limit) : pageSize
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        brand: true,
        category: true,
      },
      omit: full ? undefined : { description: true, descriptionAr: true, specifications: true, metaKeywords: true, metaDescription: true },
      orderBy,
      take,
      skip: limit || ids || slugs ? 0 : (page - 1) * pageSize,
    }),
  ])

  return NextResponse.json({
    products,
    total,
    page,
    pageSize: limit ? parseInt(limit) : pageSize,
    totalPages: Math.ceil(total / (limit ? parseInt(limit) : pageSize)),
  })
}
