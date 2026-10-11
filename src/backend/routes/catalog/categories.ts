import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'
import { categoryTree } from '@/backend/lib/category-tree'

/** Active categories as a tree (any depth); `_count.products` includes sub-categories. */
export function GET() {
  return cachedJson('catalog:categories', async () => {
    const rows = await db.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return categoryTree(rows)
  })
}
