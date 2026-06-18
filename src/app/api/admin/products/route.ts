import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    name, nameAr, description, shortDescription, sku,
    regularPrice, salePrice, onSale, stockQty, inStock,
    categoryId, brandId, isFeatured, isExclusive,
    metaTitle, metaDescription, specifications,
  } = body

  if (!name || !regularPrice) {
    return NextResponse.json({ error: 'Name and regular price are required' }, { status: 400 })
  }

  // Generate unique slug
  let slug = slugify(name)
  const existing = await db.product.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`
  }

  const product = await db.product.create({
    data: {
      slug,
      name,
      nameAr: nameAr || null,
      description: description || null,
      shortDescription: shortDescription || null,
      specifications: specifications || null,
      sku: sku || `JKR-${Date.now().toString().slice(-6)}`,
      regularPrice: parseFloat(regularPrice),
      salePrice: salePrice ? parseFloat(salePrice) : null,
      onSale: onSale || false,
      stockQty: parseInt(stockQty) || 0,
      inStock: inStock !== undefined ? inStock : true,
      categoryId: categoryId || null,
      brandId: brandId || null,
      isFeatured: isFeatured || false,
      isExclusive: isExclusive || false,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    },
  })

  // Add a default placeholder image
  await db.productImage.create({
    data: {
      productId: product.id,
      imageUrl: `https://picsum.photos/seed/new-${product.id}/800/800`,
      altText: name,
      sortOrder: 0,
      isPrimary: true,
    },
  })

  return NextResponse.json({ ok: true, product })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...updateData } = body
  if (!id) return NextResponse.json({ error: 'Product id required' }, { status: 400 })

  // Convert numeric fields
  if (updateData.regularPrice) updateData.regularPrice = parseFloat(updateData.regularPrice)
  if (updateData.salePrice) updateData.salePrice = parseFloat(updateData.salePrice)
  if (updateData.stockQty) updateData.stockQty = parseInt(updateData.stockQty)

  const product = await db.product.update({
    where: { id },
    data: updateData,
  })
  return NextResponse.json({ ok: true, product })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Product id required' }, { status: 400 })

  await db.product.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
