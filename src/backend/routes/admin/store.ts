// The signed-in admin's store: design source and which optional systems are enabled.
import { NextResponse } from 'next/server'
import { failure, requireAdmin } from '@/backend/lib/auth'
import { currentStore, themesEnabled } from '@/backend/lib/store'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const store = await currentStore(request)
    return NextResponse.json({ designSource: store.designSource, themesEnabled: themesEnabled(store) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
