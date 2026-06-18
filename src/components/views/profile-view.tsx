'use client'

import { useEffect, useState } from 'react'
import {
  User as UserIcon, Package, LogOut, Shield, Save, Mail, Phone, Loader2,
  ShoppingBag, ArrowRight, CheckCircle2, Clock, Truck, XCircle, HeartPulse,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { formatAED, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { toast } from 'sonner'
import type { Order } from '@/types'

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 },
  shipped: { label: 'Shipped', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: Truck },
  delivered: { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status?.toLowerCase()] || STATUS_STYLES.pending
  const Icon = s.icon
  return (
    <Badge variant="outline" className={`gap-1 ${s.cls}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </Badge>
  )
}

export function ProfileView() {
  const { user, setUser, navigate, loyaltyPoints } = useStore()

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-12 w-12 text-brand-teal" />
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">Sign In Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please sign in to view your profile, orders and saved items.
          </p>
          <Button
            onClick={() => navigate('login')}
            className="mt-6 bg-brand-teal text-white hover:bg-brand-teal-dark"
            size="lg"
          >
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return <ProfileContent user={user} setUser={setUser} navigate={navigate} loyaltyPoints={loyaltyPoints} />
}

function ProfileContent({
  user,
  setUser,
  navigate,
  loyaltyPoints,
}: {
  user: NonNullable<ReturnType<typeof useStore.getState>['user']>
  setUser: (u: any) => void
  navigate: ReturnType<typeof useStore.getState>['navigate']
  loyaltyPoints: number
}) {
  const [profile, setProfile] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    email: user.email,
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/orders/by-email?email=${encodeURIComponent(user.email)}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          phone: profile.phone.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update profile')
      }
      const { user: updated } = await res.json()
      setUser(updated)
      toast.success('Profile updated successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    toast.success('Signed out successfully')
    navigate('home')
  }

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
  const initials = (
    (user.firstName?.[0] || '') + (user.lastName?.[0] || '') || user.email[0]
  ).toUpperCase()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Header card */}
      <Card className="mb-6 overflow-hidden border-border">
        <div className="h-24 bg-gradient-to-r from-brand-teal to-brand-cyan" />
        <CardContent className="relative -mt-12 pb-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-brand-teal text-2xl font-bold text-white shadow-lg">
                {initials}
              </div>
              <div className="pb-2">
                <h1 className="text-2xl font-bold text-brand-ink">{fullName}</h1>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </p>
                {user.role === 'admin' && (
                  <Badge className="mt-1 bg-brand-gold text-white hover:bg-brand-gold">
                    <Shield className="mr-1 h-3 w-3" />
                    Administrator
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pb-2">
              {user.role === 'admin' && (
                <Button
                  onClick={() => navigate('admin')}
                  className="bg-brand-gold text-white hover:bg-brand-gold/90"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Go to Admin Panel
                </Button>
              )}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loyalty Points Card */}
      <Card className="mb-6 overflow-hidden border-brand-gold/30">
        <CardContent className="p-0">
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-amber-600 text-2xl font-bold text-white shadow-lg">
                ★
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loyalty Points</div>
                <div className="text-3xl font-bold text-brand-ink">{loyaltyPoints.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  Worth {formatAED(Math.floor(loyaltyPoints / 100) * 10)} · Earn 1 pt per AED spent
                </div>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs text-muted-foreground">Redemption Rate</div>
              <div className="text-sm font-semibold text-brand-gold">100 pts = 10 AED</div>
              <div className="text-[10px] text-muted-foreground">Max 50% per order</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-2">
          <TabsTrigger value="profile" className="gap-1.5">
            <UserIcon className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <Package className="h-4 w-4" />
            My Orders
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl text-brand-ink">Profile Information</CardTitle>
              <CardDescription>
                Update your personal details. Email cannot be changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-fn" className="text-sm font-medium">
                      First Name
                    </Label>
                    <Input
                      id="pf-fn"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-ln" className="text-sm font-medium">
                      Last Name
                    </Label>
                    <Input
                      id="pf-ln"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pf-email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pf-email"
                      type="email"
                      value={profile.email}
                      disabled
                      readOnly
                      className="cursor-not-allowed bg-muted pl-9 text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email is locked. Contact support to change it.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pf-phone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pf-phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+971 50 123 4567"
                      className="pl-9"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Last updated: {formatDate(new Date())}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setProfile({
                          firstName: user.firstName || '',
                          lastName: user.lastName || '',
                          phone: user.phone || '',
                          email: user.email,
                        })
                      }
                      disabled={savingProfile}
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingProfile}
                      className="bg-brand-teal text-white hover:bg-brand-teal-dark"
                    >
                      {savingProfile ? (
                        'Saving...'
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl text-brand-ink">
                <span>Order History</span>
                <Badge variant="secondary">{orders.length} order(s)</Badge>
              </CardTitle>
              <CardDescription>
                View your past enquiries and orders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <ShoppingBag className="h-8 w-8 text-brand-teal" />
                  </div>
                  <p className="font-semibold text-brand-ink">No orders yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Your submitted enquiries and orders will appear here. Start exploring our
                    catalogue to place an enquiry.
                  </p>
                  <Button
                    onClick={() => navigate('products')}
                    className="mt-4 bg-brand-teal text-white hover:bg-brand-teal-dark"
                  >
                    Browse Products
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="pl-3">Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="pl-3 font-medium text-brand-teal">
                              {o.orderNumber}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(o.createdAt)}
                            </TableCell>
                            <TableCell>{o.items?.length || 0} item(s)</TableCell>
                            <TableCell className="font-semibold text-brand-ink">
                              {formatAED(o.total)}
                            </TableCell>
                            <TableCell>
                              <span className="uppercase">{o.paymentMethod}</span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={o.orderStatus} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-brand-teal/40 text-brand-teal hover:bg-brand-teal hover:text-white"
                                onClick={() => navigate('track-order', {})}
                              >
                                Track
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {orders.map((o) => (
                      <div
                        key={o.id}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-brand-teal">{o.orderNumber}</span>
                          <StatusBadge status={o.orderStatus} />
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>Date: {formatDate(o.createdAt)}</p>
                          <p>Items: {o.items?.length || 0}</p>
                          <p>Payment: <span className="uppercase">{o.paymentMethod}</span></p>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-brand-ink">{formatAED(o.total)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-brand-teal/40 text-brand-teal hover:bg-brand-teal hover:text-white"
                            onClick={() => navigate('track-order', {})}
                          >
                            Track Order
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          onClick={() => navigate('wishlist')}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-brand-teal hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10">
            <HeartPulse className="h-5 w-5 text-brand-gold" />
          </div>
          <div>
            <p className="font-semibold text-brand-ink">My Wishlist</p>
            <p className="text-xs text-muted-foreground">View saved products</p>
          </div>
        </button>
        <button
          onClick={() => navigate('cart')}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-brand-teal hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal/10">
            <ShoppingBag className="h-5 w-5 text-brand-teal" />
          </div>
          <div>
            <p className="font-semibold text-brand-ink">Enquiry Cart</p>
            <p className="text-xs text-muted-foreground">Continue your enquiry</p>
          </div>
        </button>
        <button
          onClick={() => navigate('products')}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-brand-teal hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-cyan/10">
            <Package className="h-5 w-5 text-brand-cyan" />
          </div>
          <div>
            <p className="font-semibold text-brand-ink">Browse Catalogue</p>
            <p className="text-xs text-muted-foreground">Explore medical equipment</p>
          </div>
        </button>
      </div>
    </div>
  )
}
