import { NextResponse } from 'next/server'
import { storefrontTheme } from '@/backend/lib/theme-store'

/** Active theme (settings merged with defaults, homepage sections, CSS) and navigation menus. */
export async function GET() {
  return NextResponse.json(await storefrontTheme(), { headers: { 'Cache-Control': 'no-store' } })
}
