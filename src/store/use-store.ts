'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Product, User } from '@/types'

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

export interface NavParams {
  slug?: string
  categorySlug?: string
  brandSlug?: string
  collectionSlug?: string
  query?: string
  onSale?: boolean
  [key: string]: string | boolean | undefined
}

interface CartState {
  items: { productId: string; quantity: number; product: Product }[]
}

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
  cart: { productId: string; quantity: number; product: Product }[]
  addToCart: (product: Product, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateCartQty: (productId: string, quantity: number) => void
  clearCart: () => void
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

  // Settings
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
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
      addToCart: (product, quantity = 1) => {
        const cart = get().cart
        const existing = cart.find((i) => i.productId === product.id)
        if (existing) {
          set({
            cart: cart.map((i) =>
              i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
            ),
          })
        } else {
          set({ cart: [...cart, { productId: product.id, quantity, product }] })
        }
      },
      removeFromCart: (productId) =>
        set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId) })),
      updateCartQty: (productId, quantity) =>
        set((s) => ({
          cart: s.cart.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        })),
      clearCart: () => set({ cart: [] }),
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

      settings: {},
      setSettings: (s) => set({ settings: s }),
    }),
    {
      name: 'jkr-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lang: s.lang,
        cart: s.cart,
        wishlist: s.wishlist,
        user: s.user,
        settings: s.settings,
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
