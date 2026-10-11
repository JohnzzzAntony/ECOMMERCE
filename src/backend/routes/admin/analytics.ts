import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, requireAdmin } from '@/backend/lib/auth'
import { REVENUE_ORDERS } from './dashboard'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    // Revenue for the current month and the 6 before it, bucketed from one query.
    const now = new Date()
    const months = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 6 + i, 1))
    const orders = await db.order.findMany({
      where: { ...REVENUE_ORDERS, createdAt: { gte: months[0] } },
      select: { total: true, createdAt: true },
    })
    const revenueByMonth = months.map((start) => {
      const inMonth = orders.filter((o) => o.createdAt.getFullYear() === start.getFullYear() && o.createdAt.getMonth() === start.getMonth())
      return {
        label: start.toLocaleDateString('en', { month: 'short' }),
        revenue: inMonth.reduce((sum, o) => sum + o.total, 0),
        orders: inMonth.length,
      }
    })

    const [statusCounts, topProducts] = await Promise.all([
      db.order.groupBy({ by: ['orderStatus'], _count: true }),
      db.orderItem.groupBy({
        by: ['productName'],
        _count: { productName: true },
        _sum: { qty: true },
        orderBy: { _count: { productName: 'desc' } },
        take: 5,
      }),
    ])

    return NextResponse.json({
      revenueByMonth,
      statusDistribution: statusCounts.map((s) => ({ status: s.orderStatus, count: s._count })),
      topProducts: topProducts.map((p) => ({ name: p.productName, count: p._count.productName, qty: p._sum.qty || 0 })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
