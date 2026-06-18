import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const settings = await db.siteSettings.findMany()
  const obj: Record<string, string> = {}
  for (const s of settings) obj[s.key] = s.value
  return NextResponse.json(obj)
}
