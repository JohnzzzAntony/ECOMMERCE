import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const collections = await db.collection.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(collections)
}
