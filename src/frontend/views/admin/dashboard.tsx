'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Award, Boxes, CheckCircle2, ClipboardList, DollarSign, FileText, Package,
  Plus, ShoppingCart, TrendingDown, TrendingUp, Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { formatAED, formatNumber } from '@/frontend/lib/format'
import { useStore } from '@/frontend/store/use-store'
import type { Enquiry, Order } from '@/shared/types'
import { adminApi, errorMessage } from './admin-api'
import { LoadError, StatCard, StatusBadge } from './shared'
import type { SectionKey } from './sections'

interface DashboardData {
  stats: { products: number; orders: number; enquiries: number; users: number; subscribers: number; blogPosts: number; revenue: number }
  today: { orders: number; enquiries: number; users: number }
  attention: { newEnquiries: number; pendingOrders: number }
  recentOrders: Order[]
  recentEnquiries: Enquiry[]
  lowStock: { id: string; name: string; sku: string | null; stockQty: number }[]
  categories: { name: string; count: number }[]
}

interface Analytics {
  revenueByMonth: { label: string; revenue: number; orders: number }[]
  topProducts: { name: string; count: number; qty: number }[]
}

const CHART_COLORS = ['#0D6B8C', '#00B4D8', '#E8A100', '#22C55E', '#1A1A2E', '#8B5CF6', '#EC4899', '#F97316']

export function DashboardSection({ onNavigate }: { onNavigate: (s: SectionKey) => void }) {
  const firstName = useStore((s) => s.user?.firstName)
  const [data, setData] = useState<DashboardData | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    adminApi.get<DashboardData>('/api/admin/dashboard').then(setData).catch((e) => setError(errorMessage(e)))
    adminApi.get<Analytics>('/api/admin/analytics').then(setAnalytics).catch(() => setAnalytics({ revenueByMonth: [], topProducts: [] }))
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/filter change; the loading flag flips before the request
  useEffect(() => { load() }, [load])

  if (error) return <LoadError message={error} onRetry={load} />
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </div>
    )
  }

  const { stats, today, attention, recentOrders, recentEnquiries, lowStock, categories } = data
  const months = analytics?.revenueByMonth ?? []
  const thisMonth = months.at(-1)?.revenue ?? 0
  const lastMonth = months.at(-2)?.revenue ?? 0
  const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-ink">Welcome back{firstName ? `, ${firstName}` : ''} 👋</h2>
        <p className="text-sm text-muted-foreground">
          {attention.newEnquiries || attention.pendingOrders
            ? `${attention.newEnquiries} new enquir${attention.newEnquiries === 1 ? 'y' : 'ies'} and ${attention.pendingOrders} pending order${attention.pendingOrders === 1 ? '' : 's'} need attention.`
            : 'Everything is up to date.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={formatNumber(stats.products)} icon={Package} accent="teal" sublabel={`${lowStock.length} low on stock`} onClick={() => onNavigate('products')} />
        <StatCard label="Orders" value={formatNumber(stats.orders)} icon={ShoppingCart} accent="gold" sublabel={`+${today.orders} today`} onClick={() => onNavigate('orders')} />
        <StatCard label="Enquiries" value={formatNumber(stats.enquiries)} icon={ClipboardList} accent="cyan" sublabel={`+${today.enquiries} today`} onClick={() => onNavigate('orders')} />
        <StatCard label="Users" value={formatNumber(stats.users)} icon={Users} accent="ink" sublabel={`+${today.users} today`} onClick={() => onNavigate('users')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-brand-ink to-brand-teal-dark text-white lg:col-span-2">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70"><DollarSign className="size-4" /> Total Revenue</div>
              <div className="mt-2 text-4xl font-bold">{formatAED(stats.revenue)}</div>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
                {change === null ? (
                  <>This month: {formatAED(thisMonth)}</>
                ) : (
                  <span className={`flex items-center gap-1.5 ${change >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {change >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last month
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-white/50">Excludes cancelled orders and failed or refunded payments</div>
            </div>
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10"><DollarSign className="size-8 text-brand-gold" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => onNavigate('products')}><Plus className="size-4 text-brand-teal" /> Manage Products</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => onNavigate('blog')}><FileText className="size-4 text-brand-gold" /> Write a Blog Post</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => onNavigate('orders')}><ClipboardList className="size-4 text-brand-cyan" /> Review Enquiries ({attention.newEnquiries} new)</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="size-4 text-brand-teal" /> Recent Orders</CardTitle>
            <CardDescription>Latest customer orders</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => onNavigate('orders')}>
                      <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                      <TableCell className="font-medium">{o.customerName}</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(o.total)}</TableCell>
                      <TableCell><StatusBadge status={o.orderStatus} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4 text-brand-cyan" /> Recent Enquiries</CardTitle>
            <CardDescription>Latest quote requests</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEnquiries.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No enquiries yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Company</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recentEnquiries.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => onNavigate('orders')}>
                      <TableCell className="font-medium">{e.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.company || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(e.total)}</TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-brand-teal" /> Revenue Overview</CardTitle>
            <CardDescription>Last 7 months</CardDescription>
          </CardHeader>
          <CardContent>
            {!analytics ? <Skeleton className="h-64 w-full" /> : months.every((m) => m.revenue === 0) ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No revenue recorded in the last 7 months.</div>
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                      <Tooltip cursor={{ fill: 'rgba(13,107,140,0.05)' }} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} formatter={(v: number) => [formatAED(v), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#0D6B8C" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Total: {formatAED(months.reduce((s, m) => s + m.revenue, 0))}</span>
                  <span>{months.reduce((s, m) => s + m.orders, 0)} orders</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Award className="size-4 text-brand-gold" /> Top Products</CardTitle>
            <CardDescription>Most frequently ordered</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics && analytics.topProducts.length > 0 ? (
              <ul className="space-y-3">
                {analytics.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-brand-gold text-white' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-brand-ink">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.qty} units sold</div>
                    </div>
                    <Badge variant="secondary">{p.count}×</Badge>
                  </li>
                ))}
              </ul>
            ) : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No sales data yet</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-brand-gold" /> Low Stock</CardTitle>
            <CardDescription>Products with 5 or fewer units</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-emerald-600"><CheckCircle2 className="size-4" /> All products are well stocked.</div>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-brand-ink">{p.name}</div>
                      <div className="text-xs text-muted-foreground">SKU: {p.sku || '—'}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-red-700">{p.stockQty} left</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4 text-brand-teal" /> Products by Category</CardTitle>
            <CardDescription>{categories.length} top-level categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No categories yet</div> : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(13,107,140,0.05)' }} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                    <Bar dataKey="count" name="Products" radius={[6, 6, 0, 0]}>
                      {categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
