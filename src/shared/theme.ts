// Theme model shared by the backend (install, storage) and the storefront (rendering).
//
// A theme is: a settings schema (what the admin can edit), the saved values, an ordered list of
// homepage sections, and CSS. Settings with `var` are emitted as CSS custom properties, so every
// colour/font/radius the admin changes flows into the storefront's Tailwind tokens.
// The package format (theme.json) is documented in public/docs/theme-format.md.
import type { NavParams, ViewKey } from '@/frontend/store/use-store'

export type ThemeSettingType = 'color' | 'text' | 'textarea' | 'image' | 'select' | 'checkbox' | 'range'
export type ThemeValue = string | number | boolean

export interface ThemeSettingDef {
  id: string
  type: ThemeSettingType
  label: string
  group?: string
  default?: ThemeValue
  /** CSS custom properties that receive this value (e.g. '--brand-teal'). */
  var?: string | string[]
  /** Appended to numeric values when written to `var` (e.g. 'px'). */
  unit?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  help?: string
}

export type ThemeSettings = Record<string, ThemeValue>

export const SECTION_TYPES = {
  hero: { label: 'Hero slider', note: 'Slides are managed under Media.', fields: [] },
  trust_bar: { label: 'Trust bar', fields: [] },
  categories: { label: 'Categories', fields: ['eyebrow', 'title'] },
  featured: { label: 'Featured products', fields: ['eyebrow', 'title'] },
  banner: { label: 'Promo banner', fields: ['eyebrow', 'title', 'text', 'button_label', 'link'] },
  collections: { label: 'Collections', fields: ['eyebrow', 'title'] },
  new_arrivals: { label: 'New arrivals', fields: ['eyebrow', 'title'] },
  best_sellers: { label: 'Best sellers', fields: ['eyebrow', 'title'] },
  on_sale: { label: 'On sale', fields: ['eyebrow', 'title'] },
  features: { label: 'Why choose us', fields: ['eyebrow', 'title'] },
  testimonials: { label: 'Testimonials', fields: ['eyebrow', 'title'] },
  clients: { label: 'Client logos', fields: ['eyebrow', 'title'] },
  blog: { label: 'Latest blog posts', fields: ['eyebrow', 'title'] },
  newsletter: { label: 'Newsletter signup', fields: ['title', 'text'] },
  instagram: { label: 'Instagram grid', fields: ['eyebrow', 'title'] },
  gallery: { label: 'Gallery', fields: ['eyebrow', 'title'] },
  rich_text: { label: 'Custom HTML', fields: ['title', 'html'] },
  page: { label: 'Custom page', note: 'Embeds a page from Pages.', fields: ['page'] },
} as const satisfies Record<string, { label: string; note?: string; fields: readonly SectionField[] }>

export type SectionField = 'eyebrow' | 'title' | 'text' | 'button_label' | 'link' | 'html' | 'page'
export type SectionType = keyof typeof SECTION_TYPES

export interface ThemeSection {
  id: string
  type: SectionType
  enabled: boolean
  settings: Partial<Record<SectionField, string>>
}

export interface MenuItem {
  id: string
  label: string
  /** See resolveLink(). */
  link: string
  children?: MenuItem[]
}

export const MENU_HANDLES = { main: 'Header menu', footer: 'Footer menu' } as const
export type MenuHandle = keyof typeof MENU_HANDLES

/** What the storefront receives: values already merged with schema defaults. */
export interface StorefrontTheme {
  id: string
  name: string
  kind: 'native' | 'html'
  schema: ThemeSettingDef[]
  settings: ThemeSettings
  sections: ThemeSection[]
  css: string
  menus: Record<MenuHandle, MenuItem[]>
}

// ---------- default theme ----------

const FONT_OPTIONS = [
  { value: 'var(--font-inter), system-ui, sans-serif', label: 'Inter' },
  { value: 'var(--font-jakarta), system-ui, sans-serif', label: 'Plus Jakarta Sans' },
  { value: 'var(--font-cairo), system-ui, sans-serif', label: 'Cairo' },
  { value: 'system-ui, -apple-system, "Segoe UI", sans-serif', label: 'System UI' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif (Georgia)' },
]

/** Settings every theme gets; a package's own schema is appended (same id overrides). */
export const CORE_SETTINGS: ThemeSettingDef[] = [
  { id: 'color_primary', type: 'color', group: 'Colors', label: 'Primary', default: '#0D6B8C', var: ['--brand-teal', '--primary', '--ring', '--sidebar-primary', '--chart-1'] },
  { id: 'color_primary_dark', type: 'color', group: 'Colors', label: 'Primary (dark)', default: '#09505F', var: ['--brand-teal-dark', '--secondary-foreground', '--accent-foreground'] },
  { id: 'color_accent', type: 'color', group: 'Colors', label: 'Accent', default: '#00B4D8', var: ['--brand-cyan', '--chart-2'] },
  { id: 'color_highlight', type: 'color', group: 'Colors', label: 'Highlight', default: '#E8A100', var: ['--brand-gold', '--chart-3'] },
  { id: 'color_text', type: 'color', group: 'Colors', label: 'Text', default: '#1A1A2E', var: ['--brand-ink', '--foreground', '--card-foreground', '--popover-foreground'] },
  { id: 'color_background', type: 'color', group: 'Colors', label: 'Background', default: '#FFFFFF', var: ['--background', '--card', '--popover'] },
  { id: 'color_surface', type: 'color', group: 'Colors', label: 'Section background', default: '#F7F9FC', var: ['--brand-bg', '--secondary'] },
  { id: 'color_tint', type: 'color', group: 'Colors', label: 'Tint', default: '#E8F4F8', var: ['--accent'] },
  { id: 'color_border', type: 'color', group: 'Colors', label: 'Borders', default: '#E2E8F0', var: ['--border', '--input'] },
  { id: 'font_body', type: 'select', group: 'Typography', label: 'Body font', default: FONT_OPTIONS[0].value, options: FONT_OPTIONS, var: '--theme-font-body' },
  { id: 'font_heading', type: 'select', group: 'Typography', label: 'Heading font', default: FONT_OPTIONS[1].value, options: FONT_OPTIONS, var: '--theme-font-heading' },
  { id: 'radius', type: 'range', group: 'Typography', label: 'Corner radius', default: 10, min: 0, max: 24, step: 1, unit: 'px', var: '--radius' },
  { id: 'logo_url', type: 'image', group: 'Branding', label: 'Logo image', default: '', help: 'Replaces the text logo when set.' },
  { id: 'logo_badge', type: 'text', group: 'Branding', label: 'Logo initials', default: 'NE' },
  { id: 'logo_text', type: 'text', group: 'Branding', label: 'Store name', default: 'NexEcoms' },
  { id: 'logo_tagline', type: 'text', group: 'Branding', label: 'Logo tagline', default: 'Medical Equipment' },
  { id: 'show_announcement', type: 'checkbox', group: 'Header', label: 'Show announcement bar', default: true },
  { id: 'announcement_text', type: 'text', group: 'Header', label: 'Announcement', default: 'Free UAE Delivery on Purchases Above AED 2,000' },
  { id: 'show_footer_newsletter', type: 'checkbox', group: 'Footer', label: 'Show newsletter band', default: true },
  { id: 'footer_about', type: 'textarea', group: 'Footer', label: 'About text', default: 'Delivering world-class medical equipment across the UAE' },
  { id: 'show_payment_badges', type: 'checkbox', group: 'Footer', label: 'Show payment badges', default: true },
  { id: 'copyright_text', type: 'text', group: 'Footer', label: 'Copyright name', default: 'NexEcoms' },
  { id: 'hide_chrome_on_home', type: 'checkbox', group: 'Layout', label: 'Hide store header & footer on the homepage', default: false, help: 'For imported HTML templates that bring their own header and footer.' },
]

let seq = 0
const sid = (prefix: string) => `${prefix}-${(++seq).toString(36)}`

export const DEFAULT_SECTIONS: ThemeSection[] = (
  ['hero', 'trust_bar', 'categories', 'featured', 'banner', 'collections', 'new_arrivals', 'best_sellers',
    'on_sale', 'features', 'testimonials', 'clients', 'blog', 'newsletter', 'instagram', 'gallery'] as SectionType[]
).map((type) => ({ id: `s-${type}`, type, enabled: true, settings: {} }))

const item = (label: string, link: string, children?: MenuItem[]): MenuItem => ({ id: sid('m'), label, link, ...(children ? { children } : {}) })

export const DEFAULT_MENUS: Record<MenuHandle, MenuItem[]> = {
  main: [
    item('Home', 'view:home'),
    item('Categories', 'mega:categories'),
    item('Brands', 'mega:brands'),
    item('Collections', 'mega:collections'),
    item('Offers', 'view:offers'),
    item('Blog', 'view:blog'),
    item('About', 'view:about'),
    item('Contact', 'view:contact'),
    item('Store Locations', 'view:store-locations'),
    item('FAQ', 'view:faq'),
  ],
  footer: [
    item('Shop', '', [
      item('All Products', 'view:products'),
      item('Offers', 'view:offers'),
      item('Wishlist', 'view:wishlist'),
      item('Compare', 'view:compare'),
      item('Track Order', 'view:track-order'),
    ]),
    item('Information', '', [
      item('About Us', 'view:about'),
      item('Contact Us', 'view:contact'),
      item('Store Locations', 'view:store-locations'),
      item('Shipping Info', 'view:shipping-info'),
      item('FAQ', 'view:faq'),
      item('Terms & Conditions', 'view:terms'),
      item('Privacy Policy', 'view:privacy'),
    ]),
  ],
}

export const DEFAULT_THEME = {
  slug: 'nexecoms-default',
  name: 'NexEcoms Default',
  version: '1.0.0',
  author: 'NexEcoms',
  description: 'The built-in storefront theme.',
}

// ---------- settings → CSS ----------

/** Merge the core schema with a theme's own schema; later ids replace earlier ones. */
export function mergeSchema(own: ThemeSettingDef[]): ThemeSettingDef[] {
  const byId = new Map<string, ThemeSettingDef>()
  for (const def of [...CORE_SETTINGS, ...own]) byId.set(def.id, def)
  return [...byId.values()]
}

export function resolveSettings(schema: ThemeSettingDef[], saved: ThemeSettings): ThemeSettings {
  const out: ThemeSettings = {}
  for (const def of schema) out[def.id] = saved[def.id] ?? def.default ?? (def.type === 'checkbox' ? false : '')
  for (const [k, v] of Object.entries(saved)) if (!(k in out)) out[k] = v
  return out
}

/** Characters that could end a declaration or escape the <style> element are dropped. */
const cssValue = (v: ThemeValue) => String(v).replace(/[;{}<>\\]/g, '').trim()

export function themeVariablesCss(schema: ThemeSettingDef[], settings: ThemeSettings): string {
  const decls: string[] = []
  for (const def of schema) {
    if (!def.var) continue
    const raw = settings[def.id]
    if (raw === undefined || raw === '') continue
    const value = typeof raw === 'number' && def.unit ? `${raw}${def.unit}` : cssValue(raw)
    if (!value) continue
    for (const name of Array.isArray(def.var) ? def.var : [def.var]) {
      if (/^--[a-zA-Z0-9-]+$/.test(name)) decls.push(`${name}:${value}`)
    }
  }
  return decls.length ? `:root{${decls.join(';')}}` : ''
}

/** Make arbitrary CSS safe to place inside a <style> element. */
export const styleText = (css: string) => css.replace(/<\/?style/gi, '\\3c style')

// ---------- links ----------

export type ResolvedLink =
  | { kind: 'view'; view: ViewKey; params?: NavParams }
  | { kind: 'href'; href: string; external: boolean }
  | { kind: 'mega'; source: 'categories' | 'brands' | 'collections' }
  | { kind: 'none' }

export const LINK_VIEWS: { view: ViewKey; label: string }[] = [
  { view: 'home', label: 'Home' }, { view: 'products', label: 'All products' }, { view: 'offers', label: 'Offers' },
  { view: 'blog', label: 'Blog' }, { view: 'about', label: 'About' }, { view: 'contact', label: 'Contact' },
  { view: 'store-locations', label: 'Store locations' }, { view: 'faq', label: 'FAQ' },
  { view: 'shipping-info', label: 'Shipping info' }, { view: 'terms', label: 'Terms' }, { view: 'privacy', label: 'Privacy' },
  { view: 'track-order', label: 'Track order' }, { view: 'wishlist', label: 'Wishlist' }, { view: 'compare', label: 'Compare' },
  { view: 'cart', label: 'Cart' }, { view: 'profile', label: 'Account' },
]

/**
 * Menu/section link syntax:
 *   view:<view>  page:<slug>  category:<slug>  brand:<slug>  collection:<slug>  product:<slug>  blog:<slug>
 *   mega:categories|brands|collections (header dropdown fed by the live catalog)
 *   https://…, mailto:…, tel:…, /path
 */
export function resolveLink(link: string): ResolvedLink {
  const value = link.trim()
  if (!value) return { kind: 'none' }
  if (/^(https?:|mailto:|tel:)/i.test(value)) return { kind: 'href', href: value, external: /^https?:/i.test(value) }
  if (value.startsWith('/')) return { kind: 'href', href: value, external: false }
  const [type, ...rest] = value.split(':')
  const arg = rest.join(':')
  switch (type) {
    case 'view': return LINK_VIEWS.some((v) => v.view === arg) ? { kind: 'view', view: arg as ViewKey } : { kind: 'none' }
    case 'page': return { kind: 'view', view: 'page', params: { slug: arg } }
    case 'category': return { kind: 'view', view: 'products-category', params: { categorySlug: arg } }
    case 'brand': return { kind: 'view', view: 'products-brand', params: { brandSlug: arg } }
    case 'collection': return { kind: 'view', view: 'products-collection', params: { collectionSlug: arg } }
    case 'product': return { kind: 'view', view: 'product-detail', params: { slug: arg } }
    case 'blog': return { kind: 'view', view: 'blog-detail', params: { slug: arg } }
    case 'mega': return arg === 'categories' || arg === 'brands' || arg === 'collections' ? { kind: 'mega', source: arg } : { kind: 'none' }
    default: return { kind: 'none' }
  }
}
