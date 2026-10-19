// Scroll stories: prototype screens linked by arrow-key navigation become one page that smart-animates between
// them on scroll; videos on Figma layers and the hero.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildIR, framePages, type RawSnapshot } from '../src/backend/lib/design-import/pipeline'
import { mapPage } from '../src/backend/lib/design-import/mapping'
import { layerTrees, locateLayer, splitFreeformSection, treeField, type FreeformSettings } from '../src/shared/freeform-edit'
import { validateSection, type SectionInstance } from '../src/shared/sections/registry'
import Freeform from '../src/frontend/components/sections/freeform'
import Hero from '../src/frontend/components/sections/hero'
import { embedFor } from '../src/frontend/components/sections/video'

const box = (x: number, y: number, width: number, height: number) => ({ absoluteBoundingBox: { x, y, width, height } })
const key = (code: number, dest: string | null) => ({ trigger: { type: 'ON_KEY_DOWN', device: 'KEYBOARD', keyCodes: [code] }, actions: [{ type: 'NODE', navigation: 'NAVIGATE', destinationId: dest, transition: { type: 'SMART_ANIMATE', duration: 1.5, easing: { type: 'EASE_OUT' } } }] })
const screen = (id: string, x: number, title: string, interactions: unknown[]) => ({
  id, name: 'Home', type: 'FRAME', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], ...box(x, 0, 1280, 832),
  children: [
    { id: `${id}-h`, name: 'Hero', type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: `img-${id}`, scaleMode: 'FILL' }], ...box(x, 0, 1280, 832) },
    { id: `${id}-t`, name: 'Title', type: 'TEXT', characters: title, style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 40 }, fills: [], ...box(x + 40, 400, 600, 50), interactions },
  ],
})
// Screens 1→2 linked; 2's ↓ link has no destination (missed in Figma); 3 links back to 2 with ↑. About is separate.
const raw: RawSnapshot = {
  file: { name: 'Jouri', version: '1', lastModified: '' },
  nodes: {
    '1:1': { document: screen('1:1', 0, 'Welcome', [key(40, '1:2')]) as never },
    '1:2': { document: screen('1:2', 1400, 'Our story', [key(40, null), key(38, '1:1')]) as never },
    '1:3': { document: screen('1:3', 2800, 'Collections', [key(38, '1:2')]) as never },
    '1:9': { document: { ...screen('1:9', 4200, 'About', []), name: 'About' } as never },
  },
}
const plan = [
  { title: 'Home', type: 'HOME' as const, layout: 'exact' as const, frames: { desktop: '1:1' } },
  { title: 'Home', type: 'PAGE' as const, slug: 'home', layout: 'exact' as const, frames: { desktop: '1:2' } },
  { title: 'Home', type: 'PAGE' as const, slug: 'home-2', layout: 'exact' as const, frames: { desktop: '1:3' } },
  { title: 'About', type: 'PAGE' as const, slug: 'about', layout: 'exact' as const, frames: { desktop: '1:9' } },
]
const ir = buildIR(raw, plan, 'AbCdEfGhIj1234567890')

describe('scroll stories', () => {
  test('arrow-key linked screens with the same title become one page; a missed ↓ link is bridged', () => {
    expect(ir.pages.map((p) => p.title)).toEqual(['Home', 'About'])
    const home = ir.pages[0]
    expect(home.scenes!.map((f) => f.nodeId)).toEqual(['1:2', '1:3'])
    expect(home.frames[0].root.interactions).toEqual([expect.objectContaining({ trigger: 'scroll-down', to: '1:2', transition: expect.objectContaining({ type: 'smart', duration: 1500 }) })])
    expect(home.scenes![0].root.interactions!.map((i) => `${i.trigger}:${i.to}`)).toEqual(['scroll-down:1:3', 'scroll-up:1:1'])
    expect(home.scenes![1].root.interactions!.map((i) => `${i.trigger}:${i.to}`)).toEqual(['scroll-up:1:2'])
    expect(framePages(plan, ir.pages).get('1:3')).toBe('')
  })

  test('sections layout keeps screens as separate pages', () => {
    const doc = buildIR(raw, plan.map((p) => ({ ...p, layout: 'sections' as const })), 'AbCdEfGhIj1234567890')
    expect(doc.pages).toHaveLength(4)
  })

  const mapped = mapPage(ir.pages[0], 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: framePages(plan, ir.pages), variants: ir.variants })
  const section = mapped.sections[0]
  const s = section.settings as unknown as FreeformSettings

  test('maps to one exact section whose scenes are editable layer trees', () => {
    expect(mapped.sections).toHaveLength(1)
    expect(s.scenes).toEqual(['1:2', '1:3'])
    expect(validateSection(section).ok).toBe(true)
    expect(layerTrees(s).map(([k]) => k)).toEqual(['tree', 'scene:1:2', 'scene:1:3'])
    const at = locateLayer(s, '1:3-t')!
    expect(at.key).toBe('scene:1:3')
    expect(treeField(at.key)).toBe('variants')
    expect(splitFreeformSection(section).ok).toBe(false)
  })

  test('renders the first scene; the others are client states', () => {
    const html = renderToStaticMarkup(Freeform({ section, data: undefined, page: {} as never, priority: false }) as never)
    expect(html).toContain('Welcome')
    expect(html).not.toContain('Collections')
  })
})

describe('videos', () => {
  const base = (settings: Record<string, unknown>): SectionInstance => ({
    id: 's1', type: 'freeform', figmaNodeId: null, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1,
    settings: { tree: ir.pages[1].frames[0].root, trees: {}, variants: {}, exact: true, texts: {}, images: {}, links: {}, headingNodeId: '', headingLevel: 'h2', ...settings },
  })

  test('a video on a Figma layer plays muted on loop over the layer', () => {
    const section = base({ videos: { '1:9-h': { url: 'https://res.cloudinary.com/demo/video/upload/tenants/x/videos/abc.mp4', autoplay: true, loop: true, controls: false } } })
    expect(validateSection(section).ok).toBe(true)
    const html = renderToStaticMarkup(Freeform({ section, data: undefined, page: {} as never, priority: false }) as never)
    expect(html).toMatch(/<video[^>]*src="https:\/\/res\.cloudinary\.com\/demo\/video\/upload\/tenants\/x\/videos\/abc\.mp4"[^>]*autoPlay=""[^>]*loop=""/)
    expect(html).toMatch(/<video[^>]*muted=""/)
  })

  test('video URLs are validated; local uploads and embeds are recognised', () => {
    expect(validateSection(base({ videos: { a: { url: 'javascript:alert(1)' } } })).ok).toBe(false)
    expect(validateSection(base({ videos: { a: { url: 'http://insecure.example/a.mp4' } } })).ok).toBe(false)
    expect(embedFor('/api/design/storage/tenants/legacy/videos/abc.mp4')).toEqual({ kind: 'video', src: '/api/design/storage/tenants/legacy/videos/abc.mp4' })
    expect(embedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.kind).toBe('iframe')
    expect(embedFor('/etc/passwd')).toBeNull()
  })

  test('hero background video', () => {
    const hero: SectionInstance = { id: 'h1', type: 'hero', figmaNodeId: null, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1, settings: { title: 'Jouri', video: 'https://example.com/hero.mp4', layout: 'background', image: null } }
    const ok = validateSection(hero)
    expect(ok.ok).toBe(true)
    const html = renderToStaticMarkup(Hero({ section: ok.ok ? ok.section : hero, data: undefined, page: {} as never, priority: true }) as never)
    expect(html).toContain('src="https://example.com/hero.mp4"')
  })
})
