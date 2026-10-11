import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = await db.blogPost.findUnique({ where: { slug } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const related = await db.blogPost.findMany({
    where: { slug: { not: slug }, isPublished: true, category: post.category },
    take: 3,
    orderBy: { publishedAt: 'desc' },
  })

  return NextResponse.json({ post, related })
}
