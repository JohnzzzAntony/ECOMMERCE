// Client-side API helpers for JKR International
import type {
  Product, Category, Brand, Collection, BlogPost,
  Testimonial, ClientLogo, HeroSlide, GalleryItem, Order, Enquiry, User,
} from '@/types'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
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
  product: (slug: string) =>
    fetchJson<{ product: Product; related: Product[] }>(`/api/products/${slug}`),

  // Taxonomy
  categories: () => fetchJson<Category[]>('/api/categories'),
  brands: () => fetchJson<Brand[]>('/api/brands'),
  collections: () => fetchJson<Collection[]>('/api/collections'),

  // Content
  blog: (params?: { category?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.limit) q.set('limit', String(params.limit))
    return fetchJson<BlogPost[]>(`/api/blog${q.toString() ? `?${q}` : ''}`)
  },
  blogPost: (slug: string) =>
    fetchJson<{ post: BlogPost; related: BlogPost[] }>(`/api/blog/${slug}`),
  testimonials: () => fetchJson<Testimonial[]>('/api/testimonials'),
  clients: () => fetchJson<ClientLogo[]>('/api/clients'),
  slider: () => fetchJson<HeroSlide[]>('/api/slider'),
  gallery: () => fetchJson<GalleryItem[]>('/api/gallery'),
  settings: () => fetchJson<Record<string, string>>('/api/settings'),

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
