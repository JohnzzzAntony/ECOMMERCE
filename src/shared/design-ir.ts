// Intermediate representation of imported Figma frames. Independent of Figma's raw schema: the import pipeline
// normalizes Figma nodes into this shape, and everything after (tokens, section mapping, the freeform section
// renderer) reads only this.

export type IRColor = { r: number; g: number; b: number; a: number } // r,g,b 0–255, a 0–1

export type IRPaint =
  | { type: 'solid'; color: IRColor; styleName?: string }
  | { type: 'linear-gradient'; angle: number; stops: { color: IRColor; position: number }[] }
  | { type: 'radial-gradient'; stops: { color: IRColor; position: number }[] }
  | { type: 'image'; imageRef: string; scaleMode: 'cover' | 'contain' | 'tile' | 'stretch'; assetUrl?: string }

export type IRShadow = { inset: boolean; x: number; y: number; blur: number; spread: number; color: IRColor }

export type IRLink = { kind: 'node'; nodeId: string } | { kind: 'url'; url: string; newTab: boolean }

export type IRTextMarks = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; link?: IRLink; color?: IRColor }
export type IRTextRun = { text: string; marks: IRTextMarks }

export type IRTextStyle = {
  fontFamily: string; fontWeight: number; fontSize: number; italic: boolean
  lineHeight: number | null // px; null = normal
  letterSpacing: number // px
  align: 'left' | 'center' | 'right' | 'justify'
  textCase: 'none' | 'upper' | 'lower' | 'title'
  color: IRColor | null
  styleName?: string
}

export type SizeMode = 'fixed' | 'fill' | 'hug'

export type IRLayout = {
  mode: 'row' | 'column' | 'none' // none = children positioned absolutely
  gap: number
  padding: [number, number, number, number] // top right bottom left
  justify: 'start' | 'center' | 'end' | 'space-between'
  align: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
  wrap: boolean
  grid?: { columns: number; gutter: number; margin: number }
}

export type IRNodeKind = 'frame' | 'text' | 'image' | 'vector'

/** Prototype transition. easing is a CSS easing (cubic-bezier()/linear(); springs are sampled). */
export type IRTransition = { type: 'smart' | 'dissolve' | 'instant'; duration: number; easing: string } // duration in ms
/**
 * Prototype interaction that swaps a component instance to another variant ("Change to"), e.g. hover states,
 * carousels (drag/click) and timed loops (after delay). `to` is the variant's node id in IRDocument.variants.
 */
export type IRInteraction = {
  /** scroll-down/up: a scroll story (frames linked by arrow-key navigation in the prototype), see IRPage.scenes. */
  trigger: 'hover' | 'click' | 'press' | 'drag' | 'mouse-enter' | 'mouse-leave' | 'timeout' | 'scroll-down' | 'scroll-up'
  delay: number // ms, for timeout
  to: string
  transition: IRTransition
}

export type IRNode = {
  id: string
  name: string
  kind: IRNodeKind
  width: number
  height: number
  x: number // relative to parent
  y: number
  widthMode: SizeMode
  heightMode: SizeMode
  absolute: boolean // positioned absolutely inside an auto-layout parent, or parent has no auto layout
  layout?: IRLayout
  fills: IRPaint[]
  stroke?: { width: number; color: IRColor; align: 'inside' | 'outside' | 'center'; dashed: boolean }
  radius?: [number, number, number, number]
  shadows: IRShadow[]
  blur?: { type: 'layer' | 'background'; radius: number }
  opacity: number
  clips: boolean
  text?: { runs: IRTextRun[]; style: IRTextStyle }
  image?: { imageRef: string; scaleMode: 'cover' | 'contain' | 'tile' | 'stretch'; assetUrl?: string; alt?: string }
  vector?: { assetUrl?: string } // exported as SVG by the asset stage
  /** overrides: ids of layers in this instance whose text or fills were overridden (kept when changing variant). */
  component?: { name: string; variant: Record<string, string>; primitive?: { type: 'button'; variant: string }; overrides?: string[] }
  link?: IRLink
  /** Figma overflow scrolling: the frame is a scroll viewport onto its (larger) content. */
  scroll?: 'horizontal' | 'vertical' | 'both'
  /** Figma "Fix position when scrolling" (fixed) or "Sticky". */
  position?: 'fixed' | 'sticky'
  interactions?: IRInteraction[]
  children: IRNode[]
}

export type IRWarningCode = 'NO_AUTO_LAYOUT' | 'MISSING_FONT' | 'MISSING_ALT' | 'LOW_CONTRAST' | 'MULTIPLE_H1' | 'UNMAPPED_SECTION' | 'ASSET_FAILED'
export type IRWarning = { code: IRWarningCode; nodeId?: string; pageTitle?: string; message: string }

export type IRFrame = { nodeId: string; name: string; device: 'desktop' | 'tablet' | 'mobile'; root: IRNode }
/** exact: the whole frame is kept as designed (one freeform section per page); sections: mapped to templates. */
export type PageLayout = 'exact' | 'sections'
/**
 * scenes: a scroll story. The prototype shows the desktop frame first, and scrolling down (arrow keys in Figma)
 * smart-animates to each following frame; the page renders them in place of one another (scroll-down/up
 * interactions on each scene root).
 */
export type IRPage = { title: string; type: string; slug?: string; layout?: PageLayout; frames: IRFrame[]; scenes?: IRFrame[] }
export type IRDocument = {
  fileKey: string; version: string; pages: IRPage[]; fonts: { family: string; weights: number[]; italic: boolean }[]; warnings: IRWarning[]
  /** Component variants that interactions change to, by node id. */
  variants?: Record<string, IRNode>
}

/** Section setting keys that hold IR trees (freeform): skipped by generic settings walkers, walked by asset code. */
export const IR_KEYS = new Set(['tree', 'trees', 'variants'])

export const cssColor = (c: IRColor) => (c.a >= 1 ? `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(3)})`)

export function walkIR(node: IRNode, visit: (n: IRNode, parent: IRNode | null) => void, parent: IRNode | null = null) {
  visit(node, parent)
  for (const child of node.children) walkIR(child, visit, node)
}

/** Variant ids reachable through interactions from the given nodes (following variants' own interactions). */
export function reachableVariants(roots: IRNode[], variants: Record<string, IRNode> | undefined): Record<string, IRNode> {
  const out: Record<string, IRNode> = {}
  if (!variants) return out
  const queue = [...roots]
  while (queue.length) {
    walkIR(queue.pop()!, (n) => {
      for (const i of n.interactions ?? []) if (!out[i.to] && variants[i.to]) { out[i.to] = variants[i.to]; queue.push(variants[i.to]) }
    })
  }
  return out
}

/** Layer path used to match layers between variants (Figma smart animate matches by name and hierarchy). */
export function childPaths(parentPath: string, children: IRNode[]): string[] {
  const seen = new Map<string, number>()
  return children.map((c) => { const i = seen.get(c.name) ?? 0; seen.set(c.name, i + 1); return `${parentPath}/${c.name}#${i}` })
}

/**
 * The instance switched to `variant`: the variant's layers and styles, the instance's placement, and the
 * instance's overridden text and images on layers with the same path (as Figma keeps overrides across variants).
 */
export function applyVariant(instance: IRNode, variant: IRNode): IRNode {
  const overridden = new Set(instance.component?.overrides ?? [])
  const own = new Map<string, IRNode>()
  const index = (n: IRNode, path: string) => { if (overridden.has(n.id)) own.set(path, n); childPaths(path, n.children).forEach((p, i) => index(n.children[i], p)) }
  index(instance, '')
  const merge = (v: IRNode, path: string): IRNode => {
    const o = own.get(path)
    const paths = childPaths(path, v.children)
    return {
      ...v,
      ...(o?.text && v.text ? { text: { ...v.text, runs: o.text.runs } } : {}),
      ...(o?.image && v.image ? { image: o.image } : {}),
      ...(o && o.fills.some((f) => f.type === 'image') ? { fills: o.fills } : {}),
      children: v.children.map((c, i) => merge(c, paths[i])),
    }
  }
  const merged = merge(variant, '')
  return {
    ...merged,
    x: instance.x, y: instance.y, width: instance.width, height: instance.height,
    widthMode: instance.widthMode, heightMode: instance.heightMode, absolute: instance.absolute,
    position: instance.position, link: instance.link ?? merged.link, component: instance.component,
  }
}

export function plainText(node: IRNode) {
  return node.text?.runs.map((r) => r.text).join('') ?? ''
}
