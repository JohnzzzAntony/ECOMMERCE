'use client'
import { useMemo, useState } from 'react'
import { ClipboardList, Eye, RefreshCw, Search, Send, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import { formatAED, formatDate } from '@/frontend/lib/format'
import type { Enquiry, Order } from '@/shared/types'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { LoadError, StatusBadge } from './shared'

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']
const ENQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'closed']
const ALL = 'all'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function parseJson<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) ?? fallback } catch { return fallback }
}

function StatusSelect({ value, options, onChange, className = 'w-40' }: { value: string; options: string[]; onChange: (v: string) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o === ALL ? 'All statuses' : cap(o)}</SelectItem>)}</SelectContent>
    </Select>
  )
}

const matches = (q: string, ...values: (string | null | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q))

export function OrdersEnquiriesSection() {
  const orders = useAdminList<Order>('/api/orders')
  const enquiries = useAdminList<Enquiry>('/api/enquiries')
  const [tab, setTab] = useState('orders')
  const [query, setQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState(ALL)
  const [enquiryFilter, setEnquiryFilter] = useState(ALL)
  const [openOrder, setOpenOrder] = useState<Order | null>(null)
  const [openEnquiry, setOpenEnquiry] = useState<Enquiry | null>(null)

  const q = query.trim().toLowerCase()
  const visibleOrders = useMemo(() => orders.items.filter((o) =>
    (orderFilter === ALL || o.orderStatus === orderFilter) && (!q || matches(q, o.orderNumber, o.customerName, o.email, o.phone))), [orders.items, orderFilter, q])
  const visibleEnquiries = useMemo(() => enquiries.items.filter((e) =>
    (enquiryFilter === ALL || e.status === enquiryFilter) && (!q || matches(q, e.customerName, e.email, e.company, e.phone))), [enquiries.items, enquiryFilter, q])
  const newCount = enquiries.items.filter((e) => e.status === 'new').length

  const updateOrder = async (order: Order, data: Partial<Pick<Order, 'orderStatus' | 'paymentStatus'>>) => {
    try {
      const { order: saved } = await adminApi.put<{ order: Order }>('/api/admin/orders', { id: order.id, ...data })
      orders.setItems((prev) => prev.map((o) => (o.id === saved.id ? saved : o)))
      setOpenOrder(saved)
      toast.success(`Order ${saved.orderNumber} updated`)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const saveEnquiry = (saved: Enquiry) => {
    enquiries.setItems((prev) => prev.map((e) => (e.id === saved.id ? saved : e)))
    setOpenEnquiry(saved)
  }

  const refresh = () => { orders.reload(); enquiries.reload() }

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="size-4" /> Orders ({orders.items.length})</TabsTrigger>
            <TabsTrigger value="enquiries" className="gap-1.5">
              <ClipboardList className="size-4" /> Enquiries ({enquiries.items.length})
              {newCount > 0 && <Badge className="ml-1 h-5 border-0 bg-purple-600 px-1.5 text-white">{newCount} new</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, order #…" className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh"><RefreshCw className="size-4" /></Button>
          </div>
        </div>

        <TabsContent value="orders" className="mt-4 space-y-4">
          <StatusSelect value={orderFilter} options={[ALL, ...ORDER_STATUSES]} onChange={setOrderFilter} />
          {orders.error ? <LoadError message={orders.error} onRetry={orders.reload} /> : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead>
                      <TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.loading && orders.items.length === 0 ? (
                      Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
                    ) : visibleOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No orders found.</TableCell></TableRow>
                    ) : visibleOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                        <TableCell><div className="font-medium">{o.customerName}</div><div className="text-xs text-muted-foreground">{o.email}</div></TableCell>
                        <TableCell>{o.items?.length || 0}</TableCell>
                        <TableCell className="text-right font-medium">{formatAED(o.total)}</TableCell>
                        <TableCell><div className="flex flex-col items-start gap-1"><Badge variant="secondary" className="text-[10px] uppercase">{o.paymentMethod}</Badge><StatusBadge status={o.paymentStatus} /></div></TableCell>
                        <TableCell><StatusBadge status={o.orderStatus} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setOpenOrder(o)}><Eye className="size-4" /> View</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="enquiries" className="mt-4 space-y-4">
          <StatusSelect value={enquiryFilter} options={[ALL, ...ENQUIRY_STATUSES]} onChange={setEnquiryFilter} />
          {enquiries.error ? <LoadError message={enquiries.error} onRetry={enquiries.reload} /> : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead><TableHead>Company</TableHead><TableHead>Contact</TableHead>
                      <TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enquiries.loading && enquiries.items.length === 0 ? (
                      Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
                    ) : visibleEnquiries.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No enquiries found.</TableCell></TableRow>
                    ) : visibleEnquiries.map((e) => (
                      <TableRow key={e.id} className={e.status === 'new' ? 'bg-purple-50/40' : ''}>
                        <TableCell className="font-medium">{e.customerName}</TableCell>
                        <TableCell className="text-muted-foreground">{e.company || '—'}</TableCell>
                        <TableCell><div className="text-xs">{e.email}</div><div className="text-xs text-muted-foreground">{e.phone || '—'}</div></TableCell>
                        <TableCell className="text-right font-medium">{formatAED(e.total)}</TableCell>
                        <TableCell><StatusBadge status={e.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setOpenEnquiry(e)}><Eye className="size-4" /> View</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} onUpdate={updateOrder} />
      <EnquiryDialog enquiry={openEnquiry} onClose={() => setOpenEnquiry(null)} onSaved={saveEnquiry} />
    </div>
  )
}

function OrderDialog({ order: o, onClose, onUpdate }: {
  order: Order | null
  onClose: () => void
  onUpdate: (o: Order, data: Partial<Pick<Order, 'orderStatus' | 'paymentStatus'>>) => void
}) {
  const address = o ? parseJson<Record<string, string>>(o.shippingAddress, {}) : {}
  const addressText = Object.values(address).filter(Boolean).join(', ')
  return (
    <Dialog open={!!o} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {o && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShoppingCart className="size-5 text-brand-teal" /> Order {o.orderNumber}</DialogTitle>
              <DialogDescription>Placed on {formatDate(o.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Customer</div>
                <div className="font-medium">{o.customerName}</div>
                <a href={`mailto:${o.email}`} className="block text-sm text-brand-teal hover:underline">{o.email}</a>
                <div className="text-sm text-muted-foreground">{o.phone || '—'}</div>
                {addressText && <div className="mt-2 text-sm text-muted-foreground">{addressText}</div>}
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Fulfilment</div>
                <div className="flex items-center justify-between gap-2 text-sm">Order status<StatusSelect className="w-36" value={o.orderStatus} options={ORDER_STATUSES} onChange={(v) => onUpdate(o, { orderStatus: v })} /></div>
                <div className="flex items-center justify-between gap-2 text-sm">Payment ({o.paymentMethod.toUpperCase()})<StatusSelect className="w-36" value={o.paymentStatus} options={PAYMENT_STATUSES} onChange={(v) => onUpdate(o, { paymentStatus: v })} /></div>
              </div>
            </div>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                <TableBody>
                  {o.items?.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell><div className="font-medium">{it.productName}</div><div className="text-xs text-muted-foreground">{it.sku || '—'}</div></TableCell>
                      <TableCell className="text-right">{it.qty}</TableCell>
                      <TableCell className="text-right">{formatAED(it.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatAED(it.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"><span className="font-semibold">Total</span><span className="text-lg font-bold text-brand-teal">{formatAED(o.total)}</span></div>
            {o.notes && <div className="rounded-lg border border-border p-3"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Customer notes</div><p className="whitespace-pre-wrap text-sm">{o.notes}</p></div>}
            <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EnquiryDialog({ enquiry: e, onClose, onSaved }: { enquiry: Enquiry | null; onClose: () => void; onSaved: (e: Enquiry) => void }) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const items = e ? parseJson<{ name: string; qty?: number; price?: number }[]>(e.itemsJson, []) : []

  const setStatus = async (status: string) => {
    if (!e) return
    try {
      const { enquiry } = await adminApi.put<{ enquiry: Enquiry }>('/api/admin/enquiries', { id: e.id, status })
      onSaved(enquiry)
      toast.success(`Marked as ${status}`)
    } catch (err) { toast.error(errorMessage(err)) }
  }

  const send = async () => {
    if (!e || !reply.trim()) return
    setSending(true)
    try {
      const res = await adminApi.put<{ enquiry: Enquiry; emailed: boolean }>('/api/admin/enquiries/respond', {
        id: e.id, response: reply.trim(), status: e.status === 'new' ? 'contacted' : e.status,
      })
      onSaved(res.enquiry)
      setReply('')
      if (res.emailed) toast.success(`Reply emailed to ${e.email}`)
      else toast.warning('Reply saved, but the email could not be sent. Check the Resend settings, or contact the customer directly.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={!!e} onOpenChange={(open) => { if (!open) { setReply(''); onClose() } }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {e && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-brand-cyan" /> Enquiry from {e.customerName}</DialogTitle>
              <DialogDescription>Submitted on {formatDate(e.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Customer</div>
                <div className="font-medium">{e.customerName}</div>
                <div className="text-sm text-muted-foreground">{e.company || '—'}</div>
                <a href={`mailto:${e.email}`} className="block text-sm text-brand-teal hover:underline">{e.email}</a>
                {e.phone && <a href={`tel:${e.phone}`} className="block text-sm text-muted-foreground">{e.phone}</a>}
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Status</div>
                <StatusSelect className="w-full" value={e.status} options={ENQUIRY_STATUSES} onChange={setStatus} />
                <div className="text-sm">Estimated value: <span className="font-semibold text-brand-teal">{formatAED(e.total)}</span></div>
              </div>
            </div>
            {items.length > 0 && (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
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
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Message & replies</div>
                <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">{e.message}</p>
              </div>
            )}
            <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-3">
              <Label>Reply to customer</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Emailed to {e.email} and saved to this enquiry.</p>
              <Textarea value={reply} onChange={(ev) => setReply(ev.target.value)} rows={4} className="mt-2 bg-background" placeholder="Thank you for your enquiry. We can offer…" />
              <div className="mt-2 flex justify-end">
                <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!reply.trim() || sending} onClick={send}>
                  <Send className="size-4" /> {sending ? 'Sending…' : 'Send Reply'}
                </Button>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
