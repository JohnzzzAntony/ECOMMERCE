'use client'
// Minimal page frame for checkout (no store chrome, so the shopper stays focused on paying).
import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/frontend/store/use-store'
import { FROM_CART_KEY } from './checkout-form'

export function CheckoutShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 font-semibold text-brand-ink"><img src="/logo.svg" alt="" width={28} height={28} /> NexEcoms</a>
          <a href="/" className="text-sm text-muted-foreground hover:text-brand-ink">Continue shopping</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-brand-ink">{title}</h1>
        {children}
      </main>
    </div>
  )
}

/** Empties the cart once, after a paid checkout that started from the cart. */
export function ClearCartAfterPayment() {
  const clearCart = useStore((s) => s.clearCart)
  useEffect(() => {
    if (sessionStorage.getItem(FROM_CART_KEY)) { clearCart(); sessionStorage.removeItem(FROM_CART_KEY) }
  }, [clearCart])
  return null
}
