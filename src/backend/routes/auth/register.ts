import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { checkOrigin, emailAddress, failure, HttpError, publicUser, setSession, text } from '@/backend/lib/auth'
import { hashPassword } from '@/backend/lib/password'

export async function POST(request: Request) {
  try {
    checkOrigin(request)
    const body = await request.json()
    const email = emailAddress(body.email)
    const password = text(body.password, 'password', 1024, true)
    if (password.length < 8) throw new HttpError(400, 'Password must contain at least 8 characters')
    const user = await db.user.create({ data: {
      email, password: await hashPassword(password), role: 'customer',
      firstName: body.firstName ? text(body.firstName, 'first name', 100) : null,
      lastName: body.lastName ? text(body.lastName, 'last name', 100) : null,
      phone: body.phone ? text(body.phone, 'phone', 40) : null,
    } })
    return setSession(NextResponse.json({ user: publicUser(user) }, { status: 201 }), user, request)
  } catch (error) { return failure(error) }
}
