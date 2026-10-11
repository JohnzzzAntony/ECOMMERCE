import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, publicUser, requireUser, text } from '@/backend/lib/auth'

export async function PUT(request: Request) {
  try {
    const actor = await requireUser(request)
    const body = await request.json()
    const user = await db.user.update({ where: { id: actor.id }, data: {
      firstName: text(body.firstName ?? '', 'first name', 100),
      lastName: text(body.lastName ?? '', 'last name', 100),
      phone: text(body.phone ?? '', 'phone', 40),
    } })
    return NextResponse.json({ user: publicUser(user) })
  } catch (error) { return failure(error) }
}
