import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  const { id, firstName, lastName, phone } = await request.json()
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 })

  const user = await db.user.update({
    where: { id },
    data: { firstName, lastName, phone },
  })
  const { password: _, ...safeUser } = user
  return NextResponse.json({ user: safeUser })
}
