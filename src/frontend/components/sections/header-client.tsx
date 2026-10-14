'use client'
// Interactive parts of the header: live cart count, search and the mobile menu.
import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { linkHref } from '@/shared/store-pages'
import type { LinkValue } from '@/shared/sections/fields'

export function CartLink() {
  const count = useStore((s) => s.cart.reduce((n, i) => n + i.quantity, 0))
  const [mounted, setMounted] = useState(false)
  // The cart lives in localStorage, so the count is only known after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  return (
    <a href="/cart" className="relative inline-flex size-11 items-center justify-center rounded-full hover:bg-black/5" aria-label={`Cart${mounted && count ? `, ${count} item${count === 1 ? '' : 's'}` : ''}`}>
      <ShoppingBag className="size-5" aria-hidden />
      {mounted && count > 0 && <span className="absolute right-1 top-1 min-w-5 rounded-full px-1 text-center text-[11px] font-bold leading-5" style={{ background: 'var(--color-primary, #0D6B8C)', color: 'var(--color-on-primary, #fff)' }}>{count}</span>}
    </a>
  )
}

export function SearchBox() {
  return (
    <form action="/collections/all" role="search" className="hidden lg:block">
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-60" aria-hidden />
        <input name="q" type="search" placeholder="Search" className="h-10 w-48 rounded-full border border-current/20 bg-transparent pl-9 pr-3 text-sm" />
      </label>
    </form>
  )
}

export function MobileMenu({ menu }: { menu: { label: string; link: LinkValue }[] }) {
  const [open, setOpen] = useState(false)
  if (!menu.length) return null
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/5">
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Main" className="absolute inset-x-0 top-full z-40 border-t bg-[var(--color-background,#fff)] p-4 text-[var(--color-text,#111)] shadow-lg">
          <ul className="space-y-1">{menu.map((m, i) => <li key={i}><a href={linkHref(m.link) ?? '#'} className="block rounded-md px-3 py-3 text-base hover:bg-black/5">{m.label}</a></li>)}</ul>
        </nav>
      )}
    </div>
  )
}
