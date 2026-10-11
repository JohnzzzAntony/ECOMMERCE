import { db } from '@/backend/lib/db'
import { cachedJson } from '@/backend/lib/memo'

export function GET() {
  return cachedJson('content:clients', () => db.clientLogo.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))
}
