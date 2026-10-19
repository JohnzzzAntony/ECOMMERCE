// Field types for section settings. Each builder returns a Zod schema carrying editor metadata (`.meta()`), so the
// admin settings form is generated from the same schema that validates stored page JSON and the storefront render.
// No field accepts HTML: rich text is structured runs, links are typed, so stored content is safe to render.
import { z } from 'zod'

export type Control =
  | 'text' | 'textarea' | 'richtext' | 'image' | 'link' | 'color' | 'select' | 'range' | 'boolean'
  | 'product' | 'products' | 'collection' | 'links' | 'heading' | 'video'
export type FieldMeta = { control: Control; label: string; help?: string; options?: { value: string; label: string }[]; min?: number; max?: number; step?: number; unit?: string }

const SAFE_URL = /^(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+|tel:[+\d\s()-]+|\/[^\s<>"']*|#[\w-]*)$/i

export const linkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('page'), slug: z.string().max(80) }), // '' = home
  z.object({ kind: z.literal('product'), slug: z.string().max(200) }),
  z.object({ kind: z.literal('collection'), slug: z.string().max(200) }),
  z.object({ kind: z.literal('url'), url: z.string().max(2000).regex(SAFE_URL, 'Links must start with https://, http://, mailto:, tel:, / or #'), newTab: z.boolean().default(false) }),
])
export type LinkValue = z.infer<typeof linkSchema>
export const NO_LINK: LinkValue = { kind: 'none' }

export const runSchema = z.object({
  text: z.string().max(5000),
  bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), strike: z.boolean().optional(),
  link: linkSchema.optional(),
})
export const paragraphSchema = z.object({ type: z.enum(['p', 'li']).default('p'), runs: z.array(runSchema).max(200) })
export const richTextSchema = z.array(paragraphSchema).max(100)
export type RichText = z.infer<typeof richTextSchema>
export const rt = (text: string): RichText => (text ? text.split(/\n{2,}/).map((p) => ({ type: 'p' as const, runs: [{ text: p }] })) : [])
export const rtPlain = (value: RichText | undefined) => (value ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n\n')

const IMAGE_URL = /^(https:\/\/[^\s<>"']+|\/[^\s<>"']*)$/
export const imageSchema = z.object({
  url: z.string().max(2000).regex(IMAGE_URL),
  alt: z.string().max(300).default(''),
  decorative: z.boolean().default(false),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  assetId: z.string().max(40).optional(),
  blurhash: z.string().max(200).optional(),
}).nullable()
export type ImageValue = z.infer<typeof imageSchema>

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
export const colorSchema = z.object({ token: z.string().max(80).optional(), value: z.string().regex(HEX).optional() }).nullable()
export type ColorValue = z.infer<typeof colorSchema>

/** Video: YouTube/Vimeo/https file URL, or an uploaded file (Cloudinary https, or /api/design/storage/ locally). */
export const VIDEO_URL = /^(https:\/\/[^\s<>"']+|\/api\/design\/storage\/[\w./-]+)?$/
/** A video playing in a freeform (Figma) layer, e.g. a hero background. Always muted when it autoplays. */
export const layerVideoSchema = z.object({
  url: z.string().min(1).max(2000).regex(VIDEO_URL),
  poster: z.string().max(2000).regex(IMAGE_URL).optional(),
  autoplay: z.boolean().default(true),
  loop: z.boolean().default(true),
  controls: z.boolean().default(false),
})
export type LayerVideo = z.infer<typeof layerVideoSchema>

const m = <T extends z.ZodType>(schema: T, meta: FieldMeta) => schema.meta(meta as unknown as Record<string, unknown>)

/** Field builders: f.text('Title', 'Default') etc. */
export const f = {
  text: (label: string, def = '', max = 300) => m(z.string().max(max).default(def), { control: 'text', label }),
  textarea: (label: string, def = '', max = 2000) => m(z.string().max(max).default(def), { control: 'textarea', label }),
  richtext: (label: string, def: RichText = []) => m(richTextSchema.default(def), { control: 'richtext', label }),
  image: (label: string) => m(imageSchema.default(null), { control: 'image', label }),
  link: (label: string) => m(linkSchema.default(NO_LINK), { control: 'link', label }),
  links: (label: string) => m(z.array(z.object({ label: z.string().max(120), link: linkSchema })).max(40).default([]), { control: 'links', label }),
  color: (label: string) => m(colorSchema.default(null), { control: 'color', label }),
  select: <const V extends readonly [string, ...string[]]>(label: string, values: V, def: V[number], labels?: Partial<Record<V[number], string>>) =>
    m(z.enum(values).default(def as never), { control: 'select', label, options: values.map((v) => ({ value: v, label: labels?.[v as V[number]] ?? v })) }),
  range: (label: string, min: number, max: number, def: number, step = 1, unit?: string) => m(z.number().min(min).max(max).default(def), { control: 'range', label, min, max, step, unit }),
  boolean: (label: string, def = false) => m(z.boolean().default(def), { control: 'boolean', label }),
  product: (label: string) => m(z.string().max(200).default(''), { control: 'product', label }),
  products: (label: string) => m(z.array(z.string().max(200)).max(48).default([]), { control: 'products', label }),
  collection: (label: string) => m(z.string().max(200).default(''), { control: 'collection', label }),
  heading: (label = 'Heading level', def: 'h1' | 'h2' | 'h3' | 'h4' = 'h2') =>
    m(z.enum(['h1', 'h2', 'h3', 'h4', 'p']).default(def), { control: 'heading', label, options: ['h1', 'h2', 'h3', 'h4', 'p'].map((v) => ({ value: v, label: v === 'p' ? 'Not a heading' : v.toUpperCase() })) }),
  video: (label: string) => m(z.string().max(2000).regex(VIDEO_URL).default(''), { control: 'video', label }),
}

export function fieldMeta(schema: z.ZodType): FieldMeta | undefined {
  return schema.meta() as FieldMeta | undefined
}

/**
 * Per-layer style overrides of a freeform (Figma) section, keyed by IR node id. Lengths are Figma px (scaled like
 * the rest of the layer on exact pages); unset keys keep the Figma value.
 */
export const LAYER_STYLE_FIELDS = {
  textColor: { control: 'color', label: 'Text colour' },
  fontSize: { control: 'range', label: 'Font size', min: 6, max: 200, step: 1, unit: 'px' },
  fontWeight: { control: 'select', label: 'Font weight', options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) })) },
  align: { control: 'select', label: 'Text alignment', options: ['left', 'center', 'right', 'justify'].map((v) => ({ value: v, label: v })) },
  background: { control: 'color', label: 'Background' },
  paddingY: { control: 'range', label: 'Padding top and bottom', min: 0, max: 400, step: 1, unit: 'px' },
  paddingX: { control: 'range', label: 'Padding left and right', min: 0, max: 400, step: 1, unit: 'px' },
  gap: { control: 'range', label: 'Space between items', min: 0, max: 400, step: 1, unit: 'px' },
  radius: { control: 'range', label: 'Corner radius', min: 0, max: 500, step: 1, unit: 'px' },
  opacity: { control: 'range', label: 'Opacity', min: 0, max: 100, step: 5, unit: '%' },
} satisfies Record<string, FieldMeta>
export type LayerStyleKey = keyof typeof LAYER_STYLE_FIELDS
export const layerStyleSchema = z.object({
  textColor: colorSchema.optional(),
  fontSize: z.number().min(6).max(200).optional(),
  fontWeight: z.coerce.number().int().min(100).max(900).optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  background: colorSchema.optional(),
  paddingY: z.number().min(0).max(400).optional(),
  paddingX: z.number().min(0).max(400).optional(),
  gap: z.number().min(0).max(400).optional(),
  radius: z.number().min(0).max(500).optional(),
  opacity: z.number().min(0).max(100).optional(),
}).strict()
export type LayerStyle = z.infer<typeof layerStyleSchema>

/** Shared look settings every section has. */
export const styleFields = {
  background: f.color('Background'),
  textColor: f.color('Text colour'),
  paddingTop: f.range('Space above', 0, 240, 48, 4, 'px'),
  paddingBottom: f.range('Space below', 0, 240, 48, 4, 'px'),
  align: f.select('Alignment', ['left', 'center', 'right'] as const, 'left'),
  fullWidth: f.boolean('Full width', false),
}
