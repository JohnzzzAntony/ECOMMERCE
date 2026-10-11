import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'

export async function POST(request: NextRequest) {
  const { productId, authorName, rating, reviewText } = await request.json()
  if (!productId || !authorName || !rating) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const review = await db.productReview.create({
    data: {
      productId,
      authorName,
      rating: parseInt(rating),
      reviewText: reviewText || null,
      isApproved: true,
    },
  })

  // Update product rating
  const reviews = await db.productReview.aggregate({
    where: { productId, isApproved: true },
    _sum: { rating: true },
    _count: true,
  })
  const avg = (reviews._sum.rating ?? 0) / reviews._count
  await db.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: reviews._count },
  })

  return NextResponse.json({ ok: true, review })
}
