import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const cats = await db.category.findMany({
    where: { parentId: null, isActive: true },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { products: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(cats)
}
