// Section mapping: IR frames → page sections. Order per section:
//   1. explicit names (frame "Section/<type>", layers "{{title}}", "Block/<type>"),
//   2. saved mappings from earlier reviews (store + file + node),
//   3. heuristics with a confidence score,
//   4. freeform fallback (keeps the Figma layout, text/images/links stay editable).
// Images are written as pending references ("pending:img:<imageRef>" / "pending:svg:<nodeId>") that the asset
// stage replaces with stored URLs. Pure: no I/O.
import { plainText, walkIR, type IRLink, type IRNode, type IRPage, type IRWarning } from '@/shared/design-ir'
import { NO_LINK, type LinkValue, type RichText } from '@/shared/sections/fields'
import { SECTIONS, SECTION_TYPES, defaultSettings, newId, type SectionInstance, type SectionType } from '@/shared/sections/registry'

export type SavedMapping = { sectionType: string; fieldMap: Record<string, string> }
export type MappingContext = {
  saved: Map<string, SavedMapping>
  /** Frame node id → page link slug ('' = home) for prototype links between imported frames. */
  framePages: Map<string, string>
}
export type MappedPage = { title: string; type: string; slug?: string; frames: { device: string; nodeId: string }[]; sections: SectionInstance[]; warnings: IRWarning[] }

const ALIASES: Record<string, SectionType> = {
  announcement: 'announcement-bar', products: 'product-grid', product: 'product-detail', collections: 'collection-list',
  slideshow: 'hero-slideshow', slider: 'hero-slideshow', features: 'feature-grid', text: 'rich-text', cta: 'cta-banner',
  logos: 'logo-cloud', imagetext: 'image-with-text', 'image-text': 'image-with-text', richtext: 'rich-text',
}
export function explicitType(name: string): SectionType | null {
  const m = name.match(/^\s*section\s*\/\s*([\w-]+)/i)
  if (!m) return null
  const t = m[1].toLowerCase()
  return (SECTION_TYPES as readonly string[]).includes(t) ? (t as SectionType) : ALIASES[t] ?? null
}

// ---------------------------------------------------------------- node features
type Features = { texts: IRNode[]; images: IRNode[]; vectors: IRNode[]; buttons: IRNode[]; maxFont: number; imageArea: number; priceTexts: number; questions: number; inputs: number }

const PRICE = /(\$|€|£|AED|USD|SAR|EUR|GBP|د\.إ)\s?\d|\d+[.,]\d{2}\s?(\$|€|£|AED|USD|SAR)?$/i
const isButton = (n: IRNode) => !!n.component?.primitive || (n.kind === 'frame' && /\b(button|btn|cta)\b/i.test(n.name)) ||
  (n.kind === 'frame' && n.children.length >= 1 && n.children.length <= 2 && n.children.some((c) => c.kind === 'text') && !!n.link && n.height <= 80)
const isImage = (n: IRNode) => n.kind === 'image' || (n.kind === 'frame' && n.fills.some((f) => f.type === 'image'))

function features(node: IRNode): Features {
  const f: Features = { texts: [], images: [], vectors: [], buttons: [], maxFont: 0, imageArea: 0, priceTexts: 0, questions: 0, inputs: 0 }
  walkIR(node, (n) => {
    if (n.kind === 'text' && plainText(n).trim()) {
      f.texts.push(n); f.maxFont = Math.max(f.maxFont, n.text!.style.fontSize)
      const t = plainText(n).trim()
      if (PRICE.test(t)) f.priceTexts++
      if (t.endsWith('?') && t.length > 8) f.questions++
    }
    if (isImage(n) && n !== node) { f.images.push(n); f.imageArea += n.width * n.height }
    if (n.kind === 'vector') f.vectors.push(n)
    if (n !== node && isButton(n)) f.buttons.push(n)
    if (n.kind === 'frame' && n.stroke && n.height <= 64 && /email|e-mail|your mail|input|field/i.test(`${n.name} ${n.children.map(plainText).join(' ')}`)) f.inputs++
  })
  return f
}

const signature = (n: IRNode) => {
  const counts = { text: 0, image: 0, vector: 0, frame: 0 }
  walkIR(n, (x) => { if (x !== n) counts[isImage(x) ? 'image' : x.kind]++ })
  return `${n.component?.name ?? ''}|${counts.text}|${counts.image > 0}|${counts.vector > 0}`
}

/** A container whose children repeat (≥2 alike, or explicitly named Block/...). Searches 3 levels down. */
export function repeatedItems(node: IRNode, depth = 0): IRNode[] | null {
  const named = node.children.filter((c) => /^\s*block\s*\//i.test(c.name))
  if (named.length) return named
  if (node.children.length >= 2) {
    const sigs = node.children.map(signature)
    const top = [...new Set(sigs)].map((s) => [s, sigs.filter((x) => x === s).length] as const).sort((a, b) => b[1] - a[1])[0]
    const items = node.children.filter((c, i) => sigs[i] === top[0])
    const similarSize = items.every((c) => Math.abs(c.width - items[0].width) <= Math.max(12, items[0].width * 0.15))
    if (top[1] >= 2 && items.length >= Math.max(2, node.children.length * 0.6) && similarSize && items.some((c) => c.children.length)) return items
  }
  if (depth >= 3) return null
  for (const child of node.children) {
    const r = repeatedItems(child, depth + 1)
    if (r) return r
  }
  return null
}

// ---------------------------------------------------------------- heuristics
export function classify(node: IRNode, index: number, frameWidth: number): { type: SectionType; confidence: number } {
  const lname = node.name.toLowerCase()
  const f = features(node)
  const fullWidth = node.width >= frameWidth * 0.9
  // A thin full-width strip of text at the very top is an announcement bar whatever it is called.
  if (index === 0 && node.height <= 64 && f.texts.length >= 1 && f.texts.length <= 2 && f.images.length === 0 && fullWidth) return { type: 'announcement-bar', confidence: 0.7 }
  for (const def of Object.values(SECTIONS)) {
    if (def.type === 'freeform' || def.type === 'header' || def.type === 'footer') continue
    if (def.hints.keywords.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lname))) return { type: def.type, confidence: 0.75 }
  }
  if (!f.texts.length && !f.images.length && !f.vectors.length && node.height <= 200) return { type: 'spacer', confidence: 0.8 }

  const items = repeatedItems(node)
  if (items && items.length >= 2) {
    const itemFeatures = items.map(features)
    if (f.priceTexts >= 2) return { type: 'product-grid', confidence: 0.7 }
    if (itemFeatures.every((x) => x.questions >= 1)) return { type: 'faq', confidence: 0.7 }
    if (itemFeatures.every((x) => x.texts.length === 0 && (x.images.length + x.vectors.length) >= 1)) {
      return items.every((i) => i.height <= 140) ? { type: 'logo-cloud', confidence: 0.6 } : { type: 'gallery', confidence: 0.6 }
    }
    if (itemFeatures.every((x) => x.texts.some((t) => /^[“"«]/.test(plainText(t).trim()) || plainText(t).length > 80) && x.texts.length >= 2)) return { type: 'testimonials', confidence: 0.55 }
    if (itemFeatures.every((x) => x.texts.length >= 1)) return { type: 'feature-grid', confidence: 0.55 }
  }
  const bgImage = node.fills.some((p) => p.type === 'image') || f.images.some((i) => i.width >= node.width * 0.6 && i.height >= node.height * 0.6)
  if (index <= 1 && fullWidth && f.maxFont >= 32 && (bgImage || f.imageArea >= node.width * node.height * 0.3)) return { type: 'hero', confidence: 0.7 }
  if (f.inputs >= 1 && (f.buttons.length >= 1 || /subscribe|sign up/i.test(f.texts.map(plainText).join(' ')))) return { type: 'newsletter', confidence: 0.65 }
  if (/video|play/i.test(lname) || f.vectors.some((v) => /play/i.test(v.name))) return { type: 'video', confidence: 0.5 }
  if (f.images.length >= 1 && f.texts.length >= 1) {
    const big = f.images.sort((a, b) => b.width * b.height - a.width * a.height)[0]
    if (big.width <= node.width * 0.65 && big.width >= node.width * 0.25) return { type: 'image-with-text', confidence: 0.6 }
    if (bgImage && f.maxFont >= 24) return { type: index <= 1 ? 'hero' : 'cta-banner', confidence: 0.55 }
  }
  if (!f.images.length && f.texts.length >= 1) {
    if (f.buttons.length >= 1 && f.maxFont >= 20 && node.fills.some((p) => p.type !== 'image')) return { type: 'cta-banner', confidence: 0.5 }
    return { type: 'rich-text', confidence: 0.55 }
  }
  return { type: 'freeform', confidence: 0 }
}

// ---------------------------------------------------------------- field extraction
export function toLink(l: IRLink | undefined, ctx: MappingContext): LinkValue {
  if (!l) return NO_LINK
  if (l.kind === 'url') return /^(https?:\/\/|mailto:|tel:)/i.test(l.url) ? { kind: 'url', url: l.url.slice(0, 2000), newTab: l.newTab } : NO_LINK
  const slug = ctx.framePages.get(l.nodeId)
  return slug === undefined ? NO_LINK : { kind: 'page', slug }
}

export function toRichText(nodes: IRNode[], ctx: MappingContext): RichText {
  return nodes.flatMap((n) => {
    const runs = (n.text?.runs ?? []).map((r) => ({
      text: r.text, ...(r.marks.bold ? { bold: true } : {}), ...(r.marks.italic ? { italic: true } : {}),
      ...(r.marks.underline ? { underline: true } : {}), ...(r.marks.strike ? { strike: true } : {}),
      ...(r.marks.link ? { link: toLink(r.marks.link, ctx) } : {}),
    })).filter((r) => r.text)
    // Split on blank lines into paragraphs, keeping marks per run.
    const paragraphs: RichText = [{ type: 'p', runs: [] }]
    for (const run of runs) {
      const parts = run.text.split(/\n{2,}/)
      parts.forEach((text, i) => {
        if (i > 0) paragraphs.push({ type: 'p', runs: [] })
        if (text) paragraphs[paragraphs.length - 1].runs.push({ ...run, text })
      })
    }
    return paragraphs.filter((p) => p.runs.length)
  })
}

export function imageValue(n: IRNode | undefined) {
  if (!n) return null
  const ref = n.kind === 'vector' ? `pending:svg:${n.id}` : `pending:img:${n.image?.imageRef ?? (n.fills.find((f) => f.type === 'image') as { imageRef: string } | undefined)?.imageRef}`
  if (ref.endsWith('undefined')) return null
  return { url: ref, alt: cleanAlt(n.name), decorative: false, width: Math.max(1, n.width), height: Math.max(1, n.height) }
}
/** Layer name as a starting alt text (flagged for review); generic or structural names give none. */
const cleanAlt = (name: string) => (/^(image|rectangle|frame|group|vector|ellipse|img|photo|picture|bg|background)\s*\d*$/i.test(name.trim()) || /^\s*(section|block)\s*\//i.test(name) ? '' : name.replace(/\{\{.*?\}\}/g, '').trim().slice(0, 300))

const byFont = (a: IRNode, b: IRNode) => (b.text!.style.fontSize - a.text!.style.fontSize) || (b.text!.style.fontWeight - a.text!.style.fontWeight)
const byArea = (a: IRNode, b: IRNode) => b.width * b.height - a.width * a.height
const byPosition = (a: IRNode, b: IRNode) => a.y - b.y || a.x - b.x

function findNamed(node: IRNode, field: string): IRNode | undefined {
  let found: IRNode | undefined
  walkIR(node, (n) => { if (!found && new RegExp(`\\{\\{\\s*${field}\\s*\\}\\}`, 'i').test(n.name)) found = n })
  return found
}
function findById(node: IRNode, id: string): IRNode | undefined {
  let found: IRNode | undefined
  walkIR(node, (n) => { if (!found && n.id === id) found = n })
  return found
}

type Picks = { title?: IRNode; eyebrow?: IRNode; body: IRNode[]; image?: IRNode; button?: IRNode; secondButton?: IRNode; small?: IRNode }

/** Choose title/body/image/button layers: explicit {{names}} and saved field maps first, then by size and position. */
function pick(node: IRNode, fieldMap: Record<string, string>, exclude: Set<string> = new Set()): Picks {
  const f = features(node)
  const buttons = f.buttons.filter((b) => !exclude.has(b.id))
  const buttonTexts = new Set(buttons.flatMap((b) => { const ids: string[] = []; walkIR(b, (x) => { if (x.kind === 'text') ids.push(x.id) }); return ids }))
  const texts = f.texts.filter((t) => !buttonTexts.has(t.id) && !exclude.has(t.id))
  const explicit = (field: string) => (fieldMap[field] ? findById(node, fieldMap[field]) : undefined) ?? findNamed(node, field)

  const title = explicit('title') ?? [...texts].sort(byFont)[0]
  const rest = texts.filter((t) => t !== title).sort(byPosition)
  const eyebrow = explicit('eyebrow') ?? rest.find((t) => title && t.y < title.y && t.text!.style.fontSize < title.text!.style.fontSize * 0.7 && plainText(t).length < 60)
  const bodyExplicit = explicit('body') ?? explicit('subtitle')
  const body = bodyExplicit ? [bodyExplicit] : rest.filter((t) => t !== eyebrow && plainText(t).length > 0 && (!title || t.text!.style.fontSize <= title.text!.style.fontSize))
  const image = explicit('image') ?? [...f.images].filter((i) => !exclude.has(i.id)).sort(byArea)[0] ?? (node.fills.some((p) => p.type === 'image') ? node : undefined)
  const button = explicit('cta') ?? buttons.sort(byPosition)[0]
  const secondButton = buttons.filter((b) => b !== button).sort(byPosition)[0]
  return { title, eyebrow, body: body.slice(0, 6), image, button, secondButton, small: [...texts].sort(byFont).at(-1) }
}

const buttonLabel = (b: IRNode | undefined) => {
  if (!b) return ''
  let label = ''
  walkIR(b, (x) => { if (!label && x.kind === 'text') label = plainText(x).trim() })
  return label.slice(0, 120)
}
const buttonLink = (b: IRNode | undefined, ctx: MappingContext): LinkValue => {
  if (!b) return NO_LINK
  let l: IRLink | undefined = b.link
  walkIR(b, (x) => { l ??= x.link ?? x.text?.runs.find((r) => r.marks.link)?.marks.link })
  return toLink(l, ctx)
}

function sectionColors(node: IRNode, title?: IRNode) {
  const solid = node.fills.find((p) => p.type === 'solid')
  const hex = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  return {
    background: solid && solid.type === 'solid' && solid.color.a > 0.05 ? { value: hex(solid.color) } : null,
    textColor: title?.text?.style.color ? { value: hex(title.text.style.color) } : null,
  }
}
const alignOf = (t?: IRNode) => (t?.text?.style.align === 'center' ? 'center' : t?.text?.style.align === 'right' ? 'right' : 'left')
const clampPad = (v: number) => Math.min(240, Math.max(0, Math.round(v / 4) * 4))

function blockFields(type: SectionType, blockType: string, item: IRNode, ctx: MappingContext): Record<string, unknown> {
  const p = pick(item, {})
  const shape = SECTIONS[type].blocks!.types[blockType].settings.shape
  const out: Record<string, unknown> = {}
  const texts = [p.title, ...p.body].filter(Boolean) as IRNode[]
  const textFor = (i: number) => (texts[i] ? plainText(texts[i]).trim() : '')
  for (const key of Object.keys(shape)) {
    if (['title', 'question', 'author', 'label', 'caption'].includes(key)) out[key] = textFor(0).slice(0, 300)
    else if (['body', 'quote', 'subtitle'].includes(key)) out[key] = texts.slice(1).map((t) => plainText(t).trim()).join('\n\n').slice(0, 2000)
    else if (key === 'answer') out[key] = toRichText(texts.slice(1), ctx)
    else if (key === 'role') out[key] = texts.length > 2 ? plainText(texts[texts.length - 1]).trim().slice(0, 300) : ''
    else if (['image', 'icon', 'avatar'].includes(key)) out[key] = imageValue(p.image ?? item.children.find((c) => c.kind === 'vector'))
    else if (key === 'link' || key === 'ctaLink') out[key] = buttonLink(p.button, ctx).kind !== 'none' ? buttonLink(p.button, ctx) : toLink(item.link, ctx)
    else if (key === 'ctaLabel') out[key] = buttonLabel(p.button)
  }
  return out
}

function headerSettings(root: IRNode, ctx: MappingContext) {
  const f = features(root)
  const logo = [...f.images, ...f.vectors].sort(byPosition).find((n) => n.x < root.width * 0.4 || /logo/i.test(n.name))
  const logoText = !logo ? f.texts.slice().sort(byPosition)[0] : undefined
  const navTexts = f.texts.filter((t) => t !== logoText && plainText(t).trim().length <= 30 && !f.buttons.some((b) => findById(b, t.id)))
  const menu = navTexts.sort(byPosition).slice(0, 12).map((t) => ({ label: plainText(t).trim(), link: toLink(t.link ?? t.text?.runs.find((r) => r.marks.link)?.marks.link, ctx) }))
  const names = [...f.vectors, ...f.buttons].map((n) => n.name.toLowerCase()).join(' ')
  return { logo: imageValue(logo), logoText: logoText ? plainText(logoText).trim() : '', menu, showSearch: /search/.test(names), showCart: /cart|bag|basket/.test(names) || true, ...sectionColors(root, navTexts[0]) }
}

function footerParts(root: IRNode, ctx: MappingContext) {
  const f = features(root)
  const copyrightNode = f.texts.find((t) => /©|copyright|all rights/i.test(plainText(t)))
  const columns: { id: string; type: string; settings: Record<string, unknown> }[] = []
  walkIR(root, (n) => {
    if (n === root || n.kind !== 'frame' || columns.length >= 6) return
    const texts = n.children.filter((c) => c.kind === 'text')
    const direct = texts.length >= 3 && n.layout?.mode === 'column'
    if (direct && !columns.some((c) => (c.settings as { _ids: string[] })._ids.some((id) => findById(n, id)))) {
      const sorted = texts.sort(byPosition)
      columns.push({ id: newId(), type: 'column', settings: { _ids: sorted.map((t) => t.id), title: plainText(sorted[0]).trim().slice(0, 300), links: sorted.slice(1, 20).map((t) => ({ label: plainText(t).trim().slice(0, 120), link: toLink(t.link ?? t.text?.runs.find((r) => r.marks.link)?.marks.link, ctx) })) } })
    }
  })
  const about = f.texts.filter((t) => plainText(t).length > 60 && t !== copyrightNode).sort(byPosition)[0]
  const logo = [...f.images, ...f.vectors].sort(byPosition)[0]
  for (const c of columns) delete (c.settings as { _ids?: string[] })._ids
  return { settings: { logo: imageValue(logo), about: about ? toRichText([about], ctx) : [], copyright: copyrightNode ? plainText(copyrightNode).trim().slice(0, 300) : '', ...sectionColors(root) }, blocks: columns }
}

/** Settings and blocks for a section of `type` built from `node`. */
export function extract(type: SectionType, node: IRNode, ctx: MappingContext, fieldMap: Record<string, string> = {}, frameWidth = node.width): Pick<SectionInstance, 'settings' | 'blocks'> {
  const base = defaultSettings(type) as Record<string, unknown>
  const blocks: SectionInstance['blocks'] = []
  const p = pick(node, fieldMap)
  const layout = node.layout
  const look = {
    ...sectionColors(node, p.title), align: alignOf(p.title),
    ...(layout && 'paddingTop' in base ? { paddingTop: clampPad(layout.padding[0]), paddingBottom: clampPad(layout.padding[2]) } : {}),
    fullWidth: node.width >= frameWidth * 0.98 && !!node.fills.length,
  }
  const title = p.title ? plainText(p.title).trim().slice(0, 300) : ''
  const cta = { ctaLabel: buttonLabel(p.button), ctaLink: buttonLink(p.button, ctx) }
  const s: Record<string, unknown> = { ...base, ...look }
  const items = SECTIONS[type].blocks || type === 'product-grid' ? repeatedItems(node) ?? [] : []
  const exclude = new Set(items.flatMap((i) => { const ids: string[] = []; walkIR(i, (x) => ids.push(x.id)); return ids }))
  const outer = items.length ? pick(node, fieldMap, exclude) : p
  const outerTitle = outer.title ? plainText(outer.title).trim().slice(0, 300) : ''

  switch (type) {
    case 'announcement-bar': Object.assign(s, { text: (title || plainText(p.body[0] ?? node)).slice(0, 300), link: buttonLink(p.button, ctx).kind !== 'none' ? buttonLink(p.button, ctx) : toLink(p.title?.link, ctx) }); break
    case 'header': Object.assign(s, headerSettings(node, ctx)); break
    case 'footer': { const parts = footerParts(node, ctx); Object.assign(s, parts.settings); blocks.push(...parts.blocks); break }
    case 'hero': {
      const imageIsBg = !!p.image && (p.image === node || (p.image.width >= node.width * 0.8))
      const layoutKind = imageIsBg || !p.image ? 'background' : p.image.x < node.width / 2 ? 'split-left' : 'split-right'
      Object.assign(s, { eyebrow: p.eyebrow ? plainText(p.eyebrow).trim() : '', title, subtitle: toRichText(p.body.filter((b) => b !== p.eyebrow), ctx), image: imageValue(p.image), layout: layoutKind, minHeight: Math.min(1000, Math.max(200, Math.round(node.height / 20) * 20)), ...cta, secondaryLabel: buttonLabel(p.secondButton), secondaryLink: buttonLink(p.secondButton, ctx) })
      break
    }
    case 'image-with-text':
      Object.assign(s, { image: imageValue(p.image), imagePosition: p.image && p.image.x > node.width / 3 ? 'right' : 'left', eyebrow: p.eyebrow ? plainText(p.eyebrow).trim() : '', title, body: toRichText(p.body.filter((b) => b !== p.eyebrow), ctx), ...cta })
      break
    case 'rich-text': Object.assign(s, { title, body: toRichText(p.body, ctx), ...cta }); break
    case 'cta-banner': Object.assign(s, { title, body: toRichText(p.body, ctx), image: node.fills.some((x) => x.type === 'image') ? imageValue(node) : null, ...cta }); break
    case 'newsletter': Object.assign(s, { title, body: toRichText(p.body.filter((b) => !/email|@/i.test(plainText(b))), ctx), buttonLabel: buttonLabel(p.button) || 'Subscribe' }); break
    case 'video': Object.assign(s, { title, poster: imageValue(p.image) }); break
    case 'product-grid': {
      const firstRowY = items.length ? Math.min(...items.map((i) => i.y)) : 0
      const perRow = items.filter((i) => Math.abs(i.y - firstRowY) < 8).length
      Object.assign(s, { title: outerTitle, source: 'best-sellers', limit: Math.min(48, Math.max(1, items.length || 8)), columns: Math.min(6, Math.max(1, perRow || 4)) })
      break
    }
    case 'collection-list': case 'feature-grid': case 'testimonials': case 'logo-cloud': case 'faq': case 'gallery': case 'hero-slideshow': {
      const blockType = Object.keys(SECTIONS[type].blocks!.types)[0]
      for (const item of items.slice(0, SECTIONS[type].blocks!.max)) blocks.push({ id: newId(), type: blockType, settings: blockFields(type, blockType, item, ctx) })
      if ('title' in base) s.title = outerTitle
      if ('intro' in base) s.intro = toRichText(outer.body.slice(0, 2), ctx)
      if ('columns' in base && items.length) {
        const firstRowY = Math.min(...items.map((i) => i.y))
        s.columns = Math.min(6, Math.max(1, items.filter((i) => Math.abs(i.y - firstRowY) < 8).length))
      }
      break
    }
    case 'product-detail': case 'cart': if ('title' in base && title) s.title = title; break
    case 'spacer': Object.assign(s, { height: Math.min(400, Math.round(node.height / 4) * 4), mobileHeight: Math.min(400, Math.round(node.height / 8) * 4) }); break
    case 'freeform': {
      const largest = [...features(node).texts].sort(byFont)[0]
      Object.assign(s, { tree: node, texts: {}, images: {}, links: {}, headingNodeId: largest?.id ?? '' })
      break
    }
  }
  return { settings: s, blocks }
}

// ---------------------------------------------------------------- pages
/** The children that form sections; a single full-size wrapper is unwrapped first. */
export function sectionNodes(root: IRNode): IRNode[] {
  let container = root
  while (container.children.length === 1 && container.children[0].kind === 'frame' && container.children[0].children.length > 1 && container.children[0].width >= root.width * 0.9) container = container.children[0]
  const nodes = container.children.filter((c) => !(c.kind === 'vector' && c.width < 40))
  return container.layout?.mode === 'none' ? [...nodes].sort(byPosition) : nodes
}

function mapNode(node: IRNode, index: number, frameWidth: number, fileKey: string, ctx: MappingContext, forced?: SectionType): SectionInstance {
  const saved = ctx.saved.get(node.id)
  let type: SectionType, confidence: number
  if (forced) { type = forced; confidence = 1 }
  else if (explicitType(node.name)) { type = explicitType(node.name)!; confidence = 1 }
  else if (saved && (SECTION_TYPES as readonly string[]).includes(saved.sectionType)) { type = saved.sectionType as SectionType; confidence = 0.95 }
  else ({ type, confidence } = classify(node, index, frameWidth))
  const { settings, blocks } = extract(type, node, ctx, saved?.fieldMap ?? {}, frameWidth)
  void fileKey
  return { id: newId(), type, figmaNodeId: node.id, settings, blocks, responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: +confidence.toFixed(2) }
}

/** Keys compared between desktop and tablet/mobile sections to build responsive overrides. */
const RESPONSIVE_KEYS = ['title', 'subtitle', 'body', 'image', 'layout', 'imagePosition', 'align', 'columns', 'minHeight', 'paddingTop', 'paddingBottom', 'text', 'eyebrow', 'height']

export function mapPage(page: IRPage, fileKey: string, ctx: MappingContext, forcedTypes: Map<string, SectionType> = new Map()): MappedPage {
  const warnings: IRWarning[] = []
  const primary = page.frames.find((f) => f.device === 'desktop') ?? page.frames[0]
  const frameWidth = primary.root.width
  let sections: SectionInstance[]
  if (page.type === 'HEADER' || page.type === 'FOOTER') {
    const type = page.type === 'HEADER' ? 'header' : 'footer'
    const forced = forcedTypes.get(primary.root.id)
    sections = [mapNode(primary.root, 0, frameWidth, fileKey, ctx, forced ?? type)]
  } else {
    sections = sectionNodes(primary.root).map((n, i) => mapNode(n, i, frameWidth, fileKey, ctx, forcedTypes.get(n.id)))
  }

  // Page types that need a commerce section get one even if the design has no matching frame.
  const required: Partial<Record<string, SectionType>> = { PRODUCT_TEMPLATE: 'product-detail', CART: 'cart' }
  const need = required[page.type]
  if (need && !sections.some((s) => s.type === need)) {
    const idx = sections.findIndex((s) => s.mappingConfidence < 0.6)
    const section: SectionInstance = { id: newId(), type: need, figmaNodeId: null, settings: defaultSettings(need), blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 0.5 }
    if (idx >= 0) sections.splice(idx, 1, { ...section, figmaNodeId: sections[idx].figmaNodeId }); else sections.splice(Math.min(1, sections.length), 0, section)
  }
  if (page.type === 'COLLECTION_TEMPLATE') {
    const grid = sections.find((s) => s.type === 'product-grid')
    if (grid) grid.settings.source = 'current-collection'
    else sections.push({ id: newId(), type: 'product-grid', figmaNodeId: null, settings: { ...defaultSettings('product-grid'), source: 'current-collection', title: '' }, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 0.5 })
  }

  // Responsive overrides from paired frames, matched by position.
  for (const frame of page.frames.filter((f) => f !== primary)) {
    if (frame.device === 'desktop') continue
    const device = frame.device as 'tablet' | 'mobile'
    const nodes = page.type === 'HEADER' || page.type === 'FOOTER' ? [frame.root] : sectionNodes(frame.root)
    nodes.forEach((node, i) => {
      const target = sections.filter((s) => s.figmaNodeId)[i]
      if (!target) return
      const other = extract(target.type, node, ctx, {}, frame.root.width).settings
      const diff: Record<string, unknown> = {}
      for (const key of RESPONSIVE_KEYS) {
        if (key in target.settings && key in other && JSON.stringify(other[key]) !== JSON.stringify(target.settings[key]) && other[key] !== '' && other[key] !== null) diff[key] = other[key]
      }
      if (Object.keys(diff).length) target.responsive[device] = diff
    })
  }

  enforceHeadings(sections)
  for (const s of sections) if (s.type === 'freeform') warnings.push({ code: 'UNMAPPED_SECTION', nodeId: s.figmaNodeId ?? undefined, pageTitle: page.title, message: `A section of “${page.title}” didn't match a template and was kept as a freeform layout. Choose a section type in review, or name the frame “Section/<type>” in Figma.` })
  return { title: page.title, type: page.type, ...(page.slug ? { slug: page.slug } : {}), frames: page.frames.map((f) => ({ device: f.device, nodeId: f.nodeId })), sections, warnings }
}

/** First hero heading (else the first heading) is the page's h1; every other h1 becomes h2. */
export function enforceHeadings(sections: SectionInstance[]) {
  const withHeading = sections.filter((s) => !s.hidden && 'headingLevel' in s.settings && (s.settings.title || s.type === 'freeform' || s.blocks.length))
  const h1 = withHeading.find((s) => s.type === 'hero' && !s.overriddenFields.includes('headingLevel'))
    ?? withHeading.find((s) => s.overriddenFields.includes('headingLevel') && s.settings.headingLevel === 'h1')
    ?? withHeading.find((s) => s.type !== 'freeform')
  for (const s of withHeading) {
    if (s === h1) { if (!s.overriddenFields.includes('headingLevel')) s.settings.headingLevel = 'h1' }
    else if (s.settings.headingLevel === 'h1') s.settings.headingLevel = 'h2'
  }
}
