'use client'

import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { formatAED, effectivePrice } from '@/frontend/lib/format'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/frontend/components/ui/sheet'

export function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen, cart, removeFromCart, updateCartQty, navigate, cartTotal } = useStore()

  return (
    <Sheet open={cartDrawerOpen} onOpenChange={setCartDrawerOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart size={18} /> Enquiry Cart ({cart.length})
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingCart size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Your enquiry cart is empty</p>
            <p className="text-xs text-muted-foreground">Add products to submit an enquiry to our team.</p>
            <button
              onClick={() => { setCartDrawerOpen(false); navigate('products') }}
              className="mt-2 rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
              {cart.map((item) => {
                const price = effectivePrice(item.product)
                return (
                  <div key={item.productId} className="flex gap-3 rounded-lg border border-border p-2">
                    {item.product.images?.[0] && (
                      <img src={item.product.images[0].imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                    )}
                    <div className="flex flex-1 flex-col">
                      <button
                        onClick={() => { setCartDrawerOpen(false); navigate('product-detail', { slug: item.product.slug }) }}
                        className="line-clamp-2 text-left text-xs font-semibold hover:text-brand-teal"
                      >
                        {item.product.name}
                      </button>
                      <div className="mt-1 text-xs font-bold text-brand-teal-dark">{formatAED(price)}</div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center rounded-md border border-border">
                          <button onClick={() => updateCartQty(item.productId, item.quantity - 1)} className="px-1.5 py-0.5 hover:bg-secondary" aria-label="Decrease">
                            <Minus size={12} />
                          </button>
                          <span className="px-2 text-xs font-medium">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.productId, item.quantity + 1)} className="px-1.5 py-0.5 hover:bg-secondary" aria-label="Increase">
                            <Plus size={12} />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-red-500" aria-label="Remove">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Estimated Total</span>
                <span className="text-lg font-bold text-brand-teal-dark">{formatAED(cartTotal())}</span>
              </div>
              <button
                onClick={() => { setCartDrawerOpen(false); navigate('cart') }}
                className="w-full rounded-lg bg-brand-teal py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark"
              >
                View Cart & Submit Enquiry
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
