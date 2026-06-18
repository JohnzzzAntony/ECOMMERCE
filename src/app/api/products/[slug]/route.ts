import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      brand: true,
      category: { include: { parent: true } },
      reviews: { where: { isApproved: true }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Related products (same category or brand)
  const related = await db.product.findMany({
    where: {
      AND: [
        { id: { not: product.id } },
        {
          OR: [
            { categoryId: product.categoryId },
            { brandId: product.brandId },
          ],
        },
      ],
    },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, brand: true },
    take: 6,
  })

  return NextResponse.json({ product, related })
}
