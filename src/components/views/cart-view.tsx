'use client'

import { useState, useMemo } from 'react'
import { Minus, Plus, Trash2, ShoppingBag, Send, ArrowRight, CreditCard, Wallet, Banknote, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { formatAED, effectivePrice, discountPercent } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function CartView() {
  const {
    cart,
    removeFromCart,
    updateCartQty,
    clearCart,
    cartTotal,
    navigate,
    user,
  } = useStore()

  const [notes, setNotes] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null)
  const [form, setForm] = useState({
    customerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: '',
    message: '',
  })

  // Compute subtotal (regular) vs sale total to derive discount
  const { subtotal, discount, total, promoDiscount } = useMemo(() => {
    const sub = cart.reduce((s, i) => s + i.product.regularPrice * i.quantity, 0)
    const tot = cartTotal()
    const promoDisc = appliedPromo ? tot * (appliedPromo.percent / 100) : 0
    return { subtotal: sub, discount: Math.max(0, sub - tot), total: tot - promoDisc, promoDiscount: promoDisc }
  }, [cart, cartTotal, appliedPromo])

  // Promo code validation
  const VALID_PROMOS: Record<string, number> = {
    'JKR10': 10,
    'MEDICAL20': 20,
    'WELCOME15': 15,
    'DUBAI2026': 25,
  }

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase()
    if (!code) {
      toast.error('Please enter a promo code')
      return
    }
    if (VALID_PROMOS[code]) {
      setAppliedPromo({ code, percent: VALID_PROMOS[code] })
      toast.success(`Promo code applied: ${code}% off!`)
    } else {
      toast.error('Invalid promo code')
      setAppliedPromo(null)
    }
  }

  const removePromo = () => {
    setAppliedPromo(null)
    setPromoCode('')
    toast.success('Promo code removed')
  }

  const openEnquiryDialog = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty')
      return
    }
    setForm((f) => ({
      ...f,
      message: notes,
      customerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : f.customerName,
      email: user?.email || f.email,
      phone: user?.phone || f.phone,
    }))
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Please fill in name, email and phone')
      return
    }
    setSubmitting(true)
    try {
      const items = cart.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        sku: i.product.sku || '',
        price: effectivePrice(i.product),
        qty: i.quantity,
      }))
      await api.enquiry({
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        message: form.message.trim(),
        items,
      })
      toast.success('Enquiry submitted! Our team will contact you shortly.')
      clearCart()
      setNotes('')
      setDialogOpen(false)
      navigate('home')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit enquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Empty state
  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-12 w-12 text-brand-teal" />
          </div>
          <h1 className="text-3xl font-bold text-brand-ink">Your Enquiry Cart is Empty</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Browse our catalogue of premium medical equipment and add items to your enquiry cart.
            Our team will get back to you with pricing and availability.
          </p>
          <Button
            onClick={() => navigate('products')}
            className="mt-8 bg-brand-teal text-white hover:bg-brand-teal-dark"
            size="lg"
          >
            Continue Shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Your Enquiry Cart
        </h1>
        <p className="mt-2 text-muted-foreground">
          Submit your enquiry and our team will contact you with pricing &amp; availability.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LEFT: Cart Items */}
        <div className="lg:col-span-2">
          <Card className="border-border">
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Cart Items ({cart.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Remove all items from cart?')) {
                      clearCart()
                      toast.success('Cart cleared')
                    }
                  }}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {cart.map((item) => {
                  const unitPrice = effectivePrice(item.product)
                  const hasDiscount =
                    item.product.onSale && item.product.salePrice
                  const lineTotal = unitPrice * item.quantity
                  const img = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0]
                  return (
                    <li
                      key={item.productId}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6"
                    >
                      {/* Image */}
                      <button
                        onClick={() => navigate('product-detail', { slug: item.product.slug })}
                        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
                        aria-label={`View ${item.product.name}`}
                      >
                        {img ? (
                          <img
                            src={img.imageUrl}
                            alt={img.altText || item.product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </button>

                      {/* Details */}
                      <div className="flex flex-1 flex-col gap-1">
                        {item.product.brand && (
                          <span className="text-[11px] font-medium uppercase tracking-wide text-brand-cyan">
                            {item.product.brand.name}
                          </span>
                        )}
                        <button
                          onClick={() => navigate('product-detail', { slug: item.product.slug })}
                          className="text-left text-sm font-semibold leading-snug text-brand-ink hover:text-brand-teal sm:text-base"
                        >
                          {item.product.name}
                        </button>
                        {item.product.sku && (
                          <span className="text-xs text-muted-foreground">SKU: {item.product.sku}</span>
                        )}
                        <div className="mt-1 flex items-baseline gap-2">
                          {hasDiscount && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatAED(item.product.regularPrice)}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-brand-teal-dark">
                            {formatAED(unitPrice)}
                          </span>
                          {hasDiscount && (
                            <Badge className="bg-brand-gold text-white hover:bg-brand-gold">
                              {discountPercent(item.product.regularPrice, item.product.salePrice!)}% OFF
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="flex h-8 w-8 items-center justify-center text-brand-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              if (!isNaN(v) && v >= 1) updateCartQty(item.productId, v)
                            }}
                            className="h-8 w-12 border-0 text-center text-sm focus-visible:ring-0"
                            min={1}
                          />
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center text-brand-ink transition-colors hover:bg-muted"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-brand-ink sm:min-w-[90px] sm:text-right">
                            {formatAED(lineTotal)}
                          </span>
                          <button
                            onClick={() => {
                              removeFromCart(item.productId)
                              toast.success('Item removed from cart')
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="mt-6 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes / Special Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific requirements, delivery timelines, configurations, or questions you'd like to include with your enquiry..."
                rows={4}
                className="resize-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                These notes will be included with your enquiry submission.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <Card className="border-border">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({cart.length} items)</span>
                  <span className="font-medium text-brand-ink">{formatAED(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-gold">Sale Discount</span>
                    <span className="font-medium text-brand-gold">− {formatAED(discount)}</span>
                  </div>
                )}

                {/* Promo code section */}
                {!appliedPromo ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Have a promo code?</Label>
                    <div className="flex gap-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                        placeholder="Enter code"
                        className="text-sm uppercase"
                      />
                      <Button onClick={applyPromo} variant="outline" size="sm" className="shrink-0 border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white">
                        Apply
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Try: JKR10, MEDICAL20, WELCOME15, DUBAI2026</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <div>
                        <div className="text-xs font-semibold text-emerald-700">{appliedPromo.code} ({appliedPromo.percent}% off)</div>
                        <div className="text-[10px] text-emerald-600">− {formatAED(promoDiscount)}</div>
                      </div>
                    </div>
                    <button onClick={removePromo} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                )}

                <Separator />
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-brand-ink">Total</span>
                  <span className="text-xl font-bold text-brand-teal-dark">{formatAED(total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Indicative total. Final pricing will be confirmed by our team.
                </p>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={openEnquiryDialog}
                    className="w-full bg-brand-teal text-white hover:bg-brand-teal-dark"
                    size="lg"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Enquiry
                  </Button>
                  <Button
                    onClick={() => navigate('products')}
                    variant="outline"
                    className="w-full border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
                    size="lg"
                  >
                    Continue Shopping
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Options */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-brand-teal" />
                  Payment Options
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1 border-brand-teal/30 py-1.5 pl-2 pr-3 text-xs">
                    <Wallet className="h-3 w-3 text-brand-teal" />
                    Tabby
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-brand-teal/30 py-1.5 pl-2 pr-3 text-xs">
                    <Wallet className="h-3 w-3 text-brand-teal" />
                    Tamara
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-brand-teal/30 py-1.5 pl-2 pr-3 text-xs">
                    <Banknote className="h-3 w-3 text-brand-teal" />
                    Cash on Delivery
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-brand-teal/30 py-1.5 pl-2 pr-3 text-xs">
                    <CreditCard className="h-3 w-3 text-brand-teal" />
                    Network International
                  </Badge>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  This is an enquiry-based checkout. Our team will confirm payment terms and availability
                  before processing.
                </p>
              </CardContent>
            </Card>

            {/* Trust signals */}
            <div className="rounded-lg border border-border bg-card p-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                  Genuine products with manufacturer warranty
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                  Free expert consultation &amp; setup guidance
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                  Delivery across UAE &amp; GCC region
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Enquiry Submit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-brand-ink">Submit Your Enquiry</DialogTitle>
            <DialogDescription>
              Fill in your contact details and our team will reach out within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="enq-name" className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="enq-name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enq-email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="enq-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enq-phone" className="text-sm font-medium">
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="enq-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                placeholder="+971 50 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enq-company" className="text-sm font-medium">
                Company <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="enq-company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Hospital / Clinic name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enq-msg" className="text-sm font-medium">
                Message <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="enq-msg"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Specific requirements, questions..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-brand-ink">Enquiry Summary</p>
              <p>{cart.length} item(s) • Indicative total: {formatAED(total)}</p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-teal text-white hover:bg-brand-teal-dark"
              >
                {submitting ? 'Submitting...' : 'Submit Enquiry'}
                {!submitting && <Send className="ml-2 h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
