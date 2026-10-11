import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { memo } from '@/backend/lib/memo'
import { parseAttributes } from '@/backend/lib/product-sheet'

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

  // Related products (same category or brand); list fields only.
  const related = await db.product.findMany({
    omit: { description: true, descriptionAr: true, specifications: true, metaKeywords: true, metaDescription: true },
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

  // Custom fields that have a value for this product (empty ones are not shown).
  const fields = await memo('catalog:product-fields', () => db.productField.findMany({ where: { showOnStorefront: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }))
  const values = parseAttributes(product.attributes)
  const extraFields = fields.filter((f) => values[f.slug]?.trim()).map((f) => ({ label: f.label, value: values[f.slug] }))

  return NextResponse.json({ product: { ...product, extraFields }, related })
}
