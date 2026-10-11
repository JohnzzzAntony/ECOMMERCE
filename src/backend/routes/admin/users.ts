import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { emailAddress, failure, HttpError, requireAdmin, setSession, text } from '@/backend/lib/auth'
import { hashPassword } from '@/backend/lib/password'
import { parseFields, readJson, type Fields } from '@/backend/lib/admin-resource'

const ROLES = ['customer', 'staff', 'admin']
const PROFILE: Fields = {
  firstName: { type: 'text', max: 80 },
  lastName: { type: 'text', max: 80 },
  phone: { type: 'text', max: 40 },
  isActive: { type: 'bool' },
}
// Never return password hashes.
const SAFE = {
  id: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true, createdAt: true,
  _count: { select: { orders: true, enquiries: true } },
} as const

function role(value: unknown) {
  if (typeof value !== 'string' || !ROLES.includes(value)) throw new HttpError(400, 'Invalid role')
  return value
}

function password(value: unknown) {
  const pw = text(value, 'password', 200, true)
  if (pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
  return pw
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const users = await db.user.findMany({ select: SAFE, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(users, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const user = await db.user.create({
      data: {
        ...parseFields(body, PROFILE),
        email: emailAddress(body.email),
        role: body.role === undefined ? 'customer' : role(body.role),
        password: await hashPassword(password(body.password)),
      },
      select: SAFE,
    })
    return NextResponse.json({ ok: true, user })
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const data: Record<string, unknown> = parseFields(body, PROFILE, true)
    if (body.email !== undefined) data.email = emailAddress(body.email)
    if (body.role !== undefined) data.role = role(body.role)
    // A new password also invalidates that user's existing sessions (see backend/lib/auth.ts).
    if (body.password) data.password = await hashPassword(password(body.password))
    if (id === admin.id && (data.isActive === false || (data.role && data.role !== 'admin'))) {
      throw new HttpError(400, 'You cannot deactivate or demote your own account')
    }
    const user = await db.user.update({ where: { id }, data, select: SAFE })
    const response = NextResponse.json({ ok: true, user })
    // Changing your own password would otherwise sign you out; re-issue the cookie instead.
    if (id === admin.id && data.password) return setSession(response, { id, password: data.password as string }, request)
    return response
  } catch (error) { return failure(error) }
}
