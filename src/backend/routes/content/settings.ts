import { db } from '@/backend/lib/db'
import { cachedJson, memo } from '@/backend/lib/memo'

const load = async () => Object.fromEntries((await db.siteSettings.findMany()).map((s) => [s.key, s.value])) as Record<string, string>

/** Store settings (key → value), cached. */
export const storeSettings = () => memo('settings', load)

export function GET() {
  return cachedJson('settings', load)
}
