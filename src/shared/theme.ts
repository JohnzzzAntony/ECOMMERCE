// Theme model shared by the backend (install, storage) and the storefront (rendering).
//
// A theme is: a settings schema (what the admin can edit), the saved values, an ordered list of
// homepage sections, and CSS. Settings with `var` are emitted as CSS custom properties, so every
// colour/font/radius the admin changes flows into the storefront's Tailwind tokens.
// The package format (theme.json) is documented in public/docs/theme-format.md.
import type { NavParams, ViewKey } from '@/frontend/store/use-store'

/** link, page and html are used by section schemas (menu-style link, page picker, raw HTML). */
export type ThemeSettingType = 'color' | 'text' | 'textarea' | 'image' | 'select' | 'checkbox' | 'range' | 'link' | 'page' | 'html'
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

// ---------- homepage sections ----------
// Like Shopify section schemas: every section type declares its own settings (content first),
// and every section also gets SECTION_STYLE (colors, fonts, spacing, animation, visibility).

const t = (id: string, label: string, extra: Partial<ThemeSettingDef> = {}): ThemeSettingDef => ({ id, type: 'text', label, group: 'Content', ...extra })
const HEADINGS = [t('eyebrow', 'Small heading'), t('title', 'Heading')]
const ALIGN = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]
export const PRODUCT_SOURCES = [
  { value: 'new_arrivals', label: 'New arrivals' }, { value: 'best_sellers', label: 'Best sellers' },
  { value: 'featured', label: 'Featured' }, { value: 'on_sale', label: 'On sale' },
] as const
export const LINK_GRID_TILES = 8

export const SECTION_TYPES = {
  hero: {
    label: 'Hero slider',
    note: 'Slides are managed under Media. Text set here replaces the slide text; an image replaces the slider.',
    schema: [
      t('eyebrow', 'Small heading'), t('title', 'Heading'), t('text', 'Text', { type: 'textarea' }),
      t('button_label', 'Button label'), t('link', 'Button link', { type: 'link' }),
      t('image', 'Image', { type: 'image', help: 'Shows one fixed banner instead of the slides.' }),
      { id: 'show_quote_button', type: 'checkbox', group: 'Content', label: 'Show “Get a Quote” button', default: true },
      { id: 'height', type: 'range', group: 'Layout', label: 'Height', default: 560, min: 280, max: 900, step: 10, unit: 'px' },
      { id: 'content_align', type: 'select', group: 'Layout', label: 'Text position', default: 'left', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
      { id: 'overlay', type: 'range', group: 'Layout', label: 'Image darkening', default: 85, min: 0, max: 100, step: 5, unit: '%' },
      { id: 'autoplay', type: 'range', group: 'Layout', label: 'Change slide every', default: 5, min: 0, max: 15, step: 1, unit: 's', help: '0 turns autoplay off.' },
    ],
  },
  trust_bar: {
    label: 'Trust bar',
    schema: [1, 2, 3, 4].flatMap((n) => [
      t(`item_${n}_title`, `Item ${n} title`, { group: `Item ${n}` }), t(`item_${n}_text`, `Item ${n} text`, { group: `Item ${n}` }),
    ]),
  },
  categories: { label: 'Categories', schema: HEADINGS },
  featured: { label: 'Featured products', schema: HEADINGS },
  banner: { label: 'Promo banner', schema: [...HEADINGS, t('text', 'Text', { type: 'textarea' }), t('button_label', 'Button label'), t('link', 'Button link', { type: 'link' })] },
  scroll_stroke: {
    label: 'Scroll stroke',
    note: 'Tall section: a line draws itself behind the heading as visitors scroll, then a closing card slides in.',
    schema: [
      t('title', 'Heading', { type: 'textarea', default: 'The Stroke\nThat follows the\nScroll Progress' }),
      t('text', 'Text', { default: 'Scroll down to see the effect' }),
      t('card_title', 'Closing card heading', { default: 'jkr international' }),
      ...[1, 2, 3, 4].map((n) => t(`detail_${n}`, `Card detail ${n}`, { type: 'textarea', group: 'Closing card' })),
      { id: 'stroke_color', type: 'color', group: 'Style', label: 'Stroke color', default: '#C2F84F' },
      { id: 'card_color', type: 'color', group: 'Style', label: 'Card color', default: '#1F3A4B' },
      { id: 'card_text_color', type: 'color', group: 'Style', label: 'Card text color', default: '#FAFDEE' },
    ],
  },
  collections: { label: 'Collections', schema: HEADINGS },
  new_arrivals: { label: 'New arrivals', schema: HEADINGS },
  best_sellers: { label: 'Best sellers', schema: HEADINGS },
  on_sale: { label: 'On sale', schema: HEADINGS },
  features: { label: 'Why choose us', schema: HEADINGS },
  testimonials: { label: 'Testimonials', schema: HEADINGS },
  clients: { label: 'Client logos', schema: HEADINGS },
  blog: { label: 'Latest blog posts', schema: HEADINGS },
  newsletter: { label: 'Newsletter signup', schema: [t('title', 'Heading'), t('text', 'Text', { type: 'textarea' })] },
  instagram: { label: 'Instagram grid', schema: HEADINGS },
  gallery: { label: 'Gallery', schema: HEADINGS },
  image_banner: {
    label: 'Image banner',
    note: 'Full-width photo with a large heading and an outlined button.',
    schema: [
      t('image', 'Image', { type: 'image' }), t('mobile_image', 'Phone image', { type: 'image', help: 'Optional. Used on small screens.' }),
      t('eyebrow', 'Small heading'), t('title', 'Heading'), t('text', 'Text', { type: 'textarea' }),
      t('button_label', 'Button label', { default: 'Shop Now' }), t('link', 'Button link', { type: 'link', default: 'view:products' }),
      { id: 'height', type: 'range', group: 'Layout', label: 'Height', default: 640, min: 280, max: 1000, step: 10, unit: 'px' },
      { id: 'content_align', type: 'select', group: 'Layout', label: 'Text position', default: 'left', options: ALIGN },
      { id: 'content_vertical', type: 'select', group: 'Layout', label: 'Vertical position', default: 'bottom', options: [{ value: 'top', label: 'Top' }, { value: 'center', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }] },
      { id: 'overlay', type: 'range', group: 'Layout', label: 'Image darkening', default: 25, min: 0, max: 90, step: 5, unit: '%' },
      { id: 'full_width', type: 'checkbox', group: 'Layout', label: 'Edge to edge', default: true },
    ],
  },
  split_feature: {
    label: 'Image with text',
    schema: [
      t('image', 'Image', { type: 'image' }), t('eyebrow', 'Small heading'), t('title', 'Heading'),
      t('text', 'Text', { type: 'textarea' }), t('button_label', 'Link label', { default: 'Discover Now' }),
      t('link', 'Link', { type: 'link', default: 'view:products' }),
      { id: 'image_side', type: 'select', group: 'Layout', label: 'Image side', default: 'left', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
      { id: 'image_ratio', type: 'select', group: 'Layout', label: 'Image shape', default: '4/5', options: [{ value: '4/5', label: 'Portrait' }, { value: '1/1', label: 'Square' }, { value: '4/3', label: 'Landscape' }] },
    ],
  },
  link_grid: {
    label: 'Link grid',
    note: 'Leave every tile empty to list the store categories instead.',
    schema: [
      ...HEADINGS,
      { id: 'style', type: 'select', group: 'Layout', label: 'Style', default: 'text', options: [{ value: 'text', label: 'Text links' }, { value: 'tiles', label: 'Image tiles' }] },
      { id: 'columns', type: 'range', group: 'Layout', label: 'Columns (desktop)', default: 4, min: 2, max: 6, step: 1 },
      ...Array.from({ length: LINK_GRID_TILES }, (_, i) => i + 1).flatMap((n) => [
        t(`tile_${n}_label`, `Tile ${n} label`, { group: `Tile ${n}` }),
        t(`tile_${n}_link`, `Tile ${n} link`, { group: `Tile ${n}`, type: 'link' }),
        t(`tile_${n}_image`, `Tile ${n} image`, { group: `Tile ${n}`, type: 'image' }),
      ]),
    ],
  },
  product_slider: {
    label: 'Product slider',
    schema: [
      ...HEADINGS,
      t('link_label', 'Link label', { default: 'View all' }), t('link', 'Link', { type: 'link', default: 'view:products' }),
      { id: 'source', type: 'select', group: 'Content', label: 'Products', default: 'new_arrivals', options: [...PRODUCT_SOURCES] },
      { id: 'per_view', type: 'range', group: 'Layout', label: 'Cards visible (desktop)', default: 4, min: 2, max: 6, step: 1 },
    ],
  },
  rich_text: { label: 'Custom HTML', schema: [t('title', 'Heading'), t('html', 'HTML content', { type: 'html' })] },
  page: { label: 'Custom page', note: 'Embeds a page from Pages.', schema: [t('page', 'Page', { type: 'page' })] },
} satisfies Record<string, { label: string; note?: string; schema: ThemeSettingDef[] }>

export type SectionType = keyof typeof SECTION_TYPES

export const ANIMATIONS = [
  { value: 'none', label: 'None' }, { value: 'fade', label: 'Fade in' }, { value: 'fade-up', label: 'Fade up' },
  { value: 'fade-down', label: 'Fade down' }, { value: 'zoom', label: 'Zoom in' }, { value: 'slide-left', label: 'Slide from right' },
  { value: 'slide-right', label: 'Slide from left' }, { value: 'blur', label: 'Blur in' },
]

/** Settings every section has. Empty values mean “use the theme’s”. */
export const SECTION_STYLE: ThemeSettingDef[] = [
  { id: 'bg_color', type: 'color', group: 'Colors', label: 'Background', default: '' },
  { id: 'bg_image', type: 'image', group: 'Colors', label: 'Background image', default: '' },
  { id: 'bg_overlay', type: 'range', group: 'Colors', label: 'Background image darkening', default: 0, min: 0, max: 90, step: 5, unit: '%' },
  { id: 'text_color', type: 'color', group: 'Colors', label: 'Text', default: '' },
  { id: 'heading_color', type: 'color', group: 'Colors', label: 'Headings', default: '' },
  { id: 'accent_color', type: 'color', group: 'Colors', label: 'Accent (small headings, icons)', default: '' },
  { id: 'heading_font', type: 'select', group: 'Typography', label: 'Heading font', default: '' },
  { id: 'body_font', type: 'select', group: 'Typography', label: 'Text font', default: '' },
  { id: 'heading_size', type: 'range', group: 'Typography', label: 'Heading size (0 = default)', default: 0, min: 0, max: 72, step: 1, unit: 'px' },
  { id: 'text_align', type: 'select', group: 'Typography', label: 'Alignment', default: '', options: [{ value: '', label: 'Default' }, { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
  { id: 'padding_top', type: 'range', group: 'Spacing', label: 'Extra space above', default: 0, min: 0, max: 160, step: 4, unit: 'px' },
  { id: 'padding_bottom', type: 'range', group: 'Spacing', label: 'Extra space below', default: 0, min: 0, max: 160, step: 4, unit: 'px' },
  { id: 'animation', type: 'select', group: 'Animation', label: 'Entrance animation', default: 'none', options: ANIMATIONS },
  { id: 'animation_duration', type: 'range', group: 'Animation', label: 'Duration', default: 700, min: 200, max: 2000, step: 100, unit: 'ms' },
  { id: 'animation_delay', type: 'range', group: 'Animation', label: 'Delay', default: 0, min: 0, max: 1500, step: 50, unit: 'ms' },
  { id: 'hide_mobile', type: 'checkbox', group: 'Visibility', label: 'Hide on phones', default: false },
  { id: 'hide_desktop', type: 'checkbox', group: 'Visibility', label: 'Hide on larger screens', default: false },
  { id: 'css_class', type: 'text', group: 'Advanced', label: 'CSS class', default: '', help: 'Target this section from Custom CSS.' },
]

/** Full schema of a section type: its own settings, then the shared style settings. */
export function sectionSchema(type: SectionType): ThemeSettingDef[] {
  const fonts = [{ value: '', label: 'Theme default' }, ...FONT_OPTIONS]
  return [...SECTION_TYPES[type].schema, ...SECTION_STYLE.map((d) => (d.id.endsWith('_font') ? { ...d, options: fonts } : d))]
}

export interface ThemeSection {
  id: string
  type: SectionType
  enabled: boolean
  settings: ThemeSettings
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

/** The editable part of a theme: saved as a draft, copied to the live columns on publish. */
export interface ThemeDoc {
  settings: ThemeSettings
  sections: ThemeSection[]
  css: string
}

/** A = native manifest, B = framework source adapter, C = rendered DOM, D = unsupported/preview only. */
export type CompatLevel = 'A' | 'B' | 'C' | 'D'

export interface ThemeReport {
  adapter: string
  adapterVersion: string
  label: string
  level: CompatLevel
  detected: string
  confidence: number
  counts: { pages: number; sections: number; settings: number; menus: number }
  capabilities: string[]
  unsupported: string[]
  warnings: string[]
  recommendations: string[]
}

// ---------- default theme ----------

const FONT_OPTIONS = [
  { value: 'var(--font-dmsans), system-ui, sans-serif', label: 'DM Sans' },
  { value: 'var(--font-newsreader), Georgia, serif', label: 'Newsreader (serif)' },
  { value: 'var(--font-inter), system-ui, sans-serif', label: 'Inter' },
  { value: 'var(--font-jakarta), system-ui, sans-serif', label: 'Plus Jakarta Sans' },
  { value: 'var(--font-cairo), system-ui, sans-serif', label: 'Cairo' },
  { value: 'system-ui, -apple-system, "Segoe UI", sans-serif', label: 'System UI' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif (Georgia)' },
]

/** Settings every theme gets; a package's own schema is appended (same id overrides). */
export const CORE_SETTINGS: ThemeSettingDef[] = [
  { id: 'color_primary', type: 'color', group: 'Colors', label: 'Primary', default: '#383838', var: ['--brand-teal', '--primary', '--ring', '--sidebar-primary', '--chart-1'] },
  { id: 'color_primary_dark', type: 'color', group: 'Colors', label: 'Primary (dark)', default: '#1F1F1F', var: ['--brand-teal-dark', '--secondary-foreground', '--accent-foreground'] },
  { id: 'color_accent', type: 'color', group: 'Colors', label: 'Accent', default: '#6B6358', var: ['--brand-cyan', '--chart-2'] },
  { id: 'color_highlight', type: 'color', group: 'Colors', label: 'Highlight (sale)', default: '#E6352A', var: ['--brand-gold', '--chart-3'] },
  { id: 'color_text', type: 'color', group: 'Colors', label: 'Text', default: '#383838', var: ['--brand-ink', '--foreground', '--card-foreground', '--popover-foreground'] },
  { id: 'color_background', type: 'color', group: 'Colors', label: 'Background', default: '#FFFEFA', var: ['--background', '--card', '--popover'] },
  { id: 'color_surface', type: 'color', group: 'Colors', label: 'Section background', default: '#F3F1EA', var: ['--brand-bg', '--secondary'] },
  { id: 'color_tint', type: 'color', group: 'Colors', label: 'Tint', default: '#FFEBEA', var: ['--accent'] },
  { id: 'color_border', type: 'color', group: 'Colors', label: 'Borders', default: '#E4E1D8', var: ['--border', '--input'] },
  { id: 'font_body', type: 'select', group: 'Typography', label: 'Body font', default: FONT_OPTIONS[0].value, options: FONT_OPTIONS, var: '--theme-font-body' },
  { id: 'font_heading', type: 'select', group: 'Typography', label: 'Heading font', default: FONT_OPTIONS[1].value, options: FONT_OPTIONS, var: '--theme-font-heading' },
  { id: 'heading_weight', type: 'range', group: 'Typography', label: 'Heading weight', default: 500, min: 300, max: 800, step: 100, var: '--theme-heading-weight' },
  { id: 'radius', type: 'range', group: 'Typography', label: 'Corner radius', default: 0, min: 0, max: 24, step: 1, unit: 'px', var: '--radius' },
  { id: 'logo_url', type: 'image', group: 'Branding', label: 'Logo image', default: '', help: 'Replaces the text logo when set.' },
  { id: 'logo_url_light', type: 'image', group: 'Branding', label: 'Logo on photos', default: '', help: 'Light logo for the transparent header. Falls back to the logo image.' },
  { id: 'logo_badge', type: 'text', group: 'Branding', label: 'Logo initials', default: '' },
  { id: 'logo_text', type: 'text', group: 'Branding', label: 'Store name', default: 'NexEcoms' },
  { id: 'logo_tagline', type: 'text', group: 'Branding', label: 'Logo tagline', default: 'Medical Equipment' },
  { id: 'header_style', type: 'select', group: 'Header', label: 'Header style', default: 'editorial', options: [{ value: 'editorial', label: 'Editorial (one row)' }, { value: 'classic', label: 'Classic (search bar + menu row)' }] },
  { id: 'header_transparent', type: 'checkbox', group: 'Header', label: 'Transparent header over the homepage banner', default: true, help: 'Editorial style only. Used when the homepage starts with a hero or image banner.' },
  { id: 'show_announcement', type: 'checkbox', group: 'Header', label: 'Show announcement bar', default: true },
  { id: 'announcement_text', type: 'text', group: 'Header', label: 'Announcement', default: 'Free UAE Delivery on Purchases Above AED 2,000 | Delivery within 2-5 days across the UAE', help: 'Separate messages with | to rotate them.' },
  { id: 'footer_style', type: 'select', group: 'Footer', label: 'Footer style', default: 'editorial', options: [{ value: 'editorial', label: 'Editorial (light)' }, { value: 'classic', label: 'Classic (dark)' }] },
  { id: 'show_footer_newsletter', type: 'checkbox', group: 'Footer', label: 'Show newsletter band', default: true },
  { id: 'footer_newsletter_title', type: 'text', group: 'Footer', label: 'Newsletter heading', default: 'Stay in the Loop' },
  { id: 'footer_newsletter_text', type: 'text', group: 'Footer', label: 'Newsletter text', default: 'Subscribe for new arrivals, offers and updates.' },
  { id: 'footer_about', type: 'textarea', group: 'Footer', label: 'About text', default: 'Delivering world-class medical equipment across the UAE' },
  { id: 'show_payment_badges', type: 'checkbox', group: 'Footer', label: 'Show payment badges', default: true },
  { id: 'copyright_text', type: 'text', group: 'Footer', label: 'Copyright name', default: 'NexEcoms' },
  { id: 'hide_chrome_on_home', type: 'checkbox', group: 'Layout', label: 'Hide store header & footer on the homepage', default: false, help: 'For imported HTML templates that bring their own header and footer.' },
]

let seq = 0
const sid = (prefix: string) => `${prefix}-${(++seq).toString(36)}`

/** Editorial homepage (see DESIGN.md): banner, product rows, image stories, link grid, social strip. */
export const DEFAULT_SECTIONS: ThemeSection[] = ([
  ['hero', { content_align: 'left', overlay: 35, height: 720, show_quote_button: false }],
  ['product_slider', { title: 'New Arrivals', source: 'new_arrivals', link_label: 'Discover Now' }],
  ['split_feature', { title: 'The Finishing Touches', text: 'Considered details that make every space work better.', button_label: 'Shop Now' }],
  ['categories', { eyebrow: 'Browse', title: 'Shop by Category' }],
  ['product_slider', { title: 'Bestsellers', source: 'best_sellers', link_label: 'Shop Bestsellers' }],
  ['image_banner', { title: 'Explore the Collection', button_label: 'Explore Now' }],
  ['split_feature', { title: 'Made to Last', text: 'Equipment chosen for comfort, safety and everyday use.', image_side: 'right', button_label: 'Read More', link: 'view:about' }],
  ['product_slider', { title: 'On Sale', source: 'on_sale', link_label: 'Shop Offers', link: 'view:offers' }],
  ['link_grid', { title: 'Find What You Need' }],
  ['instagram', { eyebrow: 'Follow us', title: '#livingwithus' }],
] as [SectionType, ThemeSettings][]).map(([type, settings], i) => ({ id: `s-${type}-${i}`, type, enabled: true, settings }))

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
