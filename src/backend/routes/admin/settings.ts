// Store settings are key/value rows (SiteSettings). Public read: routes/content/settings.ts.
import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { invalidateAll } from '@/backend/lib/memo'
import { failure, HttpError, requireAdmin } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'

const KEY = /^[a-z][a-z0-9_]{0,63}$/

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const { settings } = await readJson(request)
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new HttpError(400, 'settings must be an object')
    const entries = Object.entries(settings as Record<string, unknown>)
    if (entries.length > 200) throw new HttpError(400, 'Too many settings')
    for (const [key, value] of entries) {
      if (!KEY.test(key)) throw new HttpError(400, `Invalid setting key: ${key}`)
      if (typeof value !== 'string' || value.length > 5000) throw new HttpError(400, `Invalid value for ${key}`)
    }
    await db.$transaction(entries.map(([key, value]) =>
      db.siteSettings.upsert({ where: { key }, create: { key, value: value as string }, update: { value: value as string } })))
    const rows = await db.siteSettings.findMany()
    invalidateAll()
    return NextResponse.json({ ok: true, settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) })
  } catch (error) { return failure(error) }
}
