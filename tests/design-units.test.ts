// Unit tests: design tokens, rich-text markup, registry validation, pre-publish checklist, preview tokens, SVG sanitizing and content sniffing.
import { describe, expect, test } from 'bun:test'
import { sanitizeSvg, sniff } from '../src/backend/lib/design-import/assets'
import { signPreviewToken, verifyPreviewToken } from '../src/backend/lib/preview-token'
import { fromMarkup, toMarkup } from '../src/shared/sections/markup'
import { SECTIONS, SECTION_TYPES, defaultSettings, validateSection, type SectionInstance } from '../src/shared/sections/registry'
import { prePublishChecklist } from '../src/shared/store-pages'
import { contrastIssues, contrastRatio, designTokensSchema, EMPTY_TOKENS, hexToRgb, tokensCss } from '../src/shared/design-tokens'

process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long'
const section = (over: Partial<SectionInstance> & { type: SectionInstance['type'] }): SectionInstance => ({ id: Math.random().toString(36).slice(2, 10), figmaNodeId: null, settings: defaultSettings(over.type), blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1, ...over })

describe('design tokens', () => {
  test('contrast is checked (WCAG AA)', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0)
    expect(contrastRatio(hexToRgb('#000000'), hexToRgb('#ffffff'))).toBeCloseTo(21, 0)
    expect(contrastIssues({ ...EMPTY_TOKENS, colors: [{ name: 'Text', value: '#cccccc', source: 'observed', usage: 1 }, { name: 'Background', value: '#ffffff', source: 'observed', usage: 1 }] })).toHaveLength(1)
  })
  test('CSS variables are generated and values are validated', () => {
    const tokens = { ...EMPTY_TOKENS, colors: [{ name: 'Brand/Primary', value: '#0d6b8c', source: 'style' as const, usage: 1 }] }
    expect(designTokensSchema.safeParse(tokens).success).toBe(true)
    expect(tokensCss(tokens)).toContain('--color-brand-primary:#0d6b8c')
    expect(designTokensSchema.safeParse({ ...tokens, colors: [{ name: 'x', value: 'red;}body{display:none' }] }).success).toBe(false)
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
