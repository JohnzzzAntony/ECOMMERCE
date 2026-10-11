import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { idParam, parseFields, readJson, uniqueSlug, type Fields } from '@/backend/lib/admin-resource'

const FIELDS: Fields = {
  title: { type: 'text', required: true, max: 300 },
  excerpt: { type: 'text', max: 1000 },
  content: { type: 'text', required: true, max: 100000 },
  category: { type: 'text', max: 80 },
  tags: { type: 'text', max: 500 },
  authorName: { type: 'text', max: 120 },
  coverImageUrl: { type: 'text', max: 1000 },
  isPublished: { type: 'bool' },
  metaTitle: { type: 'text', max: 300 },
  metaDescription: { type: 'text', max: 1000 },
}

const slugTaken = (id?: string) => async (slug: string) =>
  !!(await db.blogPost.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } }))

// Admin list: includes drafts (the public /api/blog only returns published posts).
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const posts = await db.blogPost.findMany({ orderBy: { publishedAt: 'desc' } })
    return NextResponse.json(posts, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const data = parseFields(await readJson(request), FIELDS)
    const title = data.title as string
    const post = await db.blogPost.create({
      data: {
        ...data,
        title,
        content: data.content as string,
        category: (data.category as string | null) || 'General',
        authorName: (data.authorName as string | null) || 'Store Editorial',
        slug: await uniqueSlug(title, slugTaken()),
        publishedAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, post })
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const data: Record<string, unknown> = parseFields(body, FIELDS, true)
    const current = await db.blogPost.findUnique({ where: { id }, select: { isPublished: true } })
    if (!current) throw new HttpError(404, 'Post not found')
    // Publishing a draft dates it to the moment it goes live.
    if (data.isPublished === true && !current.isPublished) data.publishedAt = new Date()
    if (data.category === null) data.category = 'General'
    if (data.authorName === null) data.authorName = 'Store Editorial'
    const post = await db.blogPost.update({ where: { id }, data })
    return NextResponse.json({ ok: true, post })
  } catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    await db.blogPost.delete({ where: { id: idParam(request) } })
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
