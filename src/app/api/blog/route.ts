import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const limit = searchParams.get('limit')

  const where: any = { isPublished: true }
  if (category) where.category = category

  const posts = await db.blogPost.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit ? parseInt(limit) : undefined,
  })
  return NextResponse.json(posts)
}
