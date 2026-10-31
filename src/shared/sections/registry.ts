// Section template registry: settings/blocks schemas and metadata for every section type. React components live
// in src/frontend/components/sections (one file per type, loaded on demand). Shared by the mapping engine,
// admin editor and storefront renderer.
import { z } from 'zod'
import { f, layerStyleSchema, layerVideoSchema, rt, styleFields } from './fields'

export const SECTION_TYPES = [
  'announcement-bar', 'header', 'footer', 'hero', 'hero-slideshow', 'image-with-text', 'rich-text', 'feature-grid',
  'collection-list', 'product-grid', 'product-detail', 'cart', 'testimonials', 'logo-cloud', 'faq', 'newsletter',
  'cta-banner', 'video', 'gallery', 'spacer', 'freeform', 'custom-code',
] as const
export type SectionType = (typeof SECTION_TYPES)[number]

export type PageKind = 'HOME' | 'PAGE' | 'PRODUCT_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'CART' | 'HEADER' | 'FOOTER' | 'ANNOUNCEMENT'
const CONTENT: PageKind[] = ['HOME', 'PAGE', 'PRODUCT_TEMPLATE', 'COLLECTION_TEMPLATE', 'CART']

export type BlockDef = { name: string; settings: z.ZodObject<z.ZodRawShape> }
export type SectionDef = {
  type: SectionType
  name: string
  icon: string // lucide icon name
  description: string
  allowedPageTypes: PageKind[]
  settings: z.ZodObject<z.ZodRawShape>
  blocks?: { types: Record<string, BlockDef>; max: number }
  /** Name keywords the mapping engine treats as a match, and the setting that receives the main heading. */
  hints: { keywords: string[]; titleField?: string }
  dataBound?: boolean
  interactive?: boolean // needs client JS on the storefront
}

const ctaFields = { ctaLabel: f.text('Button label'), ctaLink: f.link('Button link') }

const def = (d: SectionDef) => d

export const SECTIONS: Record<SectionType, SectionDef> = {
  'announcement-bar': def({
    type: 'announcement-bar', name: 'Announcement bar', icon: 'Megaphone', description: 'Thin bar with a short message, shown on every page.',
    allowedPageTypes: ['ANNOUNCEMENT', ...CONTENT],
    settings: z.object({ text: f.text('Message', 'Free delivery on orders over 500 AED'), link: f.link('Link'), ...styleFields, paddingTop: f.range('Space above', 0, 48, 8, 2, 'px'), paddingBottom: f.range('Space below', 0, 48, 8, 2, 'px'), align: f.select('Alignment', ['left', 'center', 'right'] as const, 'center') }),
    hints: { keywords: ['announcement', 'promo bar', 'topbar', 'top bar', 'banner bar'], titleField: 'text' },
  }),
  header: def({
    type: 'header', name: 'Header', icon: 'PanelTop', description: 'Logo, navigation, search and cart. Shown on every page.',
    allowedPageTypes: ['HEADER'],
    settings: z.object({ logo: f.image('Logo'), logoText: f.text('Store name'), menu: f.links('Menu'), showSearch: f.boolean('Show search', true), showCart: f.boolean('Show cart', true), sticky: f.boolean('Stick to top', true), ...styleFields, paddingTop: f.range('Space above', 0, 64, 16, 2, 'px'), paddingBottom: f.range('Space below', 0, 64, 16, 2, 'px') }),
    hints: { keywords: ['header', 'navbar', 'navigation', 'nav'], titleField: 'logoText' },
    interactive: true,
  }),
  footer: def({
    type: 'footer', name: 'Footer', icon: 'PanelBottom', description: 'Link columns, contact details and copyright. Shown on every page.',
    allowedPageTypes: ['FOOTER'],
    settings: z.object({ logo: f.image('Logo'), about: f.richtext('About text'), copyright: f.text('Copyright', '© NexEcoms'), ...styleFields }),
    blocks: { max: 6, types: { column: { name: 'Link column', settings: z.object({ title: f.text('Title', 'Shop'), links: f.links('Links') }) } } },
    hints: { keywords: ['footer'], titleField: 'copyright' },
  }),
  hero: def({
    type: 'hero', name: 'Hero', icon: 'Image', description: 'Large heading with image and call to action.',
    allowedPageTypes: CONTENT,
    settings: z.object({
      eyebrow: f.text('Eyebrow'), title: f.text('Heading', 'Welcome'), headingLevel: f.heading('Heading level', 'h1'), subtitle: f.richtext('Text'),
      image: f.image('Image'), video: f.video('Background video (plays muted, on loop)'), layout: f.select('Layout', ['background', 'split-left', 'split-right'] as const, 'background', { background: 'Image behind text', 'split-left': 'Image left', 'split-right': 'Image right' }),
      minHeight: f.range('Minimum height', 200, 1000, 520, 20, 'px'), overlay: f.range('Image overlay', 0, 90, 30, 5, '%'),
      ...ctaFields, secondaryLabel: f.text('Second button label'), secondaryLink: f.link('Second button link'), ...styleFields,
    }),
    hints: { keywords: ['hero', 'banner', 'masthead', 'jumbotron', 'intro'], titleField: 'title' },
  }),
  'hero-slideshow': def({
    type: 'hero-slideshow', name: 'Slideshow', icon: 'GalleryHorizontal', description: 'Rotating full-width slides.',
    allowedPageTypes: CONTENT,
    settings: z.object({ autoplay: f.boolean('Autoplay', true), interval: f.range('Seconds per slide', 3, 15, 6, 1, 's'), minHeight: f.range('Height', 200, 1000, 520, 20, 'px'), headingLevel: f.heading('Heading level', 'h2'), ...styleFields }),
    blocks: { max: 8, types: { slide: { name: 'Slide', settings: z.object({ title: f.text('Heading'), subtitle: f.textarea('Text'), image: f.image('Image'), ...ctaFields }) } } },
    hints: { keywords: ['slideshow', 'slider', 'carousel', 'slides'] },
    interactive: true,
  }),
  'image-with-text': def({
    type: 'image-with-text', name: 'Image with text', icon: 'LayoutPanelLeft', description: 'Image beside a heading, text and button.',
    allowedPageTypes: CONTENT,
    settings: z.object({ image: f.image('Image'), imagePosition: f.select('Image position', ['left', 'right'] as const, 'left'), eyebrow: f.text('Eyebrow'), title: f.text('Heading', 'Image with text'), headingLevel: f.heading(), body: f.richtext('Text'), ...ctaFields, ...styleFields }),
    hints: { keywords: ['image with text', 'image-text', 'split', 'feature', 'about', 'story', 'media'], titleField: 'title' },
  }),
  'rich-text': def({
    type: 'rich-text', name: 'Rich text', icon: 'Type', description: 'Heading and formatted text.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading'), headingLevel: f.heading(), body: f.richtext('Text', rt('Tell your story.')), width: f.select('Width', ['narrow', 'normal', 'wide'] as const, 'normal'), ...ctaFields, ...styleFields }),
    hints: { keywords: ['text', 'rich text', 'content', 'copy', 'article', 'paragraph'], titleField: 'title' },
  }),
  'feature-grid': def({
    type: 'feature-grid', name: 'Feature grid', icon: 'LayoutGrid', description: 'Grid of icons or images with short text.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading'), headingLevel: f.heading(), intro: f.richtext('Intro'), columns: f.range('Columns', 1, 6, 3), ...styleFields }),
    blocks: { max: 24, types: { feature: { name: 'Feature', settings: z.object({ icon: f.image('Icon or image'), title: f.text('Title', 'Feature'), body: f.textarea('Text'), link: f.link('Link') }) } } },
    hints: { keywords: ['features', 'feature grid', 'benefits', 'usp', 'services', 'why'], titleField: 'title' },
  }),
  'collection-list': def({
    type: 'collection-list', name: 'Collection list', icon: 'Shapes', description: 'Cards linking to catalogue collections.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading', 'Shop by collection'), headingLevel: f.heading(), columns: f.range('Columns', 1, 6, 3), ...styleFields }),
    blocks: { max: 24, types: { collection: { name: 'Collection', settings: z.object({ collection: f.collection('Collection'), image: f.image('Image (optional)'), label: f.text('Label (optional)') }) } } },
    hints: { keywords: ['collections', 'categories', 'shop by', 'departments'], titleField: 'title' },
    dataBound: true,
  }),
  'product-grid': def({
    type: 'product-grid', name: 'Product grid', icon: 'ShoppingBag', description: 'Products from a collection, a hand-picked list or best sellers.',
    allowedPageTypes: CONTENT,
    settings: z.object({
      title: f.text('Heading', 'Featured products'), headingLevel: f.heading(),
      source: f.select('Products', ['collection', 'manual', 'best-sellers', 'current-collection'] as const, 'best-sellers', { collection: 'From a collection', manual: 'Pick products', 'best-sellers': 'Best sellers', 'current-collection': 'Collection being viewed (collection template)' }),
      collection: f.collection('Collection'), products: f.products('Products'), limit: f.range('Number of products', 1, 48, 8),
      columns: f.range('Columns', 1, 6, 4), showPrice: f.boolean('Show prices', true), showAddToCart: f.boolean('Show add to cart', true), ...styleFields,
    }),
    hints: { keywords: ['products', 'product grid', 'best sellers', 'bestsellers', 'shop', 'catalog', 'new arrivals', 'featured'], titleField: 'title' },
    dataBound: true, interactive: true,
  }),
  'product-detail': def({
    type: 'product-detail', name: 'Product details', icon: 'Package', description: 'Gallery, price, add to cart and description of the product being viewed.',
    allowedPageTypes: ['PRODUCT_TEMPLATE'],
    settings: z.object({ galleryPosition: f.select('Gallery', ['left', 'right'] as const, 'left'), showBreadcrumbs: f.boolean('Breadcrumbs', true), showSpecs: f.boolean('Specifications', true), showReviews: f.boolean('Reviews summary', true), buttonLabel: f.text('Button label', 'Add to cart'), ...styleFields }),
    hints: { keywords: ['product detail', 'pdp', 'product info', 'product page'] },
    dataBound: true, interactive: true,
  }),
  cart: def({
    type: 'cart', name: 'Cart', icon: 'ShoppingCart', description: 'The shopper’s cart with totals and checkout.',
    allowedPageTypes: ['CART'],
    settings: z.object({ title: f.text('Heading', 'Your cart'), headingLevel: f.heading('Heading level', 'h1'), emptyMessage: f.text('Empty cart message', 'Your cart is empty.'), checkoutLabel: f.text('Checkout button', 'Checkout'), ...styleFields }),
    hints: { keywords: ['cart', 'basket', 'bag'], titleField: 'title' },
    dataBound: true, interactive: true,
  }),
  testimonials: def({
    type: 'testimonials', name: 'Testimonials', icon: 'Quote', description: 'Customer quotes.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading', 'What customers say'), headingLevel: f.heading(), columns: f.range('Columns', 1, 4, 3), ...styleFields }),
    blocks: { max: 24, types: { testimonial: { name: 'Testimonial', settings: z.object({ quote: f.textarea('Quote', 'Great service.'), author: f.text('Name'), role: f.text('Role or company'), avatar: f.image('Photo'), rating: f.range('Stars', 0, 5, 5) }) } } },
    hints: { keywords: ['testimonials', 'reviews', 'quotes', 'customers say'], titleField: 'title' },
  }),
  'logo-cloud': def({
    type: 'logo-cloud', name: 'Logo cloud', icon: 'Building2', description: 'Row of partner or client logos.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading'), headingLevel: f.heading('Heading level', 'h3'), grayscale: f.boolean('Greyscale', true), ...styleFields }),
    blocks: { max: 40, types: { logo: { name: 'Logo', settings: z.object({ image: f.image('Logo'), link: f.link('Link') }) } } },
    hints: { keywords: ['logos', 'clients', 'partners', 'brands', 'trusted by', 'as seen'], titleField: 'title' },
  }),
  faq: def({
    type: 'faq', name: 'FAQ', icon: 'CircleHelp', description: 'Questions and answers.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading', 'Frequently asked questions'), headingLevel: f.heading(), ...styleFields }),
    blocks: { max: 60, types: { question: { name: 'Question', settings: z.object({ question: f.text('Question', 'Question?'), answer: f.richtext('Answer') }) } } },
    hints: { keywords: ['faq', 'questions', 'help', 'q&a'], titleField: 'title' },
    interactive: true,
  }),
  newsletter: def({
    type: 'newsletter', name: 'Newsletter', icon: 'Mail', description: 'Email sign-up form.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading', 'Join our newsletter'), headingLevel: f.heading(), body: f.richtext('Text'), placeholder: f.text('Placeholder', 'Email address'), buttonLabel: f.text('Button', 'Subscribe'), successMessage: f.text('Success message', 'Thanks for subscribing!'), ...styleFields }),
    hints: { keywords: ['newsletter', 'subscribe', 'sign up', 'signup', 'email'], titleField: 'title' },
    interactive: true,
  }),
  'cta-banner': def({
    type: 'cta-banner', name: 'Call to action', icon: 'MousePointerClick', description: 'Short message with a prominent button.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading', 'Ready to get started?'), headingLevel: f.heading(), body: f.richtext('Text'), image: f.image('Background image'), ...ctaFields, ...styleFields }),
    hints: { keywords: ['cta', 'call to action', 'banner', 'promo', 'get started', 'contact us'], titleField: 'title' },
  }),
  video: def({
    type: 'video', name: 'Video', icon: 'Play', description: 'YouTube, Vimeo or MP4 video.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading'), headingLevel: f.heading(), url: f.video('Video URL (YouTube, Vimeo or https .mp4)'), poster: f.image('Cover image'), autoplay: f.boolean('Autoplay muted', false), ...styleFields }),
    hints: { keywords: ['video', 'film', 'watch', 'play'], titleField: 'title' },
  }),
  gallery: def({
    type: 'gallery', name: 'Gallery', icon: 'Images', description: 'Grid of images.',
    allowedPageTypes: CONTENT,
    settings: z.object({ title: f.text('Heading'), headingLevel: f.heading(), columns: f.range('Columns', 1, 6, 3), ...styleFields }),
    blocks: { max: 60, types: { image: { name: 'Image', settings: z.object({ image: f.image('Image'), caption: f.text('Caption'), link: f.link('Link') }) } } },
    hints: { keywords: ['gallery', 'images', 'photos', 'portfolio', 'instagram', 'lookbook'], titleField: 'title' },
  }),
  spacer: def({
    type: 'spacer', name: 'Spacer', icon: 'MoveVertical', description: 'Empty space between sections.',
    allowedPageTypes: [...CONTENT, 'HEADER', 'FOOTER'],
    settings: z.object({ height: f.range('Height', 0, 400, 48, 4, 'px'), mobileHeight: f.range('Height on mobile', 0, 400, 24, 4, 'px'), background: styleFields.background }),
    hints: { keywords: ['spacer', 'space', 'divider', 'gap'] },
  }),
  freeform: def({
    type: 'freeform', name: 'Figma section', icon: 'Shapes', description: 'Figma layout kept as designed; every layer can be selected, edited, styled, hidden or removed.',
    allowedPageTypes: [...CONTENT, 'HEADER', 'FOOTER', 'ANNOUNCEMENT'],
    // tree: the IR layout (src/shared/design-ir.ts). The editor can hide, delete, duplicate and reorder layers
    // (src/shared/freeform-edit.ts); content and style edits go to the override maps keyed by node id.
    // trees: the same section designed for tablet/mobile (exact layout); variants: component variants that
    // prototype interactions change to (hover states, carousels, timed loops).
    settings: z.object({
      label: z.string().max(120).default(''),
      hiddenLayers: z.array(z.string().max(100)).max(5000).default([]),
      styles: z.record(z.string().max(100), layerStyleSchema).default({}),
      videos: z.record(z.string().max(100), layerVideoSchema).default({}),
      // Scroll story: ids (in variants) of the screens the page smart-animates through on scroll, in order.
      scenes: z.array(z.string().max(100)).max(40).default([]),
      tree: z.any(),
      trees: z.partialRecord(z.enum(['tablet', 'mobile']), z.any()).default({}),
      variants: z.record(z.string(), z.any()).default({}),
      exact: z.boolean().default(false),
      texts: z.record(z.string(), z.any()).default({}),
      images: z.record(z.string(), z.any()).default({}),
      links: z.record(z.string(), z.any()).default({}),
      headingNodeId: z.string().default(''),
      headingLevel: f.heading('Heading level of the main text', 'h2'),
    }),
    hints: { keywords: [] },
  }),
  'custom-code': def({
    type: 'custom-code', name: 'Custom code', icon: 'Code', description: 'Your own HTML, CSS and JavaScript (animations included), written by hand or generated with AI from a screenshot, video or code.',
    allowedPageTypes: [...CONTENT, 'HEADER', 'FOOTER', 'ANNOUNCEMENT'],
    // Runs in a sandboxed frame on the storefront (see custom-code.tsx), so its scripts can't reach the store page.
    settings: z.object({
      label: f.text('Name', 'Custom section', 120),
      html: f.code('HTML', 'html', '<section class="demo"><h2>Custom section</h2></section>'),
      css: f.code('CSS', 'css', '.demo{padding:64px 24px;text-align:center;font-family:system-ui,sans-serif}'),
      js: f.code('JavaScript', 'js'),
    }),
    hints: { keywords: [] },
  }),
}

export const sectionDef = (type: string): SectionDef | undefined => (SECTIONS as Record<string, SectionDef>)[type]

// ---- Stored section instance ----
export const blockInstanceSchema = z.object({ id: z.string().min(1).max(40), type: z.string().max(40), settings: z.record(z.string(), z.unknown()) })
export const sectionInstanceSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  figmaNodeId: z.string().max(100).nullable().default(null),
  settings: z.record(z.string(), z.unknown()),
  blocks: z.array(blockInstanceSchema).max(100).default([]),
  responsive: z.object({ tablet: z.record(z.string(), z.unknown()).optional(), mobile: z.record(z.string(), z.unknown()).optional() }).default({}),
  hidden: z.boolean().default(false),
  overriddenFields: z.array(z.string().max(120)).max(400).default([]),
  mappingConfidence: z.number().min(0).max(1).default(1),
})
export type SectionInstance = z.infer<typeof sectionInstanceSchema>
export type BlockInstance = z.infer<typeof blockInstanceSchema>
export const pageSectionsSchema = z.array(sectionInstanceSchema).max(80)

export type SectionIssue = { path: string; message: string }

/** Full validation of one section: envelope, settings and every block against the registry. */
export function validateSection(raw: unknown): { ok: true; section: SectionInstance } | { ok: false; issues: SectionIssue[] } {
  const env = sectionInstanceSchema.safeParse(raw)
  if (!env.success) return { ok: false, issues: env.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }
  const s = env.data
  const d = SECTIONS[s.type]
  const settings = d.settings.safeParse(s.settings)
  if (!settings.success) return { ok: false, issues: settings.error.issues.map((i) => ({ path: `settings.${i.path.join('.')}`, message: i.message })) }
  const blocks: BlockInstance[] = []
  for (const [i, b] of s.blocks.entries()) {
    const bd = d.blocks?.types[b.type]
    if (!bd) return { ok: false, issues: [{ path: `blocks.${i}.type`, message: `Unknown block type ${b.type}` }] }
    const bs = bd.settings.safeParse(b.settings)
    if (!bs.success) return { ok: false, issues: bs.error.issues.map((x) => ({ path: `blocks.${i}.settings.${x.path.join('.')}`, message: x.message })) }
    blocks.push({ ...b, settings: bs.data })
  }
  if (d.blocks && blocks.length > d.blocks.max) return { ok: false, issues: [{ path: 'blocks', message: `At most ${d.blocks.max} blocks` }] }
  const responsive: SectionInstance['responsive'] = {}
  for (const device of ['tablet', 'mobile'] as const) {
    const r = s.responsive[device]
    if (!r) continue
    const partial = d.settings.partial().safeParse(r)
    if (!partial.success) return { ok: false, issues: [{ path: `responsive.${device}`, message: partial.error.issues[0]?.message ?? 'Invalid' }] }
    responsive[device] = partial.data
  }
  return { ok: true, section: { ...s, settings: settings.data, blocks, responsive } }
}

/** Default settings for a new section (and new blocks). */
export function defaultSettings(type: SectionType) { return SECTIONS[type].settings.parse({}) }
export function defaultBlockSettings(type: SectionType, blockType: string) { return SECTIONS[type].blocks?.types[blockType]?.settings.parse({}) ?? {} }

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
