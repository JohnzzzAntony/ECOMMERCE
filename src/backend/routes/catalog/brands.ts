import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'

export function GET() {
  return cachedJson('catalog:brands', () => db.brand.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  }))
}
