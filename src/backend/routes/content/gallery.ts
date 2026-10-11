import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'

// Public: active items only. Admin writes go through /api/admin/gallery (routes/admin/content.ts).
export function GET() {
  return cachedJson('content:gallery', () => db.galleryItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))
}
