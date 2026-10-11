import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { checkOrigin, emailAddress, failure, HttpError, publicUser, setSession, text } from '@/backend/lib/auth'
import { hashPassword, needsPasswordUpgrade, verifyPassword } from '@/backend/lib/password'

export async function POST(request: Request) {
  try {
    checkOrigin(request)
    const body = await request.json()
    const email = emailAddress(body.email)
    const password = text(body.password, 'password', 1024, true)
    let user = await db.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.password))) throw new HttpError(401, 'Invalid credentials')
    if (!user.isActive) throw new HttpError(403, 'Account disabled')
    if (needsPasswordUpgrade(user.password)) user = await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } })
    return setSession(NextResponse.json({ user: publicUser(user) }), user, request)
  } catch (error) { return failure(error) }
}
