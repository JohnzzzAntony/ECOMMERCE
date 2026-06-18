import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [products, orders, enquiries, users, subscribers, blogPosts] = await Promise.all([
    db.product.count(),
    db.order.count(),
    db.enquiry.count(),
    db.user.count(),
    db.newsletterSubscriber.count(),
    db.blogPost.count(),
  ])

  const recentOrders = await db.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const recentEnquiries = await db.enquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const totalRevenue = await db.order.aggregate({ _sum: { total: true } })
  const lowStock = await db.product.findMany({
    where: { stockQty: { lte: 5 } },
    select: { id: true, name: true, sku: true, stockQty: true },
    take: 10,
  })

  // Products by category
  const categories = await db.category.findMany({
    where: { parentId: null },
    include: { _count: { select: { products: true } } },
  })

  return NextResponse.json({
    stats: {
      products,
      orders,
      enquiries,
      users,
      subscribers,
      blogPosts,
      revenue: totalRevenue._sum.total || 0,
    },
    recentOrders,
    recentEnquiries,
    lowStock,
    categories: categories.map((c) => ({ name: c.name, count: c._count.products })),
  })
}
