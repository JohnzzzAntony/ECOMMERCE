import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'

// Public: active items only. Admin writes go through /api/admin/slides (routes/admin/content.ts).
export function GET() {
  return cachedJson('content:slider', () => db.heroSlide.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))
}
