import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  // Revenue over last 7 months
  const now = new Date()
  const months: { label: string; revenue: number; orders: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        paymentStatus: { not: 'failed' },
      },
      select: { total: true, createdAt: true },
    })

    const revenue = orders.reduce((sum, o) => sum + o.total, 0)
    months.push({
      label: start.toLocaleDateString('en', { month: 'short' }),
      revenue,
      orders: orders.length,
    })
  }

  // Order status distribution
  const statusCounts = await db.order.groupBy({
    by: ['orderStatus'],
    _count: true,
  })

  // Top selling products (by order item frequency)
  const topProducts = await db.orderItem.groupBy({
    by: ['productName'],
    _count: { productName: true },
    _sum: { qty: true },
    orderBy: { _count: { productName: 'desc' } },
    take: 5,
  })

  // Category distribution
  const categories = await db.category.findMany({
    where: { parentId: null },
    include: { _count: { select: { products: true } } },
  })

  return NextResponse.json({
    revenueByMonth: months,
    statusDistribution: statusCounts.map((s) => ({ status: s.orderStatus, count: s._count })),
    topProducts: topProducts.map((p) => ({
      name: p.productName,
      count: p._count.productName,
      qty: p._sum.qty || 0,
    })),
    categories: categories.map((c) => ({ name: c.name, count: c._count.products })),
  })
}
