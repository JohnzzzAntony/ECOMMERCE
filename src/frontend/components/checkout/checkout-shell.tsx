'use client'
// Minimal page frame for checkout (no store chrome, so the shopper stays focused on paying).
import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/frontend/store/use-store'
import { ThemeContext } from '@/frontend/lib/theme'
import { StoreLogo } from '@/frontend/components/layout/header'
import type { StorefrontTheme } from '@/shared/theme'
import { isOmbrine } from '@/shared/ombrine'
import { OmbrineShell } from '@/frontend/components/theme/ombrine-shell'
import { FROM_CART_KEY } from './checkout-form'

/** `theme` = the active storefront theme, so the header shows the store's own logo. */
export function CheckoutShell({ title, theme, children }: { title: string; theme: StorefrontTheme | null; children: ReactNode }) {
  if (isOmbrine(theme)) return <OmbrineShell theme={theme}><section className="om-content om-checkout"><header><h1>{title}</h1></header>{children}</section></OmbrineShell>
  return (
    <ThemeContext.Provider value={theme}>
    <div className="min-h-screen bg-white">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Home"><StoreLogo /></a>
          <a href="/" className="text-sm text-muted-foreground hover:text-brand-ink">Continue shopping</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-brand-ink">{title}</h1>
        {children}
      </main>
    </div>
    </ThemeContext.Provider>
  )
}

/** Empties the cart once, after a paid checkout that started from the cart. */
export function ClearCartAfterPayment() {
  const clearCart = useStore((s) => s.clearCart)
  useEffect(() => {
    const source = sessionStorage.getItem(FROM_CART_KEY)
    if (source) { clearCart(source === 'ombrine' ? 'ombrine' : undefined); sessionStorage.removeItem(FROM_CART_KEY) }
  }, [clearCart])
  return null
}
