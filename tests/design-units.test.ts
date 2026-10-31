// Unit tests: IR normalizer, tokens/clustering, mapping heuristics, diff engine, rich-text markup, registry
// validation, pre-publish checklist, preview tokens, SVG sanitizing and content sniffing.
import { describe, expect, test } from 'bun:test'
import fixture from './__fixtures__/figma/nodes-store.json'
import { buildIR, framePages } from '../src/backend/lib/design-import/pipeline'
import { newContext, normalizeNode, type FigmaNode } from '../src/backend/lib/design-import/normalize'
import { COLOR_MERGE_DELTA_E, deltaE, extractTokens, fallbackStack, matchGoogleFont, snap } from '../src/backend/lib/design-import/tokens'
import { classify, explicitType, mapPage, enforceHeadings } from '../src/backend/lib/design-import/mapping'
import { applyDecisions, diffSections, diffTokens } from '../src/backend/lib/design-import/diff'
import { sanitizeSvg, sniff } from '../src/backend/lib/design-import/assets'
import { parseGoogleCss } from '../src/backend/lib/design-import/fonts'
import { signPreviewToken, verifyPreviewToken } from '../src/backend/lib/preview-token'
import { fromMarkup, toMarkup } from '../src/shared/sections/markup'
import { SECTIONS, SECTION_TYPES, defaultSettings, validateSection, type SectionInstance } from '../src/shared/sections/registry'
import { prePublishChecklist } from '../src/shared/store-pages'
import { contrastIssues, contrastRatio, designTokensSchema, EMPTY_TOKENS, hexToRgb, tokensCss } from '../src/shared/design-tokens'
import type { ImportPlan } from '../src/shared/design-plan'

process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long'

const raw = { file: { name: fixture.name, version: '42', lastModified: fixture.lastModified }, nodes: fixture.nodes as never }
const plan: ImportPlan['pages'] = [{ title: 'Home', type: 'HOME', frames: { desktop: '10:1', mobile: '10:2' } }]
const ir = buildIR(raw, plan, 'AbCdEfGhIj1234567890')
const home = ir.pages[0]
const desktop = home.frames.find((f) => f.device === 'desktop')!.root
const byId = (id: string) => { let hit: any; const walk = (n: any) => { if (n.id === id) hit = n; n.children?.forEach(walk) }; walk(desktop); return hit }

describe('IR normalizer', () => {
  test('auto layout → flex direction, gap, padding, alignment, sizing', () => {
    const hero = byId('12:1')
    expect(hero.layout).toMatchObject({ mode: 'column', gap: 24, padding: [120, 80, 120, 80], align: 'center' })
    expect(hero.fills[0]).toMatchObject({ type: 'image', imageRef: 'img-hero', scaleMode: 'cover' })
    expect(byId('11:1').widthMode).toBe('fill')
    expect(byId('11:1').fills[0]).toMatchObject({ type: 'solid', styleName: 'Brand/Primary' })
  })
  test('mixed text styles become marks; hyperlinks are kept', () => {
    const runs = byId('12:3').text.runs
    expect(runs.some((r: any) => r.marks.bold)).toBe(true)
    expect(runs.find((r: any) => r.marks.link)?.marks).toMatchObject({ underline: true, link: { kind: 'url', url: 'https://example.com/guide' } })
    expect(runs.map((r: any) => r.text).join('')).toBe('Hospital-grade equipment, delivered across the UAE. Read our guide.')
  })
  test('instances map to UI primitives; prototype links are captured', () => {
    const btn = byId('12:4')
    expect(btn.component).toMatchObject({ name: 'Button', variant: { Type: 'Primary' }, primitive: { type: 'button', variant: 'primary' } })
    expect(btn.link).toEqual({ kind: 'node', nodeId: '10:9' })
  })
  test('images, vectors, invisible nodes and frames without auto layout', () => {
    expect(byId('14:4')).toMatchObject({ kind: 'image', image: { imageRef: 'img-p1' } })
    expect(byId('13:5').kind).toBe('vector')
    expect(byId('16:2').absolute).toBe(true)
    expect(ir.warnings.some((w) => w.code === 'NO_AUTO_LAYOUT' && w.nodeId === '16:1' && w.pageTitle === 'Home')).toBe(true)
    const ctx = newContext()
    expect(normalizeNode({ id: '1:1', name: 'x', type: 'FRAME', visible: false } as FigmaNode, ctx)).toBeNull()
  })
  test('fonts used are collected with weights', () => {
    expect(ir.fonts.find((f) => f.family === 'Inter')?.weights).toEqual(expect.arrayContaining([400, 500, 600, 700]))
    expect(ir.fonts.map((f) => f.family)).toContain('Acme Sans')
  })
})

describe('design tokens', () => {
  const { tokens, warnings } = extractTokens(ir)
  test('named styles become tokens; observed values are clustered', () => {
    expect(tokens.colors.find((c) => c.name === 'Brand/Primary')).toMatchObject({ value: '#0d6b8c', source: 'style' })
    expect(tokens.typography.find((t) => t.name === 'Heading/H1')).toMatchObject({ family: 'Plus Jakarta Sans', size: 64, weight: 700 })
    expect(designTokensSchema.safeParse(tokens).success).toBe(true)
    expect(deltaE({ r: 13, g: 107, b: 140 }, { r: 14, g: 108, b: 141 })).toBeLessThan(COLOR_MERGE_DELTA_E)
    expect(deltaE({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 })).toBeGreaterThan(50)
    expect(snap([7, 8, 9, 23, 24, 0], 4, 12)).toEqual([8, 24])
    expect(tokens.breakpoints.desktop).toBe(1200)
  })
  test('fonts: Google matches self-host; unknown fonts are flagged with a fallback', () => {
    expect(matchGoogleFont('plus jakarta sans')?.family).toBe('Plus Jakarta Sans')
    expect(matchGoogleFont('Acme Sans')).toBeNull()
    expect(warnings.some((w) => w.code === 'MISSING_FONT' && w.message.includes('Acme Sans'))).toBe(true)
    expect(fallbackStack('Georgia Serif Display')).toContain('serif')
  })
  test('low contrast text is reported (WCAG AA)', () => {
    expect(warnings.some((w) => w.code === 'LOW_CONTRAST' && w.nodeId === '16:2')).toBe(true)
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0)
    expect(contrastIssues({ ...EMPTY_TOKENS, colors: [{ name: 'Text', value: '#cccccc', source: 'observed', usage: 1 }, { name: 'Background', value: '#ffffff', source: 'observed', usage: 1 }] })).toHaveLength(1)
  })
  test('page Background/Text roles come from the frame fill and stay readable', () => {
    const bg = tokens.colors.find((c) => c.name === 'Background')!, text = tokens.colors.find((c) => c.name === 'Text')
    expect(bg).toBeDefined()
    if (text) expect(contrastRatio(hexToRgb(bg.value), hexToRgb(text.value))).toBeGreaterThanOrEqual(4.5)
  })
  test('CSS variables are generated and values are validated', () => {
    const css = tokensCss(tokens)
    expect(css).toContain('--color-brand-primary:#0d6b8c')
    expect(css).toContain('--font-heading-h1-size:64px')
    expect(designTokensSchema.safeParse({ ...tokens, colors: [{ name: 'x', value: 'red;}body{display:none' }] }).success).toBe(false)
  })
  test('Google Fonts CSS parsing keeps subset, weight, style and unicode-range', () => {
    const css = "/* latin */\n@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; font-display: swap; src: url(https://fonts.gstatic.com/s/inter/v1/a.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131; }\n/* cyrillic */\n@font-face { font-family: 'Inter'; font-style: italic; font-weight: 700; src: url(https://fonts.gstatic.com/s/inter/v1/b.woff2) format('woff2'); }"
    expect(parseGoogleCss(css)).toEqual([
      { subset: 'latin', style: 'normal', weight: 400, url: 'https://fonts.gstatic.com/s/inter/v1/a.woff2', unicodeRange: 'U+0000-00FF, U+0131' },
      { subset: 'cyrillic', style: 'italic', weight: 700, url: 'https://fonts.gstatic.com/s/inter/v1/b.woff2', unicodeRange: undefined },
    ])
  })
})

describe('section mapping', () => {
  const mapped = mapPage(home, 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: framePages(plan) })
  const types = mapped.sections.map((s) => s.type)
  test('explicit names, keywords and heuristics pick section types', () => {
    expect(types.slice(0, 5)).toEqual(['announcement-bar', 'hero', 'feature-grid', 'product-grid', 'faq'])
    expect(mapped.sections[1].mappingConfidence).toBe(1) // Section/hero
    expect(explicitType('Section / products')).toBe('product-grid')
    expect(explicitType('Hero')).toBeNull()
  })
  test('hero fields: {{title}} layer, rich subtitle, image reference, CTA from the button instance', () => {
    const hero = mapped.sections[1].settings as any
    expect(hero.title).toBe('Care that moves with you')
    expect(hero.subtitle[0].runs.some((r: any) => r.bold)).toBe(true)
    expect(hero.subtitle[0].runs.find((r: any) => r.link)?.link).toEqual({ kind: 'url', url: 'https://example.com/guide', newTab: false })
    expect(hero.image.url).toBe('pending:img:img-hero')
    expect(hero.image.alt).toBe('') // structural layer name is not an alt text
    expect(hero.ctaLabel).toBe('Shop now')
    expect(hero.layout).toBe('background')
  })
  test('repeated items become blocks; commerce grids take products from the catalog', () => {
    const features = mapped.sections[2]
    expect(features.blocks.map((b) => (b.settings as any).title)).toEqual(['ISO certified', 'Same-day delivery', 'Expert support'])
    expect((features.blocks[0].settings as any).icon.url).toBe('pending:svg:13:5')
    expect((features.settings as any).columns).toBe(3)
    expect(mapped.sections[3].settings).toMatchObject({ source: 'best-sellers', limit: 2, columns: 2 })
    expect(mapped.sections[4].blocks.map((b) => (b.settings as any).question)).toEqual(['Do you deliver to Abu Dhabi?', 'Can I rent equipment?'])
  })
  test('mobile frame differences become responsive overrides', () => {
    expect(mapped.sections[1].responsive.mobile).toMatchObject({ title: 'Care that moves' })
  })
  test('one h1 per page: the hero title', () => {
    expect(mapped.sections.filter((s) => s.settings.headingLevel === 'h1').map((s) => s.type)).toEqual(['hero'])
    const s = mapped.sections.map((x) => structuredClone(x))
    s[2].settings.headingLevel = 'h1'
    enforceHeadings(s)
    expect(s.filter((x) => x.settings.headingLevel === 'h1')).toHaveLength(1)
  })
  test('saved mappings win over heuristics; unmatched layouts fall back to freeform', () => {
    const saved = mapPage(home, 'k', { saved: new Map([['15:1', { sectionType: 'rich-text', fieldMap: {} }]]), framePages: new Map() })
    expect(saved.sections[4]).toMatchObject({ type: 'rich-text', mappingConfidence: 0.95 })
    expect(classify({ id: 'x', name: 'Shapes', kind: 'frame', width: 400, height: 400, x: 0, y: 0, widthMode: 'fixed', heightMode: 'fixed', absolute: false, fills: [], shadows: [], opacity: 1, clips: false, children: [{ id: 'y', name: 'v', kind: 'vector', width: 50, height: 50, x: 0, y: 0, widthMode: 'fixed', heightMode: 'fixed', absolute: true, fills: [], shadows: [], opacity: 1, clips: false, children: [] }] }, 3, 1440)).toEqual({ type: 'freeform', confidence: 0 })
  })
  test('every mapped section validates against the registry once images resolve', () => {
    const resolved = JSON.parse(JSON.stringify(mapped.sections).replace(/"pending:[^"]+"/g, '"https://res.cloudinary.com/demo/image/upload/x.png"'))
    for (const s of resolved) expect(validateSection(s).ok).toBe(true)
  })
})

const section = (over: Partial<SectionInstance> & { type: SectionInstance['type'] }): SectionInstance => ({ id: Math.random().toString(36).slice(2, 10), figmaNodeId: null, settings: defaultSettings(over.type), blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1, ...over })

describe('re-sync diff', () => {
  const before = section({ type: 'hero', figmaNodeId: '1:1', settings: { ...defaultSettings('hero'), title: 'Admin title', eyebrow: 'Old' }, overriddenFields: ['title'] })
  const after = { ...before, settings: { ...before.settings, title: 'Figma title', eyebrow: 'New' }, overriddenFields: [] }
  const added = section({ type: 'rich-text', figmaNodeId: '2:2' })
  const manual = section({ type: 'faq' })
  const removed = section({ type: 'gallery', figmaNodeId: '3:3' })
  const changes = diffSections([before, manual, removed], [after, added])
  test('added / removed / changed by Figma node; admin-added sections are ignored', () => {
    expect(changes.map((c) => c.kind).sort()).toEqual(['added', 'changed', 'removed'])
    const changed = changes.find((c) => c.kind === 'changed')!
    expect(changed.kind === 'changed' && changed.fields).toEqual(expect.arrayContaining([{ field: 'title', overridden: true }, { field: 'eyebrow', overridden: false }]))
  })
  test('overridden fields keep the admin value unless explicitly accepted', () => {
    let out = applyDecisions([before, manual, removed], changes, { '1:1': { accept: true }, '2:2': { accept: true }, '3:3': { accept: false } })
    expect(out.find((s) => s.figmaNodeId === '1:1')!.settings).toMatchObject({ title: 'Admin title', eyebrow: 'New' })
    expect(out.map((s) => s.type)).toEqual(['hero', 'rich-text', 'faq', 'gallery'])
    out = applyDecisions([before, manual, removed], changes, { '1:1': { accept: true, acceptOverridden: ['title'] }, '3:3': { accept: true } })
    expect(out.find((s) => s.figmaNodeId === '1:1')!).toMatchObject({ settings: { title: 'Figma title' }, overriddenFields: [] })
    expect(out.some((s) => s.figmaNodeId === '3:3')).toBe(false)
    expect(applyDecisions([before], changes, {})).toEqual([before])
  })
  test('token diff', () => {
    const a = { ...EMPTY_TOKENS, colors: [{ name: 'Primary', value: '#000000', source: 'style' as const, usage: 1 }] }
    const b = { ...EMPTY_TOKENS, colors: [{ name: 'Primary', value: '#111111', source: 'style' as const, usage: 3 }], container: 1280 }
    expect(diffTokens(a, b).map((d) => d.name)).toEqual(['Primary', 'container'])
  })
})

describe('registry, markup and checklist', () => {
  test('every section type has valid defaults and rejects unsafe values', () => {
    for (const t of SECTION_TYPES) expect(validateSection(section({ type: t })).ok).toBe(true)
    expect(validateSection(section({ type: 'hero', settings: { ...defaultSettings('hero'), ctaLink: { kind: 'url', url: 'javascript:alert(1)' } } })).ok).toBe(false)
    expect(validateSection(section({ type: 'hero', settings: { ...defaultSettings('hero'), image: { url: 'http://x/y.png', alt: '', decorative: false, width: 1, height: 1 } } })).ok).toBe(false)
    expect(validateSection({ id: 'x', type: 'raw-html', settings: {} }).ok).toBe(false)
    expect(Object.keys(SECTIONS)).toHaveLength(22)
  })
  test('rich text markup round-trips without HTML', () => {
    const rt = fromMarkup('Hello **bold** and *it* with [a link](/pages/about)\n\n- one\n- two')
    expect(rt[0].runs).toEqual([{ text: 'Hello ' }, { text: 'bold', bold: true }, { text: ' and ' }, { text: 'it', italic: true }, { text: ' with ' }, { text: 'a link', link: { kind: 'page', slug: 'about' } }])
    expect(rt.slice(1).map((p) => p.type)).toEqual(['li', 'li'])
    expect(toMarkup(rt)).toBe('Hello **bold** and *it* with [a link](/pages/about)\n\n- one\n- two')
    expect(fromMarkup('[x](javascript:alert(1))')[0].runs[0]).toEqual({ text: 'x' })
    expect(fromMarkup('<script>alert(1)</script>')[0].runs[0].text).toBe('<script>alert(1)</script>') // stored as text, rendered escaped
  })
  test('pre-publish checklist blocks on alt text, multiple h1, empty and broken links', () => {
    const img = { url: 'https://res.cloudinary.com/x.png', alt: '', decorative: false, width: 10, height: 10 }
    const items = prePublishChecklist([
      section({ type: 'hero', settings: { ...defaultSettings('hero'), title: 'A', headingLevel: 'h1', image: img, ctaLabel: 'Buy', ctaLink: { kind: 'none' } } }),
      section({ type: 'rich-text', settings: { ...defaultSettings('rich-text'), title: 'B', headingLevel: 'h1', ctaLabel: 'More', ctaLink: { kind: 'page', slug: 'missing' } } }),
      section({ type: 'freeform', settings: { ...defaultSettings('freeform'), tree: null } }),
    ], new Set(['']), ['contrast'])
    expect(items.filter((i) => i.level === 'error').map((i) => i.code).sort()).toEqual(['BROKEN_LINK', 'EMPTY_LINK', 'MISSING_ALT', 'MULTIPLE_H1'])
    expect(items.filter((i) => i.level === 'warning').map((i) => i.code).sort()).toEqual(['FREEFORM', 'LOW_CONTRAST'])
    expect(prePublishChecklist([section({ type: 'hero', settings: { ...defaultSettings('hero'), image: { ...img, decorative: true } } })], new Set())).toEqual([])
  })
  test('links to draft pages warn once instead of blocking', () => {
    const link = { kind: 'page', slug: 'plp' }
    const items = prePublishChecklist([section({ type: 'rich-text', settings: { ...defaultSettings('rich-text'), ctaLabel: 'Go', ctaLink: link, secondaryLabel: 'Go', secondaryLink: link } })], new Set(['']), [], new Set(['plp']))
    expect(items.map((i) => [i.level, i.code])).toEqual([['warning', 'BROKEN_LINK']])
  })
  test('Figma sections with a mobile frame do not warn about small screens', () => {
    const ff = (trees: object) => section({ type: 'freeform', settings: { ...defaultSettings('freeform'), tree: null, trees } })
    expect(prePublishChecklist([ff({})], new Set()).map((i) => i.code)).toEqual(['FREEFORM'])
    expect(prePublishChecklist([ff({ mobile: { id: 'm' } })], new Set())).toEqual([])
  })
})

describe('security helpers', () => {
  test('preview tokens are bound to store, kind, id and expire', () => {
    const t = signPreviewToken({ storeId: 'a', kind: 'page', id: 'p1' })
    expect(verifyPreviewToken(t, { storeId: 'a', kind: 'page', id: 'p1' })).toBe(true)
    expect(verifyPreviewToken(t, { storeId: 'b', kind: 'page', id: 'p1' })).toBe(false)
    expect(verifyPreviewToken(t, { storeId: 'a', kind: 'import', id: 'p1' })).toBe(false)
    expect(verifyPreviewToken(t, { storeId: 'a', kind: 'page', id: 'p1' }, Date.now() + 16 * 60_000)).toBe(false)
    expect(verifyPreviewToken(`${t}x`, { storeId: 'a', kind: 'page', id: 'p1' })).toBe(false)
  })
  test('SVG sanitizing strips scripts, handlers, foreignObject and external references', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><rect width="1" height="1"/></a><image href="https://evil.test/x.png"/><use href="#a"/><path id="a" d="M0 0h1" style="fill:url(https://evil/x)"/></svg>')
    for (const bad of ['script', 'onload', 'foreignObject', 'javascript:', 'evil']) expect(out).not.toContain(bad)
    expect(() => sanitizeSvg('<html><script>1</script></html>')).toThrow()
  })
  test('content sniffing ignores names and headers', () => {
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniff(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml')
    expect(sniff(Buffer.from('<html><body>hi</body></html>'))).toBeNull()
  })
})
