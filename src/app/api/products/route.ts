import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  const limit = searchParams.get('limit')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('page_size') || '12')

  const where: any = {}
  if (category) {
    where.OR = [
      { category: { slug: category } },
      { category: { parent: { slug: category } } },
    ]
  }
  if (brand) where.brand = { slug: brand }
  if (collection) where.collections = { some: { collection: { slug: collection } } }
  if (onSale === '1' || onSale === 'true') where.onSale = true
  if (inStock === '1' || inStock === 'true') where.inStock = true
  if (featured === '1' || featured === 'true') where.isFeatured = true
  if (exclusive === '1' || exclusive === 'true') where.isExclusive = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { shortDescription: { contains: search } },
      { description: { contains: search } },
      { sku: { contains: search } },
    ]
  }
  if (minPrice || maxPrice) {
    where.regularPrice = {}
    if (minPrice) where.regularPrice.gte = parseFloat(minPrice)
    if (maxPrice) where.regularPrice.lte = parseFloat(maxPrice)
  }

  let orderBy: any = { createdAt: 'desc' }
  if (sort === 'featured') orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
  else if (sort === 'price_asc') orderBy = { regularPrice: 'asc' }
  else if (sort === 'price_desc') orderBy = { regularPrice: 'desc' }
  else if (sort === 'rating') orderBy = { ratingAvg: 'desc' }
  else if (sort === 'newest') orderBy = { createdAt: 'desc' }

  const total = await db.product.count({ where })
  const products = await db.product.findMany({
    where,
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      brand: true,
      category: true,
    },
    orderBy,
    take: limit ? parseInt(limit) : pageSize,
    skip: limit ? 0 : (page - 1) * pageSize,
  })

  return NextResponse.json({
    products,
    total,
    page,
    pageSize: limit ? parseInt(limit) : pageSize,
    totalPages: Math.ceil(total / (limit ? parseInt(limit) : pageSize)),
  })
}
