// Shopify-style editing of imported Figma (freeform) sections: splitting an exact page into one section per
// horizontal band of the design, and layer operations (hide, delete, duplicate, reorder, style) on the IR trees.
// Pure functions over section settings; used by the import mapping and the admin page editor.
import { reachableVariants, walkIR, type IRNode } from './design-ir'
import type { LayerStyle } from './sections/fields'
import { newId, type SectionInstance } from './sections/registry'

export type TreeKey = 'tree' | 'tablet' | 'mobile'
export type FreeformSettings = {
  tree: IRNode; trees?: { tablet?: IRNode; mobile?: IRNode }; variants?: Record<string, IRNode>; exact?: boolean; label?: string
  texts: Record<string, unknown>; images: Record<string, unknown>; links: Record<string, unknown>; styles?: Record<string, LayerStyle>; hiddenLayers?: string[]
  headingNodeId: string; headingLevel: string
}

const isTree = (t: unknown): t is IRNode => !!t && typeof t === 'object' && Array.isArray((t as IRNode).children)

/** The section's device designs, desktop first. */
export function layerTrees(s: FreeformSettings): [TreeKey, IRNode][] {
  return ([['tree', s.tree], ['tablet', s.trees?.tablet], ['mobile', s.trees?.mobile]] as [TreeKey, unknown][]).filter((t): t is [TreeKey, IRNode] => isTree(t[1]))
}

export type LayerLocation = { key: TreeKey; node: IRNode; parent: IRNode | null; index: number }
export function locateLayer(s: FreeformSettings, id: string): LayerLocation | null {
  for (const [key, tree] of layerTrees(s)) {
    let found: LayerLocation | null = null
    walkIR(tree, (n, parent) => { if (!found && n.id === id) found = { key, node: n, parent, index: parent ? parent.children.indexOf(n) : 0 } })
    if (found) return found
  }
  return null
}

/** Children can be reordered or duplicated only where Figma auto layout places them (no absolute positions). */
export const isFlow = (parent: IRNode | null, child?: IRNode) => !!parent?.layout && parent.layout.mode !== 'none' && !child?.absolute

/** Settings key a tree edit is recorded under (overriddenFields), so a Figma re-sync keeps it. */
export const treeField = (key: TreeKey) => (key === 'tree' ? 'tree' : 'trees')

function withTree(s: FreeformSettings, key: TreeKey, tree: IRNode): FreeformSettings {
  return key === 'tree' ? { ...s, tree } : { ...s, trees: { ...s.trees, [key]: tree } }
}

/** Copy of the tree with fn applied to the children array of the layer's parent. */
function editParent(s: FreeformSettings, id: string, fn: (children: IRNode[], index: number) => IRNode[]): FreeformSettings | null {
  const at = locateLayer(s, id)
  if (!at?.parent) return null
  const rebuild = (n: IRNode): IRNode => n === at.parent
    ? { ...n, children: fn([...n.children], at.index) }
    : n.children.some((c) => contains(c, at.parent!)) ? { ...n, children: n.children.map(rebuild) } : n
  const tree = layerTrees(s).find(([k]) => k === at.key)![1]
  return withTree(s, at.key, rebuild(tree))
}
const contains = (root: IRNode, target: IRNode) => { let hit = false; walkIR(root, (n) => { hit ||= n === target }); return hit }

const idsOf = (node: IRNode) => { const ids: string[] = []; walkIR(node, (n) => ids.push(n.id)); return ids }
const omit = <T>(map: Record<string, T> | undefined, ids: Set<string>) => Object.fromEntries(Object.entries(map ?? {}).filter(([k]) => !ids.has(k)))

export function deleteLayer(s: FreeformSettings, id: string): FreeformSettings | null {
  const at = locateLayer(s, id)
  if (!at?.parent) return null
  const gone = new Set(idsOf(at.node))
  const next = editParent(s, id, (children, i) => { children.splice(i, 1); return children })!
  return { ...next, texts: omit(s.texts, gone), images: omit(s.images, gone), links: omit(s.links, gone), styles: omit(s.styles, gone), hiddenLayers: (s.hiddenLayers ?? []).filter((x) => !gone.has(x)) }
}

/** Duplicate a layer (with its overrides) right after itself. Returns the settings and the copy's id. */
export function duplicateLayer(s: FreeformSettings, id: string): { settings: FreeformSettings; id: string } | null {
  const at = locateLayer(s, id)
  if (!at?.parent || !isFlow(at.parent, at.node)) return null
  const suffix = `~${newId().slice(0, 6)}`
  const ids = new Map<string, string>()
  const clone = (n: IRNode): IRNode => { const cid = `${n.id}${suffix}`.slice(-100); ids.set(n.id, cid); return { ...n, id: cid, children: n.children.map(clone) } }
  const copy = clone(at.node)
  const next = editParent(s, id, (children, i) => { children.splice(i + 1, 0, copy); return children })!
  const copyMap = <T>(map: Record<string, T> | undefined) => ({ ...map, ...Object.fromEntries([...ids].filter(([from]) => map && from in map).map(([from, to]) => [to, map![from]])) })
  const hidden = s.hiddenLayers ?? []
  return {
    id: copy.id,
    settings: { ...next, texts: copyMap(s.texts), images: copyMap(s.images), links: copyMap(s.links), styles: copyMap(s.styles), hiddenLayers: [...hidden, ...[...ids].filter(([from]) => hidden.includes(from)).map(([, to]) => to)] },
  }
}

export function moveLayer(s: FreeformSettings, id: string, by: -1 | 1): FreeformSettings | null {
  const at = locateLayer(s, id)
  if (!at?.parent || !isFlow(at.parent, at.node)) return null
  const to = at.index + by
  if (to < 0 || to >= at.parent.children.length) return null
  return editParent(s, id, (children, i) => { const [x] = children.splice(i, 1); children.splice(to, 0, x); return children })
}

export function toggleLayer(s: FreeformSettings, id: string): FreeformSettings {
  const hidden = s.hiddenLayers ?? []
  return { ...s, hiddenLayers: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] }
}

export function setLayerStyle(s: FreeformSettings, id: string, key: keyof LayerStyle, value: unknown): FreeformSettings {
  const style: Record<string, unknown> = { ...s.styles?.[id] }
  if (value === undefined || value === null) delete style[key]; else style[key] = value
  const styles = { ...s.styles }
  if (Object.keys(style).length) styles[id] = style as LayerStyle; else delete styles[id]
  return { ...s, styles }
}

// ---------------------------------------------------------------- splitting
type Band = { start: number; end: number; children: IRNode[] }

/**
 * Horizontal bands of a page frame: top-level layers whose vertical extents overlap stay together, so every band
 * renders exactly as it did inside the whole frame. Null when the frame can't be split without changing its look
 * (a scrolling prototype viewport, an image/gradient background spanning the page, row or mixed layouts).
 */
export function pageBands(root: IRNode): Band[] | null {
  if (root.scroll || root.fills.some((f) => f.type !== 'solid')) return null
  const mode = root.layout?.mode ?? 'none'
  if (mode === 'column') {
    if (root.children.some((c) => c.absolute)) return null
    return root.children.map((c) => ({ start: 0, end: 0, children: [c] }))
  }
  if (mode !== 'none') return null
  const fixed = root.children.filter((c) => c.position === 'fixed')
  const flowing = root.children.filter((c) => c.position !== 'fixed').sort((a, b) => a.y - b.y)
  const bands: Band[] = []
  for (const c of flowing) {
    const last = bands.at(-1)
    if (last && c.y < last.end) { last.end = Math.max(last.end, c.y + c.height); last.children.push(c) }
    else bands.push({ start: c.y, end: c.y + c.height, children: [c] })
  }
  if (!bands.length) return null
  // Each band runs to the start of the next, so the space between designs is kept; the first starts at the top.
  bands.forEach((b, i) => { b.start = i === 0 ? 0 : b.start; b.end = i === bands.length - 1 ? Math.max(b.end, root.height) : bands[i + 1].start })
  bands[0].children.unshift(...fixed)
  // Children keep their order in the frame (z-order).
  for (const b of bands) b.children.sort((a, z) => root.children.indexOf(a) - root.children.indexOf(z))
  return bands
}

function bandRoot(root: IRNode, band: Band, i: number, count: number): IRNode {
  const id = `${root.id}~s${i}`
  if (root.layout?.mode === 'column') {
    const [top, right, bottom, left] = root.layout.padding
    const child = band.children[0]
    return { ...root, id, name: child.name, heightMode: 'hug', height: child.height, layout: { ...root.layout, padding: [i === 0 ? top : root.layout.gap, right, i === count - 1 ? bottom : 0, left] }, children: [child] }
  }
  return {
    ...root, id, name: band.children.find((c) => c.position !== 'fixed')?.name ?? root.name, height: band.end - band.start,
    children: band.children.map((c) => (c.position === 'fixed' ? c : { ...c, y: c.y - band.start })),
  }
}

export type SplitResult = { ok: true; sections: SectionInstance[] } | { ok: false; reason: string }

/**
 * One freeform section per band of the design. Tablet and mobile designs are split the same way and paired by
 * position, so they need the same number of bands. Overrides follow the layers they belong to.
 */
export function splitFreeformSection(section: SectionInstance): SplitResult {
  if (section.type !== 'freeform') return { ok: false, reason: 'Only Figma sections can be split.' }
  const s = section.settings as unknown as FreeformSettings
  const trees = layerTrees(s)
  if (!trees.length) return { ok: false, reason: 'This section has no Figma layout.' }
  const split = trees.map(([key, tree]) => [key, tree, pageBands(tree)] as const)
  const blocked = split.find(([, , bands]) => !bands)
  if (blocked) return { ok: false, reason: `The ${blocked[0] === 'tree' ? 'desktop' : blocked[0]} design can't be split: it scrolls inside a fixed frame, has a full-page image background, or isn't laid out top to bottom.` }
  const count = split[0][2]!.length
  if (count < 2) return { ok: false, reason: 'The design has only one part: its layers overlap from top to bottom.' }
  if (split.some(([, , bands]) => bands!.length !== count)) return { ok: false, reason: `The device designs have different numbers of parts (${split.map(([k, , b]) => `${k === 'tree' ? 'desktop' : k} ${b!.length}`).join(', ')}).` }

  const allVariants = s.variants ?? {}
  return {
    ok: true,
    sections: Array.from({ length: count }, (_, i) => {
      const roots = split.map(([key, tree, bands]) => [key, bandRoot(tree, bands![i], i, count)] as const)
      const tree = roots[0][1]
      const deviceTrees = Object.fromEntries(roots.slice(1))
      const variants = reachableVariants(roots.map(([, r]) => r), allVariants)
      const ids = new Set<string>()
      for (const r of [...roots.map(([, r]) => r), ...Object.values(variants)]) walkIR(r, (n) => ids.add(n.id))
      const pick = <T>(map: Record<string, T> | undefined) => Object.fromEntries(Object.entries(map ?? {}).filter(([k]) => ids.has(k)))
      const ownsHeading = ids.has(s.headingNodeId)
      const settings: FreeformSettings = {
        ...s, tree, trees: deviceTrees, variants, label: tree.name,
        texts: pick(s.texts), images: pick(s.images), links: pick(s.links), styles: pick(s.styles), hiddenLayers: (s.hiddenLayers ?? []).filter((x) => ids.has(x)),
        headingNodeId: ownsHeading ? s.headingNodeId : '', headingLevel: ownsHeading ? s.headingLevel : 'h2',
      }
      const firstFigmaId = split[0][2]![i].children.find((c) => c.position !== 'fixed')?.id ?? tree.id
      return { ...section, id: newId(), figmaNodeId: section.figmaNodeId ? firstFigmaId : null, settings: settings as unknown as Record<string, unknown> }
    }),
  }
}
