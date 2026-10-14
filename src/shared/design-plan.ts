// What the admin picks in the frame picker: Figma frames grouped into pages (one frame per device), each with
// a page type. Shared by the picker UI and the import API, which validates with importPlanSchema.
import { z } from 'zod'
import { slugify } from './slug'

export const DEVICES = ['desktop', 'tablet', 'mobile'] as const
export type Device = (typeof DEVICES)[number]

export const PAGE_TYPES = ['HOME', 'PAGE', 'PRODUCT_TEMPLATE', 'COLLECTION_TEMPLATE', 'CART', 'HEADER', 'FOOTER'] as const
export type PageType = (typeof PAGE_TYPES)[number]
export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  HOME: 'Home page', PAGE: 'Content page', PRODUCT_TEMPLATE: 'Product template', COLLECTION_TEMPLATE: 'Collection template',
  CART: 'Cart', HEADER: 'Header (all pages)', FOOTER: 'Footer (all pages)',
}
/** Types a store has at most one of. */
export const SINGLE_TYPES: PageType[] = ['HOME', 'PRODUCT_TEMPLATE', 'COLLECTION_TEMPLATE', 'CART', 'HEADER', 'FOOTER']

export type PickerFrame = { id: string; name: string; width: number; height: number }

const DEVICE_TOKEN = /\s*(?:[/|]\s*|@)(desktop|tablet|mobile)\s*$/i

/** "Home / Mobile", "Home @mobile" → { base: "Home", device: "mobile" }; otherwise the device comes from the width. */
export function frameDevice(frame: PickerFrame): { base: string; device: Device; named: boolean } {
  const m = frame.name.match(DEVICE_TOKEN)
  if (m) return { base: frame.name.slice(0, m.index).trim() || frame.name, device: m[1].toLowerCase() as Device, named: true }
  const device: Device = frame.width >= 1200 ? 'desktop' : frame.width >= 768 ? 'tablet' : 'mobile'
  return { base: frame.name.trim(), device, named: false }
}

export function guessPageType(name: string): PageType {
  const n = name.toLowerCase()
  if (/^(home|homepage|home page|landing|index)\b/.test(n)) return 'HOME'
  if (/\b(header|navbar|navigation)\b/.test(n)) return 'HEADER'
  if (/\bfooter\b/.test(n)) return 'FOOTER'
  if (/\b(cart|basket|bag)\b/.test(n)) return 'CART'
  if (/\b(product|pdp)\b/.test(n)) return 'PRODUCT_TEMPLATE'
  if (/\b(collection|category|catalog|catalogue|shop|plp)\b/.test(n)) return 'COLLECTION_TEMPLATE'
  return 'PAGE'
}

export type PlanPage = { title: string; type: PageType; slug?: string; frames: Partial<Record<Device, string>> }

/**
 * Groups selected frames into pages: same base name → one page with a frame per device. A second frame for a
 * device already taken starts a new page. Types are guessed from names; each single-instance type is given
 * to the first page only.
 */
export function pairFrames(frames: PickerFrame[]): PlanPage[] {
  const pages: PlanPage[] = []
  const byBase = new Map<string, PlanPage[]>()
  for (const frame of frames) {
    const { base, device } = frameDevice(frame)
    const key = base.toLowerCase()
    const candidates = byBase.get(key) ?? []
    let page = candidates.find((p) => !p.frames[device])
    if (!page) {
      page = { title: base, type: 'PAGE', frames: {} }
      candidates.push(page); byBase.set(key, candidates); pages.push(page)
    }
    page.frames[device] = frame.id
  }
  const used = new Set<PageType>()
  for (const page of pages) {
    const type = guessPageType(page.title)
    page.type = SINGLE_TYPES.includes(type) && used.has(type) ? 'PAGE' : type
    used.add(page.type)
    if (page.type === 'PAGE') page.slug = uniqueSlug(slugify(page.title) || 'page', pages)
  }
  return pages
}

function uniqueSlug(base: string, pages: PlanPage[]) {
  let slug = base, n = 2
  while (pages.some((p) => p.slug === slug)) slug = `${base}-${n++}`
  return slug
}

const nodeId = z.string().regex(/^\d+:\d+$/, 'Invalid frame id')
const fileKey = z.string().regex(/^[A-Za-z0-9]{10,64}$/, 'Invalid Figma file key')

export const importPlanSchema = z.object({
  fileKey,
  branchKey: fileKey.nullable().optional(),
  pages: z.array(z.object({
    title: z.string().trim().min(1, 'Every page needs a title').max(120),
    type: z.enum(PAGE_TYPES),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slugs use lowercase letters, numbers and dashes').max(80).optional(),
    frames: z.object({ desktop: nodeId.optional(), tablet: nodeId.optional(), mobile: nodeId.optional() })
      .refine((f) => f.desktop || f.tablet || f.mobile, 'Every page needs at least one frame'),
  })).min(1, 'Select at least one frame').max(50, 'Import at most 50 pages at a time'),
}).superRefine((plan, ctx) => {
  const seenTypes = new Set<string>(), slugs = new Set<string>(), frames = new Set<string>()
  plan.pages.forEach((page, i) => {
    if (SINGLE_TYPES.includes(page.type)) {
      if (seenTypes.has(page.type)) ctx.addIssue({ code: 'custom', path: ['pages', i, 'type'], message: `Only one page can be the ${PAGE_TYPE_LABELS[page.type]}` })
      seenTypes.add(page.type)
    }
    if (page.type === 'PAGE') {
      if (!page.slug) ctx.addIssue({ code: 'custom', path: ['pages', i, 'slug'], message: `"${page.title}" needs a URL slug` })
      else if (slugs.has(page.slug)) ctx.addIssue({ code: 'custom', path: ['pages', i, 'slug'], message: `The slug "${page.slug}" is used twice` })
      else slugs.add(page.slug)
    }
    for (const id of Object.values(page.frames)) {
      if (!id) continue
      if (frames.has(id)) ctx.addIssue({ code: 'custom', path: ['pages', i, 'frames'], message: 'A frame can belong to only one page' })
      frames.add(id)
    }
  })
})

export type ImportPlan = z.infer<typeof importPlanSchema>

export function planFrameIds(plan: Pick<ImportPlan, 'pages'>) {
  return plan.pages.flatMap((p) => DEVICES.map((d) => p.frames[d]).filter((id): id is string => !!id))
}
