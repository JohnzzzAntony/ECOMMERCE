'use client'

import { useEffect, useState } from 'react'
import {
  Search, Heart, ShoppingCart, User, Menu, X, ChevronDown,
  Instagram, Facebook, MessageCircle, Phone, Mail, MapPin, Globe,
  Clock, ArrowUpRight,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { NotificationBell } from '@/components/layout/notification-bell'
import type { Category, Brand, Collection } from '@/types'
import { cn } from '@/lib/utils'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  NavigationMenu, NavigationMenuContent, NavigationMenuItem,
  NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'

export function Header() {
  const { navigate, lang, toggleLang, cartCount, wishlist, user, view, params, setMobileMenuOpen, mobileMenuOpen, setCartDrawerOpen, recentSearches, addRecentSearch, clearRecentSearches } = useStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    Promise.all([api.categories(), api.brands(), api.collections()]).then(([c, b, col]) => {
      setCategories(c); setBrands(b); setCollections(col)
    })
  }, [])

  const handleSearch = async (val: string) => {
    setSearchValue(val)
    if (val.length > 1) {
      const { products } = await api.products({ search: val, limit: 5 })
      setSearchResults(products)
      setShowSearch(true)
    } else {
      setSearchResults([])
      // Show recent searches when input is focused but empty
      setShowSearch(true)
    }
  }

  const submitSearch = (q?: string) => {
    const query = (q ?? searchValue).trim()
    if (query) {
      addRecentSearch(query)
      navigate('products-search', { query })
      setShowSearch(false)
      setSearchValue('')
    }
  }

  const navItems: { label: string; view: any }[] = [
    { label: 'Home', view: 'home' },
    { label: 'Offers', view: 'offers' },
    { label: 'Blog', view: 'blog' },
    { label: 'About', view: 'about' },
    { label: 'Contact', view: 'contact' },
    { label: 'Store Locations', view: 'store-locations' },
    { label: 'FAQ', view: 'faq' },
  ]

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Top announcement bar */}
      <div className="bg-brand-teal-dark text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">📦</span>
            <span>Free UAE Delivery on Purchases Above AED 2,000</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hidden hover:text-brand-cyan sm:inline" aria-label="Instagram">
              <Instagram size={14} />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="hidden hover:text-brand-cyan sm:inline" aria-label="Facebook">
              <Facebook size={14} />
            </a>
            <a href="https://wa.me/971501234567" target="_blank" rel="noreferrer" className="hover:text-brand-cyan" aria-label="WhatsApp">
              <MessageCircle size={14} />
            </a>
            <span className="text-white/30">|</span>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 rounded px-2 py-0.5 transition-colors hover:bg-white/10"
            >
              <Globe size={12} />
              {lang === 'en' ? 'EN | عر' : 'عر | EN'}
            </button>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden" aria-label="Open menu">
                <Menu size={24} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <MobileMenu categories={categories} brands={brands} collections={collections} navItems={navItems} />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <button onClick={() => navigate('home')} className="flex shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal text-white font-bold text-lg">
              JKR
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-base font-bold text-brand-ink">JKR International</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Medical Equipment</div>
            </div>
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-2xl">
            <div className="flex items-center rounded-lg border border-input bg-secondary px-3 py-2 focus-within:border-brand-teal focus-within:bg-white transition-colors">
              <Search size={16} className="text-muted-foreground" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                placeholder="Search for medical equipment, brands..."
                className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={submitSearch} className="ml-2 rounded-md bg-brand-teal px-3 py-1 text-xs font-semibold text-white hover:bg-brand-teal-dark">
                Search
              </button>
            </div>
            {showSearch && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-white shadow-lg scrollbar-thin">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { navigate('product-detail', { slug: p.slug }); setShowSearch(false); setSearchValue('') }}
                    className="flex w-full items-center gap-3 border-b border-border p-2 text-left last:border-0 hover:bg-secondary"
                  >
                    {p.images?.[0] && (
                      <img src={p.images[0].imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <div className="line-clamp-1 text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-brand-teal">{p.onSale && p.salePrice ? `${p.salePrice} AED` : `${p.regularPrice} AED`}</div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => submitSearch()}
                  className="w-full bg-secondary p-2 text-center text-xs font-semibold text-brand-teal hover:bg-accent"
                >
                  View all results →
                </button>
              </div>
            )}
            {/* Recent searches when no results */}
            {showSearch && searchResults.length === 0 && !searchValue && recentSearches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</span>
                  <button onClick={clearRecentSearches} className="text-[10px] font-medium text-brand-teal hover:underline">Clear</button>
                </div>
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onClick={() => submitSearch(q)}
                    className="flex w-full items-center gap-2 border-b border-border p-2 text-left text-sm last:border-0 hover:bg-secondary"
                  >
                    <Clock size={13} className="text-muted-foreground" />
                    <span className="flex-1">{q}</span>
                    <ArrowUpRight size={13} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <button
              onClick={() => navigate(user ? 'profile' : 'login')}
              className="flex flex-col items-center rounded-lg px-2 py-1.5 text-brand-ink transition-colors hover:bg-secondary"
              aria-label="Account"
            >
              <User size={20} />
              <span className="hidden text-[10px] font-medium sm:block">{user ? 'Account' : 'Login'}</span>
            </button>
            <button
              onClick={() => navigate('wishlist')}
              className="relative flex flex-col items-center rounded-lg px-2 py-1.5 text-brand-ink transition-colors hover:bg-secondary"
              aria-label="Wishlist"
            >
              <Heart size={20} />
              <span className="hidden text-[10px] font-medium sm:block">Wishlist</span>
              {wishlist.length > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[9px] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative flex flex-col items-center rounded-lg px-2 py-1.5 text-brand-ink transition-colors hover:bg-secondary"
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              <span className="hidden text-[10px] font-medium sm:block">Enquiry</span>
              {cartCount() > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-teal px-1 text-[9px] font-bold text-white">
                  {cartCount()}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop navigation */}
      <nav className="hidden border-b border-border bg-white lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
          <button
            onClick={() => navigate('home')}
            className={cn('px-3 py-2.5 text-sm font-medium transition-colors hover:text-brand-teal', view === 'home' && 'text-brand-teal')}
          >
            Home
          </button>

          {/* Categories mega menu */}
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-medium data-[state=open]:text-brand-teal">
                  Categories
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[600px] grid-cols-2 gap-2 p-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => navigate('products-category', { categorySlug: cat.slug })}
                        className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"
                      >
                        {cat.imageUrl && (
                          <img src={cat.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                        )}
                        <div>
                          <div className="text-sm font-semibold">{cat.name}</div>
                          {cat.children?.length ? (
                            <div className="text-[11px] text-muted-foreground">{cat.children.length} subcategories</div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-medium data-[state=open]:text-brand-teal">
                  Brands
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[480px] grid-cols-2 gap-1 p-4">
                    {brands.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => navigate('products-brand', { brandSlug: b.slug })}
                        className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-secondary"
                      >
                        {b.logoUrl && (
                          <img src={b.logoUrl} alt="" className="h-8 w-12 rounded object-contain" />
                        )}
                        <div>
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-[11px] text-muted-foreground">{b._count?.products || 0} products</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-medium data-[state=open]:text-brand-teal">
                  Collections
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[400px] gap-1 p-4">
                    {collections.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigate('products-collection', { collectionSlug: c.slug })}
                        className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"
                      >
                        {c.bannerImageUrl && (
                          <img src={c.bannerImageUrl} alt="" className="h-12 w-20 rounded object-cover" />
                        )}
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c._count?.products || 0} products</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {navItems.slice(1).map((item) => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn('px-3 py-2.5 text-sm font-medium transition-colors hover:text-brand-teal', view === item.view && 'text-brand-teal')}
            >
              {item.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone size={12} /> +971 4 123 4567</span>
            <span className="hidden items-center gap-1 xl:flex"><Mail size={12} /> info@jkrintl.com</span>
          </div>
        </div>
      </nav>
    </header>
  )
}

function MobileMenu({ categories, brands, collections, navItems }: any) {
  const { navigate, setMobileMenuOpen } = useStore()
  return (
    <div className="mt-4 space-y-1">
      <button onClick={() => { navigate('home'); setMobileMenuOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-secondary">Home</button>

      <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">Categories</div>
      <div className="max-h-48 overflow-y-auto scrollbar-thin">
        {categories.map((c: Category) => (
          <button key={c.id} onClick={() => { navigate('products-category', { categorySlug: c.slug }); setMobileMenuOpen(false) }} className="block w-full rounded-lg px-4 py-1.5 text-left text-sm hover:bg-secondary">{c.name}</button>
        ))}
      </div>

      <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">Brands</div>
      <div className="max-h-48 overflow-y-auto scrollbar-thin">
        {brands.map((b: Brand) => (
          <button key={b.id} onClick={() => { navigate('products-brand', { brandSlug: b.slug }); setMobileMenuOpen(false) }} className="block w-full rounded-lg px-4 py-1.5 text-left text-sm hover:bg-secondary">{b.name}</button>
        ))}
      </div>

      <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">Collections</div>
      {collections.map((c: Collection) => (
        <button key={c.id} onClick={() => { navigate('products-collection', { collectionSlug: c.slug }); setMobileMenuOpen(false) }} className="block w-full rounded-lg px-4 py-1.5 text-left text-sm hover:bg-secondary">{c.name}</button>
      ))}

      <div className="border-t border-border pt-2">
        {navItems.slice(1).map((item: any) => (
          <button key={item.view} onClick={() => { navigate(item.view); setMobileMenuOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-secondary">{item.label}</button>
        ))}
      </div>
    </div>
  )
}
