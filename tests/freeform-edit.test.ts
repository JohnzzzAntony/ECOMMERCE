// Shopify-style editing of imported Figma sections: splitting exact pages into sections, layer operations and
// per-layer overrides in the renderer.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IRNode } from '../src/shared/design-ir'
import { deleteLayer, duplicateLayer, layerName, locateLayer, moveLayer, pageBands, setLayerStyle, splitFreeformSection, toggleLayer, type FreeformSettings } from '../src/shared/freeform-edit'
import { validateSection, type SectionInstance } from '../src/shared/sections/registry'
import Freeform from '../src/frontend/components/sections/freeform'

const node = (id: string, p: Partial<IRNode> = {}): IRNode => ({
  id, name: id, kind: 'frame', width: 100, height: 50, x: 0, y: 0, widthMode: 'fixed', heightMode: 'fixed', absolute: true,
  fills: [], shadows: [], opacity: 1, clips: false, children: [], ...p,
})
const text = (id: string, value: string, p: Partial<IRNode> = {}) => node(id, {
  kind: 'text', text: { runs: [{ text: value, marks: {} }], style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, italic: false, lineHeight: null, letterSpacing: 0, align: 'left', textCase: 'none', color: null } }, ...p,
})

// Page frame (absolute layout): nav, a hero whose image overlaps its heading, and a footer.
const page = () => node('1:1', {
  name: 'Home', width: 1280, height: 1200, absolute: false, layout: undefined, fills: [{ type: 'solid', color: { r: 255, g: 255, b: 255, a: 1 } }],
  children: [
    node('1:2', { name: 'Nav', width: 1280, height: 80, y: 0, children: [text('1:3', 'Shop')] }),
    node('1:4', { name: 'Hero image', width: 1280, height: 500, y: 120 }),
    text('1:5', 'Big heading', { y: 300 }),
    node('1:6', {
      name: 'Cards', width: 1280, height: 200, y: 700, absolute: true,
      layout: { mode: 'row', gap: 24, padding: [10, 20, 10, 20], justify: 'start', align: 'start', wrap: false },
      children: [text('1:7', 'One', { absolute: false }), text('1:8', 'Two', { absolute: false })],
    }),
    node('1:9', { name: 'Footer', width: 1280, height: 100, y: 1100, position: 'fixed' }),
  ],
})

const section = (tree: IRNode, extra: Record<string, unknown> = {}): SectionInstance => ({
  id: 's1', type: 'freeform', figmaNodeId: tree.id, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1,
  settings: { tree, trees: {}, variants: {}, exact: true, texts: {}, images: {}, links: {}, headingNodeId: '1:5', headingLevel: 'h1', ...extra },
})

describe('splitting an exact page', () => {
  test('bands group vertically overlapping layers; fixed layers go with the first band', () => {
    const bands = pageBands(page())!
    expect(bands.map((b) => b.children.map((c) => c.id))).toEqual([['1:2', '1:9'], ['1:4', '1:5'], ['1:6']])
    expect(bands.map((b) => [b.start, b.end])).toEqual([[0, 120], [120, 700], [700, 1200]])
  })

  test('one valid section per band, layers rebased, overrides and heading follow their layers', () => {
    const r = splitFreeformSection(section(page(), { texts: { '1:3': [{ type: 'p', runs: [{ text: 'Store' }] }], '1:7': [{ type: 'p', runs: [{ text: 'Uno' }] }] } }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.sections).toHaveLength(3)
    const [nav, hero, cards] = r.sections.map((s) => s.settings as unknown as FreeformSettings)
    expect(r.sections.map((s) => s.figmaNodeId)).toEqual(['1:2', '1:4', '1:6'])
    expect(nav.tree.height).toBe(120)
    expect(hero.tree.children.find((c) => c.id === '1:5')!.y).toBe(180)
    expect(cards.tree.children[0].y).toBe(0)
    expect(Object.keys(nav.texts)).toEqual(['1:3'])
    expect(Object.keys(cards.texts)).toEqual(['1:7'])
    expect([nav.headingNodeId, hero.headingNodeId, hero.headingLevel, cards.headingLevel]).toEqual(['', '1:5', 'h1', 'h2'])
    expect(nav.label).toBe('Nav')
    for (const s of r.sections) expect(validateSection(s).ok).toBe(true)
  })

  test('refuses designs that would change look, or device designs that do not pair up', () => {
    expect(splitFreeformSection(section({ ...page(), scroll: 'vertical' })).ok).toBe(false)
    const mobile = node('2:1', { width: 390, height: 900, absolute: false, children: [node('2:2', { y: 0 }), node('2:3', { y: 10 })] })
    const r = splitFreeformSection(section(page(), { trees: { mobile } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('mobile 1')
  })
})

describe('layer operations', () => {
  const base = () => section(page()).settings as unknown as FreeformSettings

  test('duplicate and reorder only inside auto layout; copies keep overrides', () => {
    const s = { ...base(), texts: { '1:7': [{ type: 'p', runs: [{ text: 'Uno' }] }] } } as FreeformSettings
    expect(duplicateLayer(s, '1:4')).toBeNull() // absolute layer
    const d = duplicateLayer(s, '1:7')!
    const cards = locateLayer(d.settings, '1:6')!.node
    expect(cards.children.map((c) => c.id)).toEqual(['1:7', d.id, '1:8'])
    expect(d.settings.texts[d.id]).toEqual(s.texts['1:7'])
    const moved = moveLayer(s, '1:8', -1)!
    expect(locateLayer(moved, '1:6')!.node.children.map((c) => c.id)).toEqual(['1:8', '1:7'])
    expect(moveLayer(s, '1:7', -1)).toBeNull()
    expect(locateLayer(s, '1:6')!.node.children.map((c) => c.id)).toEqual(['1:7', '1:8']) // original untouched
  })

  test('delete drops the layer and its overrides; hide and style toggle', () => {
    let s = { ...base(), texts: { '1:3': [] }, styles: { '1:3': { fontSize: 20 } } } as FreeformSettings
    s = deleteLayer(s, '1:2')!
    expect(locateLayer(s, '1:3')).toBeNull()
    expect(s.texts).toEqual({}); expect(s.styles).toEqual({})
    expect(toggleLayer(toggleLayer(s, '1:4'), '1:4').hiddenLayers).toEqual([])
    const styled = setLayerStyle(s, '1:5', 'fontSize', 40)
    expect(styled.styles).toEqual({ '1:5': { fontSize: 40 } })
    expect(setLayerStyle(styled, '1:5', 'fontSize', undefined).styles).toEqual({})
  })
})

test('renderer applies hidden layers and style overrides, and marks layers only when editing', () => {
  const s = section(page(), {
    exact: false, hiddenLayers: ['1:4'],
    styles: { '1:5': { fontSize: 40, textColor: { value: '#ff0000' }, fontWeight: 700 }, '1:6': { gap: 8, background: { value: '#00ff00' } } },
  })
  expect(validateSection(s).ok).toBe(true)
  const html = renderToStaticMarkup(Freeform({ section: s, data: undefined, page: {} as never, priority: false }) as never)
  expect(html).not.toContain('Hero image')
  expect(html).toMatch(/font-size:40px[^"]*font-weight:700|font-weight:700[^"]*font-size:40px/)
  expect(html).toContain('color:#ff0000')
  expect(html).toMatch(/gap:8px/)
  expect(html).toContain('background-color:#00ff00')
  expect(html).not.toContain('data-nid')
  const editing = renderToStaticMarkup(Freeform({ section: s, data: undefined, page: {} as never, priority: false, editing: true }) as never)
  expect(editing).toContain('data-nid="1:5"')
  expect(editing).toContain('data-kind="text"')
})

test('invalid style overrides are rejected', () => {
  expect(validateSection(section(page(), { styles: { '1:5': { fontSize: 9999 } } })).ok).toBe(false)
  expect(validateSection(section(page(), { styles: { '1:5': { color: 'red; background:url(x)' } } })).ok).toBe(false)
  expect(validateSection(section(page(), { styles: { '1:5': { textColor: { value: 'red' } } } })).ok).toBe(false)
})

test('layers get names a shop owner recognises', () => {
  expect(layerName(text('9:1', 'Shop the collection'))).toBe('Shop the collection')
  expect(layerName(node('9:2', { name: 'Hero banner' }))).toBe('Hero banner')
  expect(layerName(node('9:3', { name: 'Frame 18', children: [text('9:4', 'Finest Ingredients')] }))).toBe('Finest Ingredients')
  expect(layerName(node('9:5', { name: 'Isolation_Mode', kind: 'vector' }))).toBe('Icon')
  expect(layerName(node('9:6', { name: 'Group 4' }))).toBe('Group')
})
