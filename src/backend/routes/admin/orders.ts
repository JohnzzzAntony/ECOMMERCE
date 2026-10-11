import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

function oneOf(value: unknown, allowed: string[], name: string) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new HttpError(400, `Invalid ${name}`)
  return value
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const data: { orderStatus?: string; paymentStatus?: string } = {}
    if (body.orderStatus !== undefined) data.orderStatus = oneOf(body.orderStatus, ORDER_STATUSES, 'order status')
    if (body.paymentStatus !== undefined) data.paymentStatus = oneOf(body.paymentStatus, PAYMENT_STATUSES, 'payment status')
    if (!Object.keys(data).length) throw new HttpError(400, 'Nothing to update')
    const order = await db.order.update({ where: { id }, data, include: { items: true } })
    return NextResponse.json({ ok: true, order })
  } catch (error) { return failure(error) }
}
