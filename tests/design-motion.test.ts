// Prototype fidelity: Figma scrolling frames, fixed layers and "Change to" interactions (hover, timed loops) are
// normalized, kept by the exact page layout, carried through asset resolution and rendered.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildIR, pendingRefs, resolveRefs, type RawSnapshot } from '../src/backend/lib/design-import/pipeline'
import { easing, springEasing } from '../src/backend/lib/design-import/normalize'
import { mapPage } from '../src/backend/lib/design-import/mapping'
import { applyVariant, type IRNode } from '../src/shared/design-ir'
import { validateSection } from '../src/shared/sections/registry'
import Freeform from '../src/frontend/components/sections/freeform'

const box = (x: number, y: number, width: number, height: number) => ({ absoluteBoundingBox: { x, y, width, height } })
const text = (id: string, name: string, characters: string, x: number, y: number) => ({ id, name, type: 'TEXT', characters, style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 14 }, fills: [], ...box(x, y, 100, 20) })
const image = (id: string, x: number, y: number, ref: string) => ({ id, name: `Photo ${id}`, type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: ref, scaleMode: 'FILL' }], ...box(x, y, 300, 200) })

// Mobile page frame: a 390×844 scrolling viewport with a fixed header and bottom bar, a horizontal carousel,
// and a card instance whose hover state is a component variant.
const mobile = {
  id: '1:1', name: 'iPhone 13', type: 'FRAME', overflowDirection: 'VERTICAL_SCROLLING', clipsContent: true, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], ...box(0, 0, 390, 844),
  children: [
    { id: '1:2', name: 'Header', type: 'FRAME', scrollBehavior: 'FIXED', effects: [{ type: 'BACKGROUND_BLUR', radius: 8 }], fills: [], children: [text('1:3', 'Logo', 'Flower District', 16, 30)], ...box(0, 0, 390, 100) },
    { id: '1:4', name: 'Carousel', type: 'FRAME', overflowDirection: 'HORIZONTAL_SCROLLING', clipsContent: true, fills: [], ...box(0, 300, 390, 200), children: [image('1:5', 0, 300, 'img-a'), image('1:6', 310, 300, 'img-b'), image('1:7', 620, 300, 'img-c')] },
    {
      id: '1:8', name: 'Card', type: 'INSTANCE', componentId: '5:1', fills: [], ...box(20, 1500, 200, 100),
      overrides: [{ id: 'I1:8;5:2', overriddenFields: ['characters'] }],
      interactions: [{ trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', navigation: 'CHANGE_TO', destinationId: '5:5', transition: { type: 'SMART_ANIMATE', duration: 0.3, easing: { type: 'CUSTOM_SPRING', easingFunctionSpring: { mass: 1, stiffness: 9.87, damping: 6.28 } } } }] }],
      children: [text('I1:8;5:2', 'Label', 'Roses', 20, 1500)],
    },
    { id: '1:9', name: 'Bottom bar', type: 'GROUP', scrollBehavior: 'FIXED', ...box(0, 784, 390, 60), children: [text('1:10', 'Call', 'Call', 20, 800)] },
  ],
}
const desktop = { id: '2:1', name: 'Home', type: 'FRAME', fills: [], ...box(0, 0, 1280, 900), children: [text('2:2', 'Title', 'Beautiful flowers', 40, 40)] }
// Hover variant (outside the frames) with a timed loop back to the default variant.
const hoverVariant = {
  id: '5:5', name: 'State=Hover', type: 'COMPONENT', fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 0.2 } }], ...box(1000, 0, 200, 100),
  interactions: [{ trigger: { type: 'AFTER_TIMEOUT', timeout: 2 }, actions: [{ type: 'NODE', navigation: 'CHANGE_TO', destinationId: '5:1', transition: { type: 'DISSOLVE', duration: 0.2, easing: { type: 'EASE_OUT' } } }] }],
  children: [text('5:6', 'Label', 'Product name', 1010, 30)],
}
const defaultVariant = { id: '5:1', name: 'State=Default', type: 'COMPONENT', fills: [], ...box(1000, 200, 200, 100), children: [text('5:2', 'Label', 'Product name', 1010, 210)] }

const raw: RawSnapshot = {
  file: { name: 'Flowers', version: '1', lastModified: '2026-10-14T00:00:00Z' },
  nodes: { '1:1': { document: mobile as never }, '2:1': { document: desktop as never } },
  variants: { '5:5': { document: hoverVariant as never }, '5:1': { document: defaultVariant as never } },
}
const ir = buildIR(raw, [{ title: 'Home', type: 'HOME', layout: 'exact', frames: { desktop: '2:1', mobile: '1:1' } }], 'AbCdEfGhIj1234567890')
const root = ir.pages[0].frames.find((f) => f.device === 'mobile')!.root
const child = (id: string) => root.children.find((c) => c.id === id)!

describe('prototype normalization', () => {
  test('scrolling frames, fixed layers and background blur', () => {
    expect(root.scroll).toBe('vertical')
    expect(child('1:4').scroll).toBe('horizontal')
    expect(child('1:2')).toMatchObject({ position: 'fixed', blur: { type: 'background', radius: 8 } })
    expect(child('1:9').position).toBe('fixed')
  })
  test('"Change to" interactions with transition and easing; variants and their loops are normalized', () => {
    const [hover] = child('1:8').interactions!
    expect(hover).toMatchObject({ trigger: 'hover', to: '5:5', transition: { type: 'smart', duration: 300 } })
    expect(hover.transition.easing).toMatch(/^linear\(0, .*, 1\)$/)
    expect(child('1:8').component?.overrides).toEqual(['I1:8;5:2'])
    expect(ir.variants?.['5:5'].interactions?.[0]).toMatchObject({ trigger: 'timeout', delay: 2000, to: '5:1', transition: { type: 'dissolve', duration: 200, easing: 'cubic-bezier(0, 0, 0.58, 1)' } })
    expect(Object.keys(ir.variants ?? {}).sort()).toEqual(['5:1', '5:5'])
  })
  test('easings: presets, cubic-bezier and springs settle at 1', () => {
    expect(easing({ type: 'LINEAR' }, 300)).toBe('linear')
    expect(easing({ type: 'CUSTOM_CUBIC_BEZIER', easingFunctionCubicBezier: { x1: 0.1, y1: 0.2, x2: 0.3, y2: 1 } }, 300)).toBe('cubic-bezier(0.1, 0.2, 0.3, 1)')
    const points = springEasing({ mass: 1, stiffness: 600, damping: 15 }, 800).slice(7, -1).split(', ').map(Number)
    expect(points[0]).toBe(0); expect(points.at(-1)).toBe(1)
    expect(Math.max(...points)).toBeGreaterThan(1) // bouncy overshoots
  })
  test('a variant keeps the instance placement and its overridden text', () => {
    const v = applyVariant(child('1:8'), ir.variants!['5:5'])
    expect(v).toMatchObject({ x: 20, y: 1500, absolute: true })
    expect(v.children[0].text?.runs[0].text).toBe('Roses')
    expect(v.fills[0]).toMatchObject({ type: 'solid' })
  })
})

describe('exact page layout', () => {
  const page = mapPage(ir.pages[0], 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: new Map(), variants: ir.variants })
  const section = page.sections[0]
  test('one freeform section with the device designs and reachable variants', () => {
    expect(page.sections).toHaveLength(1)
    expect(section).toMatchObject({ type: 'freeform', mappingConfidence: 1, settings: { exact: true, headingLevel: 'h1' } })
    expect((section.settings.trees as Record<string, IRNode>).mobile.id).toBe('1:1')
    expect(Object.keys(section.settings.variants as object).sort()).toEqual(['5:1', '5:5'])
    expect(page.warnings.filter((w) => w.code === 'UNMAPPED_SECTION')).toHaveLength(0)
  })
  test('images in device designs are copied and resolved', () => {
    expect(pendingRefs([page])).toEqual(expect.arrayContaining(['img:img-a', 'img:img-b', 'img:img-c']))
    const [resolved] = resolveRefs([page], { 'img:img-a': { id: 'a1', url: 'https://res.cloudinary.com/demo/a.webp', width: 300, height: 200 } as never })
    const carousel = (resolved.sections[0].settings.trees as Record<string, IRNode>).mobile.children.find((c) => c.id === '1:4')!
    expect(carousel.children[0].image?.assetUrl).toBe('https://res.cloudinary.com/demo/a.webp')
    expect(validateSection(resolved.sections[0]).ok).toBe(true)
  })
  test('renders scaled device designs, scrolling frames, fixed bars and variant states', () => {
    const html = renderToStaticMarkup(Freeform({ section, data: undefined, page: {} as never, priority: false }) as never)
    expect(html).toContain('--u:min(calc(100cqw / 1280), 1px)')
    expect(html).toContain('--u:calc(100cqw / 390)')
    expect(html).toContain('data-figma-scroll="horizontal"')
    expect(html).toMatch(/overflow-x:auto/)
    expect(html).toMatch(/position:fixed[^"]*top:calc\(var\(--u\) \* 0\)/) // header at the top
    expect(html).toMatch(/position:fixed[^"]*bottom:calc\(var\(--u\) \* 0\)/) // bottom bar at the bottom
    expect(html).toMatch(/backdrop-filter:blur\(calc\(var\(--u\) \* 4\)\)/)
    expect(html).toContain('data-fl=""') // variant state root, matched for smart animate
    expect(html).toContain('Roses')
    expect(html).toMatch(/<h1[^>]*>.*Beautiful flowers/)
    expect(html).toMatch(/@media \(max-width:767px\)\{\[data-ff="[\w-]+"\]>\[data-dev="base"\]\{display:none\}\}/)
  })
})

test('exact pages resolve prototype destinations on every device into storefront links', () => {
  const source = structuredClone(ir.pages[0])
  for (const frame of source.frames) frame.root.children[0].link = { kind: 'node', nodeId: '99:1' }
  const mapped = mapPage(source, 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: new Map([['99:1', 'about']]), variants: ir.variants })
  const section = mapped.sections[0]
  for (const frame of source.frames) expect((section.settings.links as Record<string, unknown>)[frame.root.children[0].id]).toEqual({ kind: 'page', slug: 'about' })
  const html = renderToStaticMarkup(Freeform({ section, data: undefined, page: {} as never, priority: false }) as never)
  expect(html).toContain('href="/pages/about"')
})

test('explicitly selected hidden desktop frame remains paired with its mobile design', () => {
  const hidden = structuredClone(raw)
  hidden.nodes['2:1']!.document.visible = false
  const document = buildIR(hidden, [{ title: 'Home', type: 'HOME', layout: 'exact', frames: { desktop: '2:1', mobile: '1:1' } }], 'AbCdEfGhIj1234567890')
  expect(document.pages[0].frames.map((frame) => frame.device)).toEqual(['desktop', 'mobile'])
  const page = mapPage(document.pages[0], 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: new Map(), variants: document.variants })
  expect(page.sections).toHaveLength(1)
  expect((page.sections[0].settings.tree as IRNode).id).toBe('2:1')
  expect((page.sections[0].settings.trees as Record<string, IRNode>).mobile.id).toBe('1:1')
})
