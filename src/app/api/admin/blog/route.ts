import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, excerpt, content, category, authorName, coverImageUrl, tags } = body

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  let slug = slugify(title)
  const existing = await db.blogPost.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now().toString().slice(-4)}`

  const post = await db.blogPost.create({
    data: {
      slug,
      title,
      titleAr: title,
      excerpt: excerpt || null,
      content,
      contentAr: content,
      category: category || 'General',
      tags: tags || null,
      authorName: authorName || 'JKR Editorial',
      coverImageUrl: coverImageUrl || `https://picsum.photos/seed/blog-${Date.now()}/1200/600`,
      isPublished: true,
      publishedAt: new Date(),
      metaTitle: title,
      metaDescription: excerpt || '',
    },
  })

  return NextResponse.json({ ok: true, post })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...updateData } = body
  if (!id) return NextResponse.json({ error: 'Post id required' }, { status: 400 })

  const post = await db.blogPost.update({ where: { id }, data: updateData })
  return NextResponse.json({ ok: true, post })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Post id required' }, { status: 400 })

  await db.blogPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
