// Store pages built from sections: fixed slugs for templates/global sections, storefront URLs, link hrefs and the
// pre-publish checklist. Shared by the admin editor and the API.
import { z } from 'zod'
import type { LinkValue, RichText } from './sections/fields'
import { sectionDef, validateSection, type SectionInstance } from './sections/registry'

export const STORE_PAGE_TYPES = ['HOME', 'PAGE', 'PRODUCT_TEMPLATE', 'COLLECTION_TEMPLATE', 'CART', 'HEADER', 'FOOTER', 'ANNOUNCEMENT'] as const
export type StorePageType = (typeof STORE_PAGE_TYPES)[number]

/** Every type except PAGE exists once per store, under a reserved slug. */
export const RESERVED_SLUGS: Record<Exclude<StorePageType, 'PAGE'>, string> = {
  HOME: '', PRODUCT_TEMPLATE: '_product', COLLECTION_TEMPLATE: '_collection', CART: '_cart', HEADER: '_header', FOOTER: '_footer', ANNOUNCEMENT: '_announcement',
}
export const GLOBAL_TYPES: StorePageType[] = ['HEADER', 'FOOTER', 'ANNOUNCEMENT']
export const slugFor = (type: StorePageType, slug?: string) => (type === 'PAGE' ? slug ?? '' : RESERVED_SLUGS[type])
export const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const seoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(320).optional(),
  ogImage: z.string().max(2000).regex(/^(https:\/\/[^\s<>"']+|\/[^\s<>"']*)?$/).optional(),
  canonical: z.string().max(2000).regex(/^(https:\/\/[^\s<>"']+)?$/).optional(),
  noindex: z.boolean().optional(),
})
export type Seo = z.infer<typeof seoSchema>

/** Storefront URL of a page (Figma-designed storefront). */
export function pageUrl(type: StorePageType, slug: string) {
  if (type === 'HOME') return '/'
  if (type === 'PAGE') return `/pages/${slug}`
  if (type === 'CART') return '/cart'
  return null
}

export function linkHref(link: LinkValue | undefined | null): string | null {
  if (!link) return null
  switch (link.kind) {
    case 'page': return link.slug === '' ? '/' : link.slug === '_cart' ? '/cart' : `/pages/${link.slug}`
    case 'product': return link.slug ? `/products/${encodeURIComponent(link.slug)}` : null
    case 'collection': return link.slug ? `/collections/${encodeURIComponent(link.slug)}` : null
    case 'url': return link.url
    default: return null
  }
}

export type ChecklistItem = { level: 'error' | 'warning'; code: 'MISSING_ALT' | 'MULTIPLE_H1' | 'EMPTY_LINK' | 'BROKEN_LINK' | 'LOW_CONTRAST' | 'FREEFORM' | 'INVALID_SECTION'; sectionId?: string; message: string }

type Walk = { onImage: (img: { alt?: string; decorative?: boolean; url?: string }, path: string) => void; onLink: (link: LinkValue, label: string, path: string) => void }

function walkSettings(value: unknown, path: string, w: Walk, label = '') {
  if (Array.isArray(value)) { value.forEach((v, i) => walkSettings(v, `${path}.${i}`, w, label)); return }
  if (!value || typeof value !== 'object') return
  const o = value as Record<string, unknown>
  if (typeof o.url === 'string' && 'alt' in o && 'width' in o) { w.onImage(o as { alt?: string; decorative?: boolean; url?: string }, path); return }
  if (typeof o.kind === 'string' && ['none', 'page', 'product', 'collection', 'url'].includes(o.kind)) { w.onLink(o as LinkValue, label, path); return }
  for (const [k, v] of Object.entries(o)) {
    // Buttons and menu items need a destination; optional links on text or cards (k === 'link') don't.
    const nextLabel = k === 'ctaLink' ? String(o.ctaLabel ?? '') : k === 'secondaryLink' ? String(o.secondaryLabel ?? '') : k === 'link' ? String(o.label ?? '') : label
    walkSettings(v, `${path}.${k}`, w, nextLabel)
  }
}

/**
 * Blocking: missing alt text, more than one h1, links with a label but no destination, links to pages that don't
 * exist (or aren't published), invalid sections. Warnings: freeform sections and low-contrast text colours.
 */
export function prePublishChecklist(sections: unknown[], existingSlugs: Set<string>, contrastWarnings: string[] = [], draftSlugs = new Set<string>()): ChecklistItem[] {
  const items: ChecklistItem[] = []
  let h1 = 0
  for (const raw of sections) {
    const v = validateSection(raw)
    if (!v.ok) { items.push({ level: 'error', code: 'INVALID_SECTION', sectionId: (raw as { id?: string })?.id, message: `A section is invalid (${v.issues[0]?.path}: ${v.issues[0]?.message}).` }); continue }
    const s: SectionInstance = v.section
    if (s.hidden) continue
    const name = sectionDef(s.type)?.name ?? s.type
    if (s.settings.headingLevel === 'h1' && (s.settings.title || s.type === 'freeform' || s.blocks.length)) h1++
    // A Figma section imported with its own mobile frame does adapt to small screens.
    if (s.type === 'freeform' && !(s.settings.trees as { mobile?: unknown } | undefined)?.mobile) items.push({ level: 'warning', code: 'FREEFORM', sectionId: s.id, message: `“${name}” keeps the Figma layout and won’t adapt as well to small screens. Consider choosing a section type.` })
    const walk: Walk = {
      onImage: (img) => { if (img.url && !img.decorative && !img.alt?.trim()) items.push({ level: 'error', code: 'MISSING_ALT', sectionId: s.id, message: `An image in “${name}” needs alt text (or mark it decorative).` }) },
      onLink: (link, label) => {
        if (link.kind === 'none' && label.trim()) items.push({ level: 'error', code: 'EMPTY_LINK', sectionId: s.id, message: `The button or link “${label}” in “${name}” has no destination.` })
        // Pages imported together link to each other, so a link to a not-yet-published page must not block publishing.
        if (link.kind === 'page' && !existingSlugs.has(link.slug)) {
          if (draftSlugs.has(link.slug)) items.push({ level: 'warning', code: 'BROKEN_LINK', sectionId: s.id, message: `A link in “${name}” points to a page that isn’t published yet (${link.slug || 'home'}). Publish it too, or the link will show “not found”.` })
          else items.push({ level: 'error', code: 'BROKEN_LINK', sectionId: s.id, message: `A link in “${name}” points to a page that doesn’t exist (${link.slug || 'home'}).` })
        }
        if ((link.kind === 'product' || link.kind === 'collection') && !link.slug) items.push({ level: 'error', code: 'EMPTY_LINK', sectionId: s.id, message: `A ${link.kind} link in “${name}” has no ${link.kind} selected.` })
      },
    }
    walkSettings(s.settings, 'settings', walk)
    s.blocks.forEach((b, i) => walkSettings(b.settings, `blocks.${i}`, walk))
    if (s.type === 'freeform') {
      for (const [, img] of Object.entries((s.settings.images ?? {}) as Record<string, { alt?: string; decorative?: boolean; url?: string }>)) walk.onImage(img, '')
    }
  }
  if (h1 > 1) items.push({ level: 'error', code: 'MULTIPLE_H1', message: `This page has ${h1} H1 headings. Keep one and set the others to H2.` })
  for (const w of contrastWarnings) items.push({ level: 'warning', code: 'LOW_CONTRAST', message: w })
  const seen = new Set<string>()
  return items.filter((i) => { const k = `${i.sectionId}|${i.message}`; return !seen.has(k) && !!seen.add(k) })
}

export const richTextToPlain = (v: RichText | undefined) => (v ?? []).map((p) => p.runs.map((r) => r.text).join('')).join(' ')
