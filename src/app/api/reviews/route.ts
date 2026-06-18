import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  const reviews = await db.productReview.findMany({ where: { productId, isApproved: true } })
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  await db.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: reviews.length },
  })

  return NextResponse.json({ ok: true, review })
}
