import { NextResponse } from 'next/server'
import { db } from '@/backend/lib/db'
import { failure, requireAdmin } from '@/backend/lib/auth'

// Orders that count as revenue (shared with analytics.ts).
export const REVENUE_ORDERS = { paymentStatus: { notIn: ['failed', 'refunded'] }, orderStatus: { not: 'cancelled' } }

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const today = { createdAt: { gte: startOfDay } }

    const [
      products, orders, enquiries, users, subscribers, blogPosts,
      ordersToday, enquiriesToday, usersToday, newEnquiries, pendingOrders,
      revenue, recentOrders, recentEnquiries, lowStock, categories,
    ] = await Promise.all([
      db.product.count(),
      db.order.count(),
      db.enquiry.count(),
      db.user.count(),
      db.newsletterSubscriber.count({ where: { isActive: true } }),
      db.blogPost.count(),
      db.order.count({ where: today }),
      db.enquiry.count({ where: today }),
      db.user.count({ where: today }),
      db.enquiry.count({ where: { status: 'new' } }),
      db.order.count({ where: { orderStatus: 'pending' } }),
      db.order.aggregate({ where: REVENUE_ORDERS, _sum: { total: true } }),
      db.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
      db.enquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      db.product.findMany({
        where: { stockQty: { lte: 5 } },
        select: { id: true, name: true, sku: true, stockQty: true },
        orderBy: { stockQty: 'asc' },
        take: 10,
      }),
      db.category.findMany({
        where: { parentId: null },
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    return NextResponse.json({
      stats: { products, orders, enquiries, users, subscribers, blogPosts, revenue: revenue._sum.total || 0 },
      today: { orders: ordersToday, enquiries: enquiriesToday, users: usersToday },
      attention: { newEnquiries, pendingOrders },
      recentOrders,
      recentEnquiries,
      lowStock,
      categories: categories.map((c) => ({ name: c.name, count: c._count.products })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
