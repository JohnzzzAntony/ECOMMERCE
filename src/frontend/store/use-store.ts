'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Product, User } from '@/shared/types'
import type { StorefrontTheme } from '@/shared/theme'

// SPA route definitions
export type ViewKey =
  | 'home'
  | 'products'
  | 'products-category'
  | 'products-brand'
  | 'products-collection'
  | 'products-search'
  | 'product-detail'
  | 'cart'
  | 'wishlist'
  | 'blog'
  | 'blog-detail'
  | 'about'
  | 'contact'
  | 'store-locations'
  | 'faq'
  | 'shipping-info'
  | 'terms'
  | 'privacy'
  | 'offers'
  | 'login'
  | 'register'
  | 'profile'
  | 'admin'
  | 'compare'
  | 'track-order'
  | 'page'

export interface NavParams {
  slug?: string
  categorySlug?: string
  brandSlug?: string
  collectionSlug?: string
  query?: string
  onSale?: boolean
  [key: string]: string | boolean | undefined
}

type CartLine = { productId: string; quantity: number; product: Product; size?: string }

interface AppState {
  // Navigation
  view: ViewKey
  params: NavParams
  navigate: (view: ViewKey, params?: NavParams) => void

  // Language
  lang: 'en' | 'ar'
  toggleLang: () => void
  setLang: (lang: 'en' | 'ar') => void

  // Cart
  cart: CartLine[]
  salonBag: CartLine[]
  salonDark: boolean
  setSalonDark: (dark: boolean) => void
  addToCart: (product: Product, quantity?: number, selection?: { channel: "ombrine"; size?: string }) => void
  removeFromCart: (productId: string, channel?: "ombrine") => void
  updateCartQty: (productId: string, quantity: number, channel?: "ombrine") => void
  clearCart: (channel?: "ombrine") => void
  cartCount: () => number
  cartTotal: () => number

  // Wishlist (localStorage)
  wishlist: string[] // product ids
  toggleWishlist: (productId: string) => void
  isInWishlist: (productId: string) => boolean

  // Auth
  user: User | null
  setUser: (user: User | null) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Mobile menu
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  // Cart drawer
  cartDrawerOpen: boolean
  setCartDrawerOpen: (open: boolean) => void

  // Active theme + menus (not persisted: always the server's current copy)
  theme: StorefrontTheme | null
  setTheme: (t: StorefrontTheme) => void
  /** Set by a custom page that brings its own header/footer. */
  pageHidesChrome: boolean
  setPageHidesChrome: (hidden: boolean) => void

  // Settings
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void

  // Recently viewed products (localStorage, max 8)
  recentlyViewed: string[]
  addRecentlyViewed: (productId: string) => void

  // Product comparison (localStorage, max 4)
  compareList: string[]
  toggleCompare: (productId: string) => void
  isInCompare: (productId: string) => boolean
  clearCompare: () => void
  compareCount: () => number

  // Quick view modal
  quickViewProduct: Product | null
  setQuickViewProduct: (p: Product | null) => void

  // Recent searches (localStorage, max 6)
  recentSearches: string[]
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void

  // Toast notifications (in-app email simulation)
  notifications: { id: string; type: string; title: string; message: string; read: boolean; createdAt: number }[]
  addNotification: (n: { type: string; title: string; message: string }) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  unreadCount: () => number

  // Loyalty points (earn 1 point per AED spent, 100 points = 10 AED discount)
  loyaltyPoints: number
  addLoyaltyPoints: (amount: number) => void
  spendLoyaltyPoints: (amount: number) => boolean
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'home',
      params: {},
      navigate: (view, params = {}) => {
        set({ view, params, mobileMenuOpen: false })
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },

      lang: 'en',
      toggleLang: () => set((s) => ({ lang: s.lang === 'en' ? 'ar' : 'en' })),
      setLang: (lang) => set({ lang }),

      cart: [],
      salonBag: [],
      salonDark: false,
      setSalonDark: (salonDark) => set({ salonDark }),
      addToCart: (product, quantity = 1, selection) => {
        const list = selection ? 'salonBag' : 'cart'
        const key = selection ? JSON.stringify([product.id, selection.size ?? '']) : product.id
        set((s) => {
          const cart = s[list]
          const existing = cart.find((item) => item.productId === key)
          const qty = (existing?.quantity ?? 0) + quantity
          const line = { productId: key, product, size: selection?.size, quantity: selection ? Math.min(99, qty) : qty }
          const next = existing ? cart.map((item) => item === existing ? line : item) : [...cart, line]
          return list === 'salonBag' ? { salonBag: next } : { cart: next }
        })
      },
      removeFromCart: (productId, channel) => set((s) => {
        const list = channel ? s.salonBag : s.cart
        const next = list.filter((item) => item.productId !== productId)
        return channel ? { salonBag: next } : { cart: next }
      }),
      updateCartQty: (productId, quantity, channel) => set((s) => {
        const list = channel ? s.salonBag : s.cart
        const next = list.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item)
        return channel ? { salonBag: next } : { cart: next }
      }),
      clearCart: (channel) => set(channel ? { salonBag: [] } : { cart: [] }),
      cartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),
      cartTotal: () =>
        get().cart.reduce((sum, i) => {
          const price = i.product.onSale && i.product.salePrice ? i.product.salePrice : i.product.regularPrice
          return sum + price * i.quantity
        }, 0),

      wishlist: [],
      toggleWishlist: (productId) =>
        set((s) => ({
          wishlist: s.wishlist.includes(productId)
            ? s.wishlist.filter((id) => id !== productId)
            : [...s.wishlist, productId],
        })),
      isInWishlist: (productId) => get().wishlist.includes(productId),

      user: null,
      setUser: (user) => set({ user }),

      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      cartDrawerOpen: false,
      setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),

      theme: null,
      setTheme: (theme) => set({ theme }),
      pageHidesChrome: false,
      setPageHidesChrome: (pageHidesChrome) => set({ pageHidesChrome }),

      settings: {},
      setSettings: (s) => set({ settings: s }),

      recentlyViewed: [],
      addRecentlyViewed: (productId) =>
        set((s) => ({
          recentlyViewed: [
            productId,
            ...s.recentlyViewed.filter((id) => id !== productId),
          ].slice(0, 8),
        })),

      compareList: [],
      toggleCompare: (productId) =>
        set((s) => {
          if (s.compareList.includes(productId)) {
            return { compareList: s.compareList.filter((id) => id !== productId) }
          }
          if (s.compareList.length >= 4) {
            return { compareList: [...s.compareList.slice(1), productId] }
          }
          return { compareList: [...s.compareList, productId] }
        }),
      isInCompare: (productId) => get().compareList.includes(productId),
      clearCompare: () => set({ compareList: [] }),
      compareCount: () => get().compareList.length,

      quickViewProduct: null,
      setQuickViewProduct: (p) => set({ quickViewProduct: p }),

      recentSearches: [],
      addRecentSearch: (q) =>
        set((s) => ({
          recentSearches: [
            q,
            ...s.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase()),
          ].slice(0, 6),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),

      notifications: [],
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { id: `n-${Date.now()}`, ...n, read: false, createdAt: Date.now() },
            ...s.notifications,
          ].slice(0, 20),
        })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      clearNotifications: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,

      loyaltyPoints: 0,
      addLoyaltyPoints: (amount) =>
        set((s) => ({ loyaltyPoints: s.loyaltyPoints + Math.floor(amount) })),
      spendLoyaltyPoints: (amount) => {
        const current = get().loyaltyPoints
        if (current < amount) return false
        set({ loyaltyPoints: current - amount })
        return true
      },
    }),
    {
      name: 'jkr-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lang: s.lang,
        cart: s.cart,
        salonBag: s.salonBag,
        salonDark: s.salonDark,
        wishlist: s.wishlist,
        user: s.user,
        settings: s.settings,
        recentlyViewed: s.recentlyViewed,
        compareList: s.compareList,
        recentSearches: s.recentSearches,
        notifications: s.notifications,
        loyaltyPoints: s.loyaltyPoints,
      }),
    }
  )
)

// Helper to apply RTL on language change
export function applyLangDir(lang: 'en' | 'ar') {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }
}
