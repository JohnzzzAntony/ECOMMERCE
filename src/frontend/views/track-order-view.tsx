'use client'

import { useState } from 'react'
import { Search, Package, CheckCircle2, Truck, Clock, XCircle, MapPin, ShoppingBag } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { formatAED, formatDate } from '@/frontend/lib/format'
import { toast } from 'sonner'
import type { Order } from '@/shared/types'

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100' },
  { key: 'shipped', label: 'Shipped', icon: Truck, color: 'text-cyan-500', bg: 'bg-cyan-100' },
  { key: 'delivered', label: 'Delivered', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-100' },
]

export function TrackOrderView() {
  const { navigate } = useStore()
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderNumber.trim()) {
      toast.error('Please enter your order number')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ orderNumber: orderNumber.trim() })
      if (email.trim()) params.set('email', email.trim())
      const res = await fetch(`/api/orders/track?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Not found' }))
        throw new Error(err.error || 'Order not found')
      }
      const data = await res.json()
      setOrder(data.order)
      toast.success('Order found!')
    } catch (err: any) {
      setOrder(null)
      toast.error(err.message || 'Order not found')
    } finally {
      setLoading(false)
    }
  }

  // Determine current step index
  const currentStepIndex = order
    ? order.orderStatus === 'cancelled'
      ? -1
      : STATUS_STEPS.findIndex((s) => s.key === order.orderStatus)
    : -1

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-teal to-brand-teal-dark py-10 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <button onClick={() => navigate('home')} className="hover:text-white">Home</button>
            <span>/</span>
            <span>Track Order</span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <Package size={28} /> Track Your Order
          </h1>
          <p className="mt-1 text-sm text-white/80">Enter your order number to see the current status and delivery progress.</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Search form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Order Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTrack} className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="orderNumber">Order Number *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. JKR-ORD-001"
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" className="w-full bg-brand-teal hover:bg-brand-teal-dark" disabled={loading}>
                  {loading ? 'Searching...' : 'Track Order'}
                </Button>
              </div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: Try the demo order number <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">JKR-ORD-001</code>
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !order && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle size={48} className="text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">Order not found</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                We couldn&apos;t find an order with that number. Please check your order number and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6">
            {/* Order info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
                  </div>
                  {order.orderStatus === 'cancelled' ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-600">
                      <XCircle size={14} /> Cancelled
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                      order.orderStatus === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      order.orderStatus === 'shipped' ? 'bg-cyan-100 text-cyan-700' :
                      order.orderStatus === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Customer</div>
                    <div className="mt-1 font-medium">{order.customerName}</div>
                    <div className="text-sm text-muted-foreground">{order.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Payment</div>
                    <div className="mt-1 font-medium uppercase">{order.paymentMethod}</div>
                    <div className="text-sm text-muted-foreground capitalize">{order.paymentStatus}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Total</div>
                    <div className="mt-1 text-lg font-bold text-brand-teal">{formatAED(order.total)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status timeline */}
            {order.orderStatus !== 'cancelled' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {/* Progress line */}
                    <div className="absolute left-6 top-6 h-[calc(100%-3rem)] w-0.5 bg-border sm:left-1/2" />
                    <div
                      className="absolute left-6 top-6 w-0.5 bg-brand-teal transition-all duration-500 sm:left-1/2"
                      style={{ height: currentStepIndex >= 0 ? `calc(${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}% )` : '0%' }}
                    />
                    <div className="space-y-8">
                      {STATUS_STEPS.map((step, idx) => {
                        const isCompleted = idx <= currentStepIndex
                        const isCurrent = idx === currentStepIndex
                        return (
                          <div key={step.key} className={`relative flex items-center gap-4 ${idx % 2 === 1 ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                              isCompleted ? `${step.bg} ${step.color} border-current` : 'bg-white border-border text-muted-foreground'
                            } ${isCurrent ? 'ring-4 ring-brand-teal/20 scale-110' : ''}`}>
                              <step.icon size={20} />
                            </div>
                            <div className={`flex-1 ${idx % 2 === 1 ? 'sm:text-right' : ''}`}>
                              <div className={`font-semibold ${isCompleted ? 'text-brand-ink' : 'text-muted-foreground'}`}>
                                {step.label}
                              </div>
                              {isCurrent && (
                                <div className="text-xs text-brand-teal">Current status</div>
                              )}
                              {isCompleted && !isCurrent && (
                                <div className="text-xs text-emerald-600">✓ Completed</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingBag size={18} /> Order Items ({order.items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{item.qty} × {formatAED(item.unitPrice)}</div>
                        <div className="font-semibold">{formatAED(item.subtotal)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-brand-teal">{formatAED(order.total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Shipping info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin size={18} /> Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    try {
                      const addr = JSON.parse(order.shippingAddress as any)
                      return (
                        <div>
                          <div>{addr.line1 || '—'}</div>
                          {addr.line2 && <div>{addr.line2}</div>}
                          <div>{[addr.city, addr.emirate, addr.country].filter(Boolean).join(', ')}</div>
                        </div>
                      )
                    } catch {
                      return <div>Dubai, UAE</div>
                    }
                  })()}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button variant="outline" onClick={() => navigate('home')}>
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
