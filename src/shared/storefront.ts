// Data passed from the storefront loader to section components. Commerce data always comes from the catalog.
import type { DesignTokens } from './design-tokens'
import type { SectionInstance } from './sections/registry'
import type { Seo, StorePageType } from './store-pages'
import type { Product } from './types'

export type ProductCard = {
  id: string; slug: string; name: string; regularPrice: number; salePrice: number | null; onSale: boolean; inStock: boolean
  badge: string | null; image: { url: string; alt: string } | null
  /** Full product for add-to-cart (the cart store keeps product snapshots). */
  product: Product
}
export type CollectionCard = { slug: string; name: string; description: string | null; image: string | null; count: number }

export type RouteContext =
  | { kind: 'page' }
  | { kind: 'product'; product: Product; breadcrumbs: { name: string; href: string }[] }
  | { kind: 'collection'; collection: CollectionCard; query?: string }
  | { kind: 'cart' }

/** Per section id: what data-bound sections need. */
export type SectionData = Record<string, { products?: ProductCard[]; collections?: CollectionCard[] }>

export type FontFace = { family: string; weight: number; style: 'normal' | 'italic'; url: string; format: string; unicodeRange?: string }

export type RenderedPage = {
  store: { id: string; name: string }
  page: { id: string; type: StorePageType; slug: string; title: string; seo: Seo }
  sections: SectionInstance[]
  globals: { header: SectionInstance[]; footer: SectionInstance[]; announcement: SectionInstance[] }
  tokens: DesignTokens
  fonts: FontFace[]
  data: SectionData
  route: RouteContext
  currency: string
}

export const formatPrice = (value: number, currency = 'AED') =>
  `${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} ${currency}`
