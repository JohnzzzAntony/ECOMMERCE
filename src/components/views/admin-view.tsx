'use client'

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { formatAED, formatDate, formatNumber } from '@/lib/format'
import type {
  Product, Order, Enquiry, BlogPost, Testimonial, ClientLogo,
  HeroSlide, GalleryItem, Category, Brand,
} from '@/types'

// shadcn/ui
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

// icons
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList, Users, FileText,
  Image as ImageIcon, Star, Building2, Mail, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, Plus, Search, TrendingUp, DollarSign,
  LogOut, Menu, ExternalLink, Pencil, Trash2, Eye, AlertTriangle,
  Boxes, UserCircle, Download, Save, Newspaper, Home, CheckCircle2,
  Activity, Tag, MessageSquare, Sparkles,
} from 'lucide-react'

// recharts
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────
type SectionKey =
  | 'dashboard' | 'products' | 'orders' | 'users' | 'blog'
  | 'media' | 'testimonials' | 'clients' | 'newsletter' | 'settings'

interface DashboardData {
  stats: {
    products: number; orders: number; enquiries: number; users: number
    subscribers: number; blogPosts: number; revenue: number
  }
  recentOrders: Order[]
  recentEnquiries: Enquiry[]
  lowStock: { id: string; name: string; sku: string | null; stockQty: number }[]
  categories: { name: string; count: number }[]
}

interface NavItem { key: SectionKey; label: string; icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'orders', label: 'Orders & Enquiries', icon: ShoppingCart },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'blog', label: 'Blog', icon: FileText },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'testimonials', label: 'Testimonials', icon: Star },
  { key: 'clients', label: 'Clients', icon: Building2 },
  { key: 'newsletter', label: 'Newsletter', icon: Mail },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

const SECTION_TITLES: Record<SectionKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your store performance' },
  products: { title: 'Products', subtitle: 'Manage your product catalog' },
  orders: { title: 'Orders & Enquiries', subtitle: 'Track and fulfil customer orders' },
  users: { title: 'Users', subtitle: 'Manage staff and customer accounts' },
  blog: { title: 'Blog', subtitle: 'Publish articles and insights' },
  media: { title: 'Media', subtitle: 'Gallery images and hero slides' },
  testimonials: { title: 'Testimonials', subtitle: 'Customer reviews and ratings' },
  clients: { title: 'Clients', subtitle: 'Partner logos and brand associations' },
  newsletter: { title: 'Newsletter', subtitle: 'Manage email subscribers' },
  settings: { title: 'Settings', subtitle: 'Configure your storefront' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const s = (status || '').toLowerCase()
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-sky-100 text-sky-800 border-sky-200',
    shipped: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    new: 'bg-purple-100 text-purple-800 border-purple-200',
    contacted: 'bg-sky-100 text-sky-800 border-sky-200',
    quoted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
    paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    refunded: 'bg-amber-100 text-amber-800 border-amber-200',
  }
  return (
    <Badge variant="outline" className={`capitalize ${map[s] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {status}
    </Badge>
  )
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'A'
}

function safeParseItems(json: string): { name: string; qty?: number; price?: number }[] {
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

// ─── Login Gate ───────────────────────────────────────────────────────────
function LoginGate() {
  const { setUser } = useStore()
  const [email, setEmail] = useState('admin@jkrinternational.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { user } = await api.login(email, password)
      if (user.role !== 'admin') {
        toast.error('Access denied. Admin privileges required.')
        setLoading(false)
        return
      }
      setUser(user)
      toast.success('Welcome back, Admin')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-ink via-brand-teal-dark to-brand-ink p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-gold text-2xl font-black text-white shadow-lg">
            JKR
          </div>
          <h1 className="text-2xl font-bold text-white">JKR International</h1>
          <p className="mt-1 text-sm text-white/60">Medical Equipment · UAE</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-brand-ink">Admin Login</CardTitle>
            <CardDescription>Sign in to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                  placeholder="admin@jkrinternational.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••" className="h-11"
                />
              </div>
              <Button
                type="submit" disabled={loading} size="lg"
                className="w-full bg-brand-teal hover:bg-brand-teal-dark"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <div className="rounded-lg border border-dashed border-brand-gold/40 bg-brand-gold/5 p-3 text-center text-xs text-muted-foreground">
                <span className="font-medium text-brand-ink">Demo credentials:</span>{' '}
                admin@jkrinternational.com / admin123
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => useStore.getState().navigate('home')}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="size-4" /> Back to store
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function SidebarContent({
  section, onSelect,
}: { section: SectionKey; onSelect: (s: SectionKey) => void }) {
  const { navigate, setUser } = useStore()

  const handleLogout = () => {
    setUser(null)
    toast.success('Logged out')
    navigate('home')
  }

  return (
    <div className="flex h-full flex-col bg-brand-ink text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gold font-black text-white shadow-md">
          JKR
        </div>
        <div>
          <div className="font-bold leading-tight">JKR International</div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Management
        </div>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = section === item.key
            return (
              <li key={item.key}>
                <button
                  onClick={() => onSelect(item.key)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-brand-teal text-white shadow-md'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {active && <ChevronRight className="size-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <button
          onClick={() => navigate('home')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all"
        >
          <ExternalLink className="size-4" />
          <span className="flex-1 text-left">View Site</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all"
        >
          <LogOut className="size-4" />
          <span className="flex-1 text-left">Logout</span>
        </button>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, accent, sublabel,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: 'teal' | 'gold' | 'cyan' | 'ink'
  sublabel?: string
}) {
  const accentMap = {
    teal: 'bg-brand-teal/10 text-brand-teal',
    gold: 'bg-brand-gold/10 text-brand-gold',
    cyan: 'bg-brand-cyan/10 text-brand-cyan',
    ink: 'bg-brand-ink/10 text-brand-ink',
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-brand-ink truncate">{value}</div>
          {sublabel && <div className="mt-1 text-xs text-emerald-600 font-medium">{sublabel}</div>}
        </div>
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Dashboard Section ────────────────────────────────────────────────────
function DashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.adminStats()
      .then((d) => { if (mounted) setData(d) })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  const { stats, recentOrders, recentEnquiries, lowStock, categories } = data
  const chartData = categories.map((c) => ({ name: c.name, count: c.count }))
  const maxCount = Math.max(...chartData.map((d) => d.count), 1)
  const chartColors = ['#0D6B8C', '#00B4D8', '#E8A100', '#22C55E', '#1A1A2E', '#8B5CF6', '#EC4899', '#F97316']

  const today = new Date().toDateString()
  const ordersToday = recentOrders.filter((o) => new Date(o.createdAt).toDateString() === today).length
  const enquiriesToday = recentEnquiries.filter((e) => new Date(e.createdAt).toDateString() === today).length

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-brand-ink">Welcome back, Admin 👋</h2>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening at JKR International today.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={formatNumber(stats.products)} icon={Package} accent="teal" sublabel={`+${Math.min(stats.products, 3)} this week`} />
        <StatCard label="Orders" value={formatNumber(stats.orders)} icon={ShoppingCart} accent="gold" sublabel={`+${ordersToday} today`} />
        <StatCard label="Enquiries" value={formatNumber(stats.enquiries)} icon={ClipboardList} accent="cyan" sublabel={`+${enquiriesToday} today`} />
        <StatCard label="Users" value={formatNumber(stats.users)} icon={Users} accent="ink" sublabel="+1 today" />
      </div>

      {/* Revenue + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-gradient-to-br from-brand-ink to-brand-teal-dark text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-wide font-medium">
                  <DollarSign className="size-4" /> Total Revenue
                </div>
                <div className="mt-2 text-4xl font-bold">{formatAED(stats.revenue)}</div>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-300">
                  <TrendingUp className="size-4" /> +12.5% vs last month
                </div>
              </div>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <DollarSign className="size-8 text-brand-gold" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start bg-transparent" onClick={() => toast.info('Add Product form would open here')}>
              <Plus className="size-4 text-brand-teal" /> Add Product
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent" onClick={() => toast.info('New Blog Post form would open here')}>
              <Plus className="size-4 text-brand-gold" /> New Blog Post
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent" onClick={() => toast.info('Opening enquiries list…')}>
              <ClipboardList className="size-4 text-brand-cyan" /> View Enquiries
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders + Recent Enquiries */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4 text-brand-teal" /> Recent Orders
            </CardTitle>
            <CardDescription>Latest customer orders</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.slice(0, 5).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                      <TableCell className="font-medium">{o.customerName}</TableCell>
                      <TableCell>{o.items?.length || 0} items</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(o.total)}</TableCell>
                      <TableCell>{statusBadge(o.orderStatus)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-brand-cyan" /> Recent Enquiries
            </CardTitle>
            <CardDescription>Latest quote enquiries</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEnquiries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No enquiries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEnquiries.slice(0, 5).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.company || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(e.total)}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock + Products by Category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-brand-gold" /> Low Stock Alert
            </CardTitle>
            <CardDescription>Products with stock ≤ 5</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-emerald-600">
                <CheckCircle2 className="size-4" /> All products are well stocked.
              </div>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-brand-ink">{p.name}</div>
                      <div className="text-xs text-muted-foreground">SKU: {p.sku || '—'}</div>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shrink-0">
                      {p.stockQty} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="size-4 text-brand-teal" /> Products by Category
            </CardTitle>
            <CardDescription>Distribution across catalog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(13, 107, 140, 0.05)' }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Total: {maxCount} max · {categories.length} categories
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Products Section ─────────────────────────────────────────────────────
function ProductsSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [brand, setBrand] = useState<string>('all')
  const [onSale, setOnSale] = useState(false)
  const [inStock, setInStock] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    Promise.all([api.categories(), api.brands()])
      .then(([c, b]) => { setCategories(c); setBrands(b) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const params: Record<string, string | boolean | undefined> = {
      page: String(page),
      page_size: '10',
    }
    if (search) params.search = search
    if (category !== 'all') params.category = category
    if (brand !== 'all') params.brand = brand
    if (onSale) params.on_sale = true
    if (inStock) params.in_stock = true
    api.products(params)
      .then((r) => { if (!cancelled) { setProducts(r.products); setTotal(r.total); setTotalPages(r.totalPages) } })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, category, brand, onSale, inStock, page])

  const clearFilters = () => {
    setSearch(''); setCategory('all'); setBrand('all'); setOnSale(false); setInStock(false); setPage(1)
  }

  const refreshProducts = () => {
    const params: Record<string, string | boolean | undefined> = {
      page: String(page),
      page_size: '10',
    }
    if (search) params.search = search
    if (category !== 'all') params.category = category
    if (brand !== 'all') params.brand = brand
    if (onSale) params.on_sale = true
    if (inStock) params.in_stock = true
    api.products(params)
      .then((r) => { setProducts(r.products); setTotal(r.total); setTotalPages(r.totalPages) })
      .catch(() => toast.error('Failed to load products'))
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
      toast.success('Product deleted')
      refreshProducts()
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === products.length) setSelected(new Set())
    else setSelected(new Set(products.map((p) => p.id)))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Products</h2>
          <p className="text-sm text-muted-foreground">{formatNumber(total)} products in catalog</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => setShowAddModal(true)}>
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 cursor-pointer">
              <Checkbox checked={onSale} onCheckedChange={(v) => { setOnSale(v === true); setPage(1) }} />
              <span className="text-sm">On Sale</span>
            </label>
            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 cursor-pointer">
              <Checkbox checked={inStock} onCheckedChange={(v) => { setInStock(v === true); setPage(1) }} />
              <span className="text-sm">In Stock</span>
            </label>
          </div>
          {(search || category !== 'all' || brand !== 'all' || onSale || inStock) && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {selected.size > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-teal/5 px-3 py-2 text-sm">
              <span className="text-brand-teal font-medium">{selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={() => toast.info('Bulk actions coming soon')}>Bulk actions ▾</Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={products.length > 0 && selected.size === products.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-center">On Sale</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No products found.</TableCell>
                </TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {p.images?.[0]?.imageUrl ? (
                      <img
                        src={p.images[0].imageUrl}
                        alt={p.name}
                        className="size-11 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-11 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                        <Package className="size-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-brand-ink line-clamp-2 max-w-xs">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.brand?.name || '—'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{formatAED(p.onSale && p.salePrice ? p.salePrice : p.regularPrice)}</div>
                    {p.onSale && p.salePrice && (
                      <div className="text-xs text-muted-foreground line-through">{formatAED(p.regularPrice)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={p.stockQty <= 5 ? 'font-medium text-red-600' : 'text-foreground'}>{p.stockQty}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {p.onSale ? (
                      <Badge className="bg-brand-gold text-white border-0">Sale</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.info(`Edit ${p.name}`)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteProduct(p.id, p.name)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {Math.max(totalPages, 1)} · {formatNumber(total)} total
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <Button
                variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      <AddProductModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        categories={categories}
        brands={brands}
        onCreated={refreshProducts}
      />
    </div>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────
function AddProductModal({ open, onOpenChange, categories, brands, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: Category[]
  brands: Brand[]
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    shortDescription: '',
    description: '',
    sku: '',
    regularPrice: '',
    salePrice: '',
    onSale: false,
    stockQty: '0',
    categoryId: '',
    brandId: '',
    isFeatured: false,
    isExclusive: false,
  })

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    if (!form.name || !form.regularPrice) {
      toast.error('Name and regular price are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Product created successfully!')
      onOpenChange(false)
      setForm({ name: '', shortDescription: '', description: '', sku: '', regularPrice: '', salePrice: '', onSale: false, stockQty: '0', categoryId: '', brandId: '', isFeatured: false, isExclusive: false })
      onCreated()
    } catch {
      toast.error('Failed to create product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>Create a new product in the catalog. A placeholder image will be auto-generated.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Product Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Premium Wheelchair" />
          </div>
          <div className="grid gap-2">
            <Label>Short Description</Label>
            <Input value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="Brief one-line description" />
          </div>
          <div className="grid gap-2">
            <Label>Full Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Detailed product description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if empty" />
            </div>
            <div className="grid gap-2">
              <Label>Stock Quantity</Label>
              <Input type="number" value={form.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Regular Price (AED) <span className="text-red-500">*</span></Label>
              <Input type="number" value={form.regularPrice} onChange={(e) => set('regularPrice', e.target.value)} placeholder="e.g. 5000" />
            </div>
            <div className="grid gap-2">
              <Label>Sale Price (AED)</Label>
              <Input type="number" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} placeholder="Leave empty if no sale" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Brand</Label>
              <Select value={form.brandId} onValueChange={(v) => set('brandId', v)}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.onSale} onCheckedChange={(v) => set('onSale', v)} /> On Sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isFeatured} onCheckedChange={(v) => set('isFeatured', v)} /> Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isExclusive} onCheckedChange={(v) => set('isExclusive', v)} /> Exclusive
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
function OrdersEnquiriesSection() {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState('all')
  const [enqFilter, setEnqFilter] = useState('all')
  const [detail, setDetail] = useState<Order | Enquiry | null>(null)
  const [detailType, setDetailType] = useState<'order' | 'enquiry' | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetch('/api/orders').then((r) => r.json()).catch(() => []),
      fetch('/api/enquiries').then((r) => r.json()).catch(() => []),
    ])
      .then(([o, e]) => { if (!cancelled) { setOrders(o); setEnquiries(e) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filteredOrders = useMemo(() =>
    orderFilter === 'all' ? orders : orders.filter((o) => o.orderStatus === orderFilter),
    [orders, orderFilter])

  const filteredEnquiries = useMemo(() =>
    enqFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === enqFilter),
    [enquiries, enqFilter])

  const openOrder = (o: Order) => { setDetail(o); setDetailType('order') }
  const openEnquiry = (e: Enquiry) => { setDetail(e); setDetailType('enquiry') }

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="size-4" /> Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="enquiries" className="gap-1.5">
            <ClipboardList className="size-4" /> Enquiries ({enquiries.length})
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No orders found.</TableCell></TableRow>
                  ) : filteredOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{o.customerName}</div>
                        <div className="text-xs text-muted-foreground">{o.email}</div>
                      </TableCell>
                      <TableCell>{o.items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(o.total)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase text-[10px]">{o.paymentMethod}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(o.orderStatus)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openOrder(o)}>
                          <Eye className="size-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enquiries Tab */}
        <TabsContent value="enquiries" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={enqFilter} onValueChange={setEnqFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredEnquiries.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No enquiries found.</TableCell></TableRow>
                  ) : filteredEnquiries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.company || '—'}</TableCell>
                      <TableCell>
                        <div className="text-xs">{e.email}</div>
                        <div className="text-xs text-muted-foreground">{e.phone || '—'}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatAED(e.total)}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEnquiry(e)}>
                          <Eye className="size-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) { setDetail(null); setDetailType(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && detailType === 'order' && (() => {
            const o = detail as Order
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShoppingCart className="size-5 text-brand-teal" /> Order {o.orderNumber}
                  </DialogTitle>
                  <DialogDescription>Placed on {formatDate(o.createdAt)}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Customer</div>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-sm text-muted-foreground">{o.email}</div>
                    <div className="text-sm text-muted-foreground">{o.phone || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Payment</div>
                    <div className="flex items-center gap-2 text-sm">
                      Method: <Badge variant="secondary" className="uppercase text-[10px]">{o.paymentMethod}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      Payment: {statusBadge(o.paymentStatus)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      Order: {statusBadge(o.orderStatus)}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {o.items?.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="font-medium">{it.productName}</div>
                            <div className="text-xs text-muted-foreground">{it.sku || '—'}</div>
                          </TableCell>
                          <TableCell className="text-right">{it.qty}</TableCell>
                          <TableCell className="text-right">{formatAED(it.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{formatAED(it.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-brand-teal">{formatAED(o.total)}</span>
                </div>
                {o.notes && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notes</div>
                    <p className="text-sm">{o.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-3">
                  <Label className="text-sm font-medium">Update status:</Label>
                  <Select defaultValue={o.orderStatus} onValueChange={(v) => toast.success(`Order status set to: ${v}`)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => toast.success('Order updated')}>
                    <Save className="size-4" /> Save Changes
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
          {detail && detailType === 'enquiry' && (() => {
            const e = detail as Enquiry
            const items = safeParseItems(e.itemsJson)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardList className="size-5 text-brand-cyan" /> Enquiry from {e.customerName}
                  </DialogTitle>
                  <DialogDescription>Submitted on {formatDate(e.createdAt)}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Customer</div>
                    <div className="font-medium">{e.customerName}</div>
                    <div className="text-sm text-muted-foreground">{e.email}</div>
                    <div className="text-sm text-muted-foreground">{e.phone || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Company</div>
                    <div className="font-medium">{e.company || '—'}</div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      Status: {statusBadge(e.status)}
                    </div>
                    <div className="mt-1 text-sm">
                      Total: <span className="font-semibold text-brand-teal">{formatAED(e.total)}</span>
                    </div>
                  </div>
                </div>
                {items.length > 0 && (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{it.name}</TableCell>
                            <TableCell className="text-right">{it.qty || 1}</TableCell>
                            <TableCell className="text-right">{it.price ? formatAED(it.price) : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {e.message && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Message</div>
                    <p className="text-sm">{e.message}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 p-3">
                  <Label className="text-sm font-medium">Update status:</Label>
                  <Select defaultValue={e.status} onValueChange={(v) => toast.success(`Enquiry status set to: ${v}`)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => toast.success('Enquiry updated')}>
                    <Save className="size-4" /> Save Changes
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Users Section ────────────────────────────────────────────────────────
function UsersSection() {
  const { user } = useStore()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect -- loading state flip before async fetch */
    setLoading(true)
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setUsers(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter((u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    )
  }, [users, search])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Users</h2>
          <p className="text-sm text-muted-foreground">{users.length} registered users</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => toast.info('Invite user form would open here')}>
          <Plus className="size-4" /> Invite User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users by name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown'
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex size-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                            u.role === 'admin' ? 'bg-brand-teal' : 'bg-brand-ink'
                          }`}>
                            {initials(name)}
                          </div>
                          <div>
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">{u.role === 'admin' ? 'Store Administrator' : 'Registered Customer'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.role === 'admin'
                          ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20 capitalize'
                          : 'bg-slate-100 text-slate-700 border-slate-200 capitalize'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u._count?.orders || 0} orders</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.info(`Edit ${name}`)}>
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Blog Section ─────────────────────────────────────────────────────────
function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.blog()
      .then(setPosts)
      .catch(() => toast.error('Failed to load blog posts'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Blog</h2>
          <p className="text-sm text-muted-foreground">{posts.length} published posts</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => toast.info('New blog post editor would open here')}>
          <Plus className="size-4" /> New Post
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-14 w-full" /></TableCell></TableRow>
                ))
              ) : posts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No blog posts yet.</TableCell></TableRow>
              ) : posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.coverImageUrl ? (
                      <img src={p.coverImageUrl} alt={p.title} className="size-12 rounded-md border border-border object-cover" />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                        <Newspaper className="size-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-brand-ink line-clamp-2 max-w-sm">{p.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1 max-w-sm">{p.excerpt}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                  <TableCell className="text-sm">{p.authorName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(p.publishedAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Published
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.info(`Edit ${p.title}`)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => toast.info(`Delete ${p.title}`)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Media Section (Gallery + Slides) ─────────────────────────────────────
function MediaSection() {
  const [tab, setTab] = useState('gallery')
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.gallery(), api.slider()])
      .then(([g, s]) => { setGallery(g); setSlides(s) })
      .catch(() => toast.error('Failed to load media'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Media</h2>
          <p className="text-sm text-muted-foreground">Gallery and hero slides</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="gallery" className="gap-1.5"><ImageIcon className="size-4" /> Gallery ({gallery.length})</TabsTrigger>
          <TabsTrigger value="slides" className="gap-1.5"><Sparkles className="size-4" /> Hero Slides ({slides.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => toast.info('Upload image form would open here')}>
              <Plus className="size-4" /> Upload Image
            </Button>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          ) : gallery.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No gallery images yet.</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {gallery.map((g) => (
                <Card key={g.id} className="overflow-hidden gap-0 py-0">
                  <div className="relative aspect-square bg-muted">
                    <img src={g.imageUrl} alt={g.caption || 'Gallery image'} className="size-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="text-xs font-medium text-white line-clamp-2">{g.caption || 'Untitled'}</div>
                      <div className="text-[10px] text-white/60">{g.category}</div>
                    </div>
                    <button
                      onClick={() => toast.info(`Delete image: ${g.caption || g.id}`)}
                      className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-red-500/90 text-white opacity-0 hover:bg-red-600 transition-opacity group-hover:opacity-100"
                      aria-label="Delete image"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => toast.info('Add slide form would open here')}>
              <Plus className="size-4" /> Add Slide
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : slides.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No hero slides yet.</p>
              ) : (
                <div className="space-y-3">
                  {slides.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-sm font-bold text-brand-teal">
                        {idx + 1}
                      </div>
                      <img src={s.imageUrl} alt={s.title || 'Slide'} className="size-14 shrink-0 rounded-md border border-border object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-brand-ink">{s.title || 'Untitled slide'}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.subtitle || '—'}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          CTA: {s.ctaLabel || '—'} → {s.ctaUrl || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Active</Label>
                        <Switch defaultChecked onCheckedChange={(v) => toast.info(`Slide ${idx + 1} ${v ? 'activated' : 'deactivated'}`)} />
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.info(`Edit slide ${idx + 1}`)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => toast.info(`Delete slide ${idx + 1}`)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Testimonials Section ─────────────────────────────────────────────────
function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.testimonials()
      .then(setItems)
      .catch(() => toast.error('Failed to load testimonials'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Testimonials</h2>
          <p className="text-sm text-muted-foreground">{items.length} customer testimonials</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => toast.info('Add testimonial form would open here')}>
          <Plus className="size-4" /> Add Testimonial
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-14 w-full" /></TableCell></TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No testimonials yet.</TableCell></TableRow>
              ) : items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold">
                        {initials(t.name)}
                      </div>
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.role || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`size-3.5 ${i < t.rating ? 'fill-brand-gold text-brand-gold' : 'fill-muted text-muted'}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.info(`Edit ${t.name}`)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => toast.info(`Delete ${t.name}`)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Clients Section ──────────────────────────────────────────────────────
function ClientsSection() {
  const [items, setItems] = useState<ClientLogo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.clients()
      .then(setItems)
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Clients & Partners</h2>
          <p className="text-sm text-muted-foreground">{items.length} partner logos</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => toast.info('Add client form would open here')}>
          <Plus className="size-4" /> Add Client
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No clients yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((c) => (
            <Card key={c.id} className="gap-2">
              <CardContent className="flex flex-col items-center gap-3 pt-6">
                <div className="flex h-16 w-full items-center justify-center rounded-lg border border-border bg-muted/50 p-3">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Building2 className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-brand-ink">{c.name}</div>
                  {c.websiteUrl && (
                    <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-teal hover:underline">
                      {c.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => toast.info(`Edit ${c.name}`)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => toast.info(`Delete ${c.name}`)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Newsletter Section ───────────────────────────────────────────────────
interface SubRow { id: string; email: string; subscribedAt: string; isActive: boolean }

function NewsletterSection() {
  const [subs, setSubs] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect -- loading state flip before async fetch */
    setLoading(true)
    fetch('/api/admin/newsletter')
      .then((r) => r.json())
      .then((data: SubRow[]) => { if (!cancelled) setSubs(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [])

  const count = subs.length

  const exportCSV = () => {
    const header = 'Email,Subscribed At,Status\n'
    const body = subs
      .map((r) => `"${r.email}","${r.subscribedAt}","${r.isActive ? 'Active' : 'Inactive'}"`)
      .join('\n')
    const csv = header + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jkr-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV exported successfully')
  }

  const removeSub = async (id: string) => {
    try {
      await fetch(`/api/admin/newsletter?id=${id}`, { method: 'DELETE' })
      setSubs((s) => s.filter((x) => x.id !== id))
      toast.success('Subscriber removed')
    } catch {
      toast.error('Failed to remove subscriber')
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white border-0 sm:col-span-2">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-wide font-medium">
                <Mail className="size-4" /> Total Subscribers
              </div>
              <div className="mt-2 text-4xl font-bold">{loading ? '—' : formatNumber(count)}</div>
              <div className="mt-1 text-sm text-white/70">Active email subscribers</div>
            </div>
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <Mail className="size-8 text-brand-gold" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col justify-between gap-3 pt-6">
            <div>
              <div className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Quick Export</div>
              <div className="mt-1 text-sm text-brand-ink">Download the full subscriber list as a CSV file for use in your email platform.</div>
            </div>
            <Button className="bg-brand-gold hover:bg-brand-gold/90 text-white" onClick={exportCSV} disabled={count === 0}>
              <Download className="size-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscribers</CardTitle>
          <CardDescription>Showing {subs.length} subscribers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="size-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No subscribers yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.subscribedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => removeSub(s.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Settings Section ─────────────────────────────────────────────────────
function SettingsField({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'number'
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {type === 'textarea' ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function SettingsSection() {
  const { settings, setSettings } = useStore()
  const [form, setForm] = useState<Record<string, string>>(settings)
  const [tab, setTab] = useState('general')

  useEffect(() => { setForm(settings) }, [settings])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    setSettings(form)
    toast.success('Settings saved successfully')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your storefront</p>
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={save}>
          <Save className="size-4" /> Save Changes
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><SettingsIcon className="size-4 text-brand-teal" /> General Settings</CardTitle>
              <CardDescription>Core store information and contact details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Site Name" value={form.site_name || ''} onChange={(v) => set('site_name', v)} />
              <SettingsField label="Tagline" value={form.tagline || ''} onChange={(v) => set('tagline', v)} />
              <SettingsField label="Email" type="email" value={form.email || ''} onChange={(v) => set('email', v)} />
              <SettingsField label="WhatsApp" type="tel" value={form.whatsapp || ''} onChange={(v) => set('whatsapp', v)} />
              <SettingsField label="Phone (Dubai)" type="tel" value={form.phone_dubai || ''} onChange={(v) => set('phone_dubai', v)} />
              <SettingsField label="Phone (Abu Dhabi)" type="tel" value={form.phone_abudhabi || ''} onChange={(v) => set('phone_abudhabi', v)} />
              <SettingsField label="Address (Dubai)" value={form.address_dubai || ''} onChange={(v) => set('address_dubai', v)} type="textarea" />
              <SettingsField label="Address (Abu Dhabi)" value={form.address_abudhabi || ''} onChange={(v) => set('address_abudhabi', v)} type="textarea" />
              <SettingsField label="Hours (Dubai)" value={form.hours_dubai || ''} onChange={(v) => set('hours_dubai', v)} />
              <SettingsField label="Hours (Abu Dhabi)" value={form.hours_abudhabi || ''} onChange={(v) => set('hours_abudhabi', v)} />
              <SettingsField label="Free Delivery Threshold (AED)" type="number" value={form.free_delivery_threshold || ''} onChange={(v) => set('free_delivery_threshold', v)} />
              <SettingsField label="Top Bar Announcement" value={form.top_bar_announcement || ''} onChange={(v) => set('top_bar_announcement', v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Search className="size-4 text-brand-teal" /> SEO Settings</CardTitle>
              <CardDescription>Search engine optimization meta</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><SettingsField label="Default Meta Title" value={form.meta_title || 'JKR International — Medical Equipment UAE'} onChange={(v) => set('meta_title', v)} /></div>
              <div className="sm:col-span-2"><SettingsField label="Default Meta Description" value={form.meta_description || 'Delivering world-class medical equipment across the UAE'} onChange={(v) => set('meta_description', v)} type="textarea" /></div>
              <SettingsField label="Meta Keywords" value={form.meta_keywords || 'medical equipment, UAE, healthcare'} onChange={(v) => set('meta_keywords', v)} />
              <SettingsField label="Google Analytics ID" value={form.ga_id || 'G-XXXXXXXXXX'} onChange={(v) => set('ga_id', v)} />
              <SettingsField label="Facebook Pixel ID" value={form.fb_pixel || ''} onChange={(v) => set('fb_pixel', v)} />
              <SettingsField label="Bing Webmaster Key" value={form.bing_key || ''} onChange={(v) => set('bing_key', v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ExternalLink className="size-4 text-brand-teal" /> Social Media</CardTitle>
              <CardDescription>Links to your social profiles</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Instagram URL" value={form.instagram_url || ''} onChange={(v) => set('instagram_url', v)} />
              <SettingsField label="Instagram Handle" value={form.instagram_handle || ''} onChange={(v) => set('instagram_handle', v)} />
              <SettingsField label="Facebook URL" value={form.facebook_url || ''} onChange={(v) => set('facebook_url', v)} />
              <SettingsField label="Twitter / X URL" value={form.twitter_url || ''} onChange={(v) => set('twitter_url', v)} />
              <SettingsField label="LinkedIn URL" value={form.linkedin_url || ''} onChange={(v) => set('linkedin_url', v)} />
              <SettingsField label="YouTube URL" value={form.youtube_url || ''} onChange={(v) => set('youtube_url', v)} />
              <SettingsField label="TikTok URL" value={form.tiktok_url || ''} onChange={(v) => set('tiktok_url', v)} />
              <SettingsField label="Snapchat URL" value={form.snapchat_url || ''} onChange={(v) => set('snapchat_url', v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="size-4 text-brand-teal" /> Payment Methods</CardTitle>
              <CardDescription>Configure accepted payment options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { key: 'pay_tabby', label: 'Tabby (Split into 4)', default: 'enabled' },
                  { key: 'pay_tamara', label: 'Tamara (BNPL)', default: 'enabled' },
                  { key: 'pay_network', label: 'Network International (Cards)', default: 'enabled' },
                  { key: 'pay_cod', label: 'Cash on Delivery', default: 'enabled' },
                  { key: 'pay_bank_transfer', label: 'Bank Transfer', default: 'disabled' },
                ].map((p) => (
                  <div key={p.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-brand-ink">{p.label}</div>
                      <div className="text-xs text-muted-foreground">Status: {form[p.key] || p.default}</div>
                    </div>
                    <Switch
                      defaultChecked={(form[p.key] || p.default) === 'enabled'}
                      onCheckedChange={(v) => { set(p.key, v ? 'enabled' : 'disabled'); toast.info(`${p.label} ${v ? 'enabled' : 'disabled'}`) }}
                    />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Tabby Public Key" value={form.tabby_pk || ''} onChange={(v) => set('tabby_pk', v)} />
                <SettingsField label="Network Merchant ID" value={form.network_mid || ''} onChange={(v) => set('network_mid', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Package className="size-4 text-brand-teal" /> Shipping</CardTitle>
              <CardDescription>Delivery zones and rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Free Delivery Threshold (AED)" type="number" value={form.free_delivery_threshold || '2000'} onChange={(v) => set('free_delivery_threshold', v)} />
                <SettingsField label="Standard Delivery (AED)" type="number" value={form.shipping_standard || '50'} onChange={(v) => set('shipping_standard', v)} />
                <SettingsField label="Express Delivery (AED)" type="number" value={form.shipping_express || '120'} onChange={(v) => set('shipping_express', v)} />
                <SettingsField label="Same-Day Delivery (AED)" type="number" value={form.shipping_sameday || '200'} onChange={(v) => set('shipping_sameday', v)} />
              </div>
              <Separator />
              <div className="space-y-3">
                {[
                  { label: 'Dubai', eta: '1–2 business days' },
                  { label: 'Abu Dhabi', eta: '2–3 business days' },
                  { label: 'Sharjah & Northern Emirates', eta: '2–4 business days' },
                  { label: 'International Shipping', eta: '5–10 business days' },
                ].map((z) => (
                  <div key={z.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-brand-teal" />
                      <span className="text-sm font-medium">{z.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{z.eta}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Admin Layout ─────────────────────────────────────────────────────────
function AdminLayout() {
  const { user } = useStore()
  const [section, setSection] = useState<SectionKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  const meta = SECTION_TITLES[section]
  const adminName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator'

  const select = (s: SectionKey) => {
    setSection(s)
    setMobileOpen(false)
  }

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardSection />
      case 'products': return <ProductsSection />
      case 'orders': return <OrdersEnquiriesSection />
      case 'users': return <UsersSection />
      case 'blog': return <BlogSection />
      case 'media': return <MediaSection />
      case 'testimonials': return <TestimonialsSection />
      case 'clients': return <ClientsSection />
      case 'newsletter': return <NewsletterSection />
      case 'settings': return <SettingsSection />
      default: return <DashboardSection />
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        <SidebarContent section={section} onSelect={select} />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent section={section} onSelect={select} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          <Button
            variant="ghost" size="icon" className="lg:hidden"
            onClick={() => setMobileOpen(true)} aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-brand-ink lg:text-lg">{meta.title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm" className="hidden sm:inline-flex"
              onClick={() => useStore.getState().navigate('home')}
            >
              <Home className="size-4" /> View Site
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pl-1 pr-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                {initials(adminName)}
              </div>
              <div className="hidden text-sm sm:block">
                <div className="font-medium leading-tight text-brand-ink">{adminName}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────
export function AdminView() {
  const { user } = useStore()
  const isAdmin = user && user.role === 'admin'
  return isAdmin ? <AdminLayout /> : <LoginGate />
}
