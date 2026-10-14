// Client-side API helpers for NexEcoms
import type {
  Product, Category, Brand, Collection, BlogPost,
  Testimonial, ClientLogo, HeroSlide, GalleryItem, Order, Enquiry, User,
} from '@/shared/types'
import type { StorefrontTheme } from '@/shared/theme'

export interface PublicPage {
  slug: string
  title: string
  content: string
  css: string
  bodyClass: string
  layout: 'standard' | 'isolated'
  hideHeaderFooter: boolean
  metaTitle: string | null
  metaDescription: string | null
  /** Stylesheet of the HTML template this page came from ('' for others). */
  themeCssUrl: string
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

// Header, homepage and listing views ask for the same taxonomy/content lists; share one request per minute.
const shared = new Map<string, { at: number; value: Promise<unknown> }>()
function sharedGet<T>(url: string): Promise<T> {
  const hit = shared.get(url)
  if (hit && Date.now() - hit.at < 60_000) return hit.value as Promise<T>
  const value = fetchJson<T>(url)
  shared.set(url, { at: Date.now(), value })
  value.catch(() => shared.delete(url))
  return value
}

export const api = {
  // Products
  products: (params?: Record<string, string | boolean | undefined>) => {
    const q = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') q.set(k, String(v))
      })
    }
    const qs = q.toString()
    return fetchJson<{ products: Product[]; total: number; page: number; totalPages: number }>(
      `/api/products${qs ? `?${qs}` : ''}`
    )
  },
  /** Products by id, in the given order (wishlist, compare, recently viewed). */
  productsByIds: async (ids: string[]) => {
    if (!ids.length) return [] as Product[]
    const { products } = await fetchJson<{ products: Product[] }>(`/api/products?ids=${ids.map(encodeURIComponent).join(',')}`)
    return [...products].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  },
  product: (slug: string) =>
    fetchJson<{ product: Product; related: Product[] }>(`/api/products/${slug}`),

  // Taxonomy
  categories: () => sharedGet<Category[]>('/api/categories'),
  brands: () => sharedGet<Brand[]>('/api/brands'),
  collections: () => sharedGet<Collection[]>('/api/collections'),

  // Content
  blog: (params?: { category?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.limit) q.set('limit', String(params.limit))
    return fetchJson<BlogPost[]>(`/api/blog${q.toString() ? `?${q}` : ''}`)
  },
  blogPost: (slug: string) =>
    fetchJson<{ post: BlogPost; related: BlogPost[] }>(`/api/blog/${slug}`),
  testimonials: () => sharedGet<Testimonial[]>('/api/testimonials'),
  clients: () => sharedGet<ClientLogo[]>('/api/clients'),
  slider: () => sharedGet<HeroSlide[]>('/api/slider'),
  gallery: () => sharedGet<GalleryItem[]>('/api/gallery'),
  settings: () => fetchJson<Record<string, string>>('/api/settings'),
  theme: () => fetchJson<StorefrontTheme>('/api/theme', { cache: 'no-store' }),
  page: (slug: string) => fetchJson<PublicPage>(`/api/pages/${encodeURIComponent(slug)}`),

  // Actions
  newsletter: (email: string) =>
    fetchJson('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  contact: (data: Record<string, string>) =>
    fetchJson('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  review: (data: { productId: string; authorName: string; rating: number; reviewText: string }) =>
    fetchJson('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  order: (data: any) =>
    fetchJson<{ ok: boolean; order: Order }>('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  /** Creates an unpaid order priced on the server and returns Stripe's payment page URL. */
  checkout: (data: { items: { productId: string; qty: number }[]; customerName: string; email: string; phone?: string; notes?: string; returnPath?: string }) =>
    fetchJson<{ url: string; orderNumber: string }>('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  enquiry: (data: any) =>
    fetchJson<{ ok: boolean; enquiry: Enquiry }>('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Auth
  login: (email: string, password: string) =>
    fetchJson<{ user: User }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }) =>
    fetchJson<{ user: User }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Admin
  adminStats: () =>
    fetchJson<{
      stats: { products: number; orders: number; enquiries: number; users: number; subscribers: number; blogPosts: number; revenue: number }
      recentOrders: Order[]
      recentEnquiries: Enquiry[]
      lowStock: { id: string; name: string; sku: string | null; stockQty: number }[]
      categories: { name: string; count: number }[]
    }>('/api/admin/dashboard'),
}
