import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'

export function GET() {
  return cachedJson('catalog:collections', () => db.collection.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  }))
}
