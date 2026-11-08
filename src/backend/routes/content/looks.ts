import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'
import { readLookPieces } from '@/shared/looks'

/** Visible looks with their pinned pieces; the storefront loads the products by id. */
export function GET() {
  return cachedJson('content:looks', async () => {
    const rows = await db.look.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, imageUrl: true, items: true } })
    return rows.map((l) => ({ id: l.id, name: l.name, imageUrl: l.imageUrl, pieces: readLookPieces(l.items) }))
  })
}
