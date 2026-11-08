import type { StorefrontTheme, ThemeSettingDef } from './theme'
import type { Product } from './types'
import type { PublicLook } from './looks'

export const LOOK_AUDIENCES = ['women', 'men'] as const
export const SALON_SORTS = [
  ['featured', 'Featured'], ['newest', 'Newest'], ['price-asc', 'Price, low to high'], ['price-desc', 'Price, high to low'],
] as const

export type SalonLook = PublicLook & { description: string | null; modelName: string | null; audience: string | null; collection: string | null; products: Product[] }

export const OMBRINE_SCHEMA: ThemeSettingDef[] = [
  { id: 'ombrine_enabled', type: 'checkbox', group: 'Ombrine salon', label: 'Use the Ombrine storefront', default: true },
  { id: 'ombrine_season', type: 'text', group: 'Ombrine salon', label: 'Collection season', default: 'Autumn–Winter 2026' },
  { id: 'ombrine_brand', type: 'text', group: 'Ombrine salon', label: 'Catalog brand slug', default: 'ombrine', help: 'Enter comma-separated brand slugs to show those products in the storefront and search.' },
  { id: 'ombrine_currency', type: 'select', group: 'Ombrine salon', label: 'Catalog currency', default: 'AED', options: ['AED', 'EUR', 'USD', 'GBP'].map((value) => ({ value, label: value })) },
  { id: 'ombrine_night', type: 'color', group: 'Ombrine salon', label: 'Dark canvas', default: '#100E0C', var: '--om-night' },
  { id: 'ombrine_ivory', type: 'color', group: 'Ombrine salon', label: 'Dark appearance text', default: '#EEE7DC', var: '--om-ivory' },
  { id: 'ombrine_mid_height', type: 'range', group: 'Ombrine depth', label: 'Main figure height', default: 340, min: 180, max: 500, step: 10, unit: 'px', var: '--om-mid-height' },
  { id: 'ombrine_front_height', type: 'range', group: 'Ombrine depth', label: 'Foreground height', default: 700, min: 360, max: 900, step: 10, unit: 'px', var: '--om-front-height' },
  { id: 'ombrine_front_drop', type: 'range', group: 'Ombrine depth', label: 'Foreground vertical drop', default: 140, min: 50, max: 220, step: 5, unit: 'px', var: '--om-front-drop' },
  { id: 'ombrine_back_height', type: 'range', group: 'Ombrine depth', label: 'Background height', default: 210, min: 100, max: 300, step: 10, unit: 'px', var: '--om-back-height' },
  { id: 'ombrine_far_height', type: 'range', group: 'Ombrine depth', label: 'Distant figure height', default: 120, min: 60, max: 180, step: 5, unit: 'px', var: '--om-far-height' },
  { id: 'ombrine_drift', type: 'checkbox', group: 'Ombrine salon', label: 'Drift when idle', default: true },
  { id: 'ombrine_drag', type: 'text', group: 'Ombrine salon', label: 'Gallery instruction', default: 'Drag to wander · Click a look to step closer' },
  { id: 'ombrine_scroll', type: 'text', group: 'Ombrine salon', label: 'Scroll instruction', default: 'Scroll to move through' },
  { id: 'ombrine_delivery', type: 'textarea', group: 'Ombrine salon', label: 'Delivery and returns note', default: 'Complimentary delivery and returns.' },
  { id: 'ombrine_bag_note', type: 'textarea', group: 'Ombrine salon', label: 'Bag note', default: 'Delivery is free and arrives in a cotton garment bag.' },
  { id: 'ombrine_size_guide', type: 'textarea', group: 'Ombrine salon', label: 'Size guide', default: 'Clothing uses letter or EU sizes as shown. Footwear uses EU sizing.' },
]

type OmbrineTheme = StorefrontTheme & { settings: StorefrontTheme['settings'] & { ombrine_enabled: true } }

export function isOmbrine(theme: StorefrontTheme | null | undefined): theme is OmbrineTheme {
  return theme?.settings.ombrine_enabled === true
}

export function salonBrand(theme: StorefrontTheme) {
  return String(theme.settings.ombrine_brand || 'ombrine').trim() || 'ombrine'
}

export function salonCurrency(theme: StorefrontTheme) {
  return String(theme.settings.ombrine_currency || 'AED')
}

export function salonPrice(value: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
}

export function productSizes(product: Pick<Product, 'attributes'>) {
  try {
    const value: unknown = JSON.parse(product.attributes ?? '{}')?.['ombrine-sizes']
    if (typeof value === 'string') return [...new Set(value.split(',').map((size) => size.trim()).filter((size) => size && size.length <= 32))].slice(0, 32)
  } catch { /* Older products can have malformed attributes. */ }
  return []
}

/** Salon rows: looks grouped by their collection name, in the order of each collection's first look. */
export function salonCollections<T extends { collection: string | null }>(looks: T[]) {
  const groups = new Map<string, T[]>()
  for (const look of looks) {
    const name = look.collection?.trim() || ''
    groups.set(name, [...(groups.get(name) ?? []), look])
  }
  return [...groups].map(([name, looks]) => ({ name: name || 'The salon', looks }))
}
