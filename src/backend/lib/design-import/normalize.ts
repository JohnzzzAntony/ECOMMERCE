// Figma node JSON → IR (src/shared/design-ir.ts). Pure: no I/O.
// Field names follow https://developers.figma.com/docs/rest-api/file-node-types/ and /file-property-types/.
import type {
  IRColor, IRInteraction, IRLayout, IRLink, IRNode, IRPaint, IRShadow, IRTextMarks, IRTextRun, IRTextStyle, IRTransition, IRWarning, SizeMode,
} from '@/shared/design-ir'

export type FigmaNode = Record<string, any> & { id: string; name: string; type: string; children?: FigmaNode[] }
export type StyleMap = Record<string, { name: string; styleType?: string }>
export type ComponentMap = Record<string, { name: string; componentSetId?: string }>
export type NormalizeContext = {
  styles: StyleMap
  components: ComponentMap
  componentSets: Record<string, { name: string }>
  warnings: IRWarning[]
  fonts: Map<string, { weights: Set<number>; italic: boolean }>
}

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'REGULAR_POLYGON'])
const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'])

const color = (c: any, opacity = 1): IRColor => ({ r: Math.round((c?.r ?? 0) * 255), g: Math.round((c?.g ?? 0) * 255), b: Math.round((c?.b ?? 0) * 255), a: +((c?.a ?? 1) * opacity).toFixed(3) })

const SCALE: Record<string, 'cover' | 'contain' | 'tile' | 'stretch'> = { FILL: 'cover', FIT: 'contain', TILE: 'tile', STRETCH: 'stretch', CROP: 'cover' }

function paints(list: any[] | undefined, styleName?: string): IRPaint[] {
  const out: IRPaint[] = []
  for (const p of list ?? []) {
    if (p?.visible === false) continue
    const opacity = p.opacity ?? 1
    if (p.type === 'SOLID') out.push({ type: 'solid', color: color(p.color, opacity), ...(styleName ? { styleName } : {}) })
    else if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL' || p.type === 'GRADIENT_DIAMOND' || p.type === 'GRADIENT_ANGULAR') {
      const stops = (p.gradientStops ?? []).map((s: any) => ({ color: color(s.color, opacity), position: +(s.position ?? 0).toFixed(4) }))
      if (p.type === 'GRADIENT_LINEAR') {
        const [h0, h1] = p.gradientHandlePositions ?? [{ x: 0, y: 0 }, { x: 0, y: 1 }]
        const angle = Math.round((Math.atan2(h1.y - h0.y, h1.x - h0.x) * 180) / Math.PI + 90)
        out.push({ type: 'linear-gradient', angle: ((angle % 360) + 360) % 360, stops })
      } else out.push({ type: 'radial-gradient', stops })
    } else if (p.type === 'IMAGE' && p.imageRef) out.push({ type: 'image', imageRef: p.imageRef, scaleMode: SCALE[p.scaleMode] ?? 'cover' })
  }
  return out
}

function shadows(effects: any[] | undefined): { shadows: IRShadow[]; blur?: IRNode['blur'] } {
  const out: IRShadow[] = []
  let blur: IRNode['blur']
  for (const e of effects ?? []) {
    if (e?.visible === false) continue
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      out.push({ inset: e.type === 'INNER_SHADOW', x: e.offset?.x ?? 0, y: e.offset?.y ?? 0, blur: e.radius ?? 0, spread: e.spread ?? 0, color: color(e.color) })
    } else if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
      // Progressive blur (startRadius → radius across the layer) is approximated by its average.
      const radius = e.blurType === 'PROGRESSIVE' && typeof e.startRadius === 'number' ? (e.startRadius + (e.radius ?? 0)) / 2 : e.radius ?? 0
      blur = { type: e.type === 'LAYER_BLUR' ? 'layer' : 'background', radius }
    }
  }
  return { shadows: out, ...(blur ? { blur } : {}) }
}

const JUSTIFY: Record<string, IRLayout['justify']> = { MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'space-between' }
const ALIGN: Record<string, IRLayout['align']> = { MIN: 'start', CENTER: 'center', MAX: 'end', BASELINE: 'baseline' }

function layout(n: FigmaNode): IRLayout {
  const mode = n.layoutMode === 'HORIZONTAL' ? 'row' : n.layoutMode === 'VERTICAL' ? 'column' : 'none'
  const grid = (n.layoutGrids ?? []).find((g: any) => g?.pattern === 'COLUMNS' && g.visible !== false)
  return {
    mode,
    gap: n.itemSpacing ?? 0,
    padding: [n.paddingTop ?? 0, n.paddingRight ?? 0, n.paddingBottom ?? 0, n.paddingLeft ?? 0],
    justify: JUSTIFY[n.primaryAxisAlignItems] ?? 'start',
    align: ALIGN[n.counterAxisAlignItems] ?? 'start',
    wrap: n.layoutWrap === 'WRAP',
    ...(grid ? { grid: { columns: grid.count ?? 12, gutter: grid.gutterSize ?? 0, margin: grid.offset ?? 0 } } : {}),
  }
}

function sizeMode(n: FigmaNode, axis: 'Horizontal' | 'Vertical', parent: FigmaNode | null): SizeMode {
  const explicit = n[`layoutSizing${axis}`]
  if (explicit === 'FILL') return 'fill'
  if (explicit === 'HUG') return 'hug'
  if (explicit === 'FIXED') return 'fixed'
  // Older files: layoutGrow fills the parent's primary axis; layoutAlign STRETCH fills the counter axis.
  const primary = parent?.layoutMode === 'HORIZONTAL' ? 'Horizontal' : parent?.layoutMode === 'VERTICAL' ? 'Vertical' : null
  if (primary === axis && n.layoutGrow === 1) return 'fill'
  if (primary && primary !== axis && n.layoutAlign === 'STRETCH') return 'fill'
  return 'fixed'
}

function radius(n: FigmaNode): IRNode['radius'] {
  if (Array.isArray(n.rectangleCornerRadii)) return n.rectangleCornerRadii.slice(0, 4) as [number, number, number, number]
  if (n.cornerRadius) return [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius]
  return undefined
}

function link(action: any): IRLink | undefined {
  if (!action) return undefined
  if (action.type === 'URL' && typeof action.url === 'string') return { kind: 'url', url: action.url, newTab: action.openInNewTab === true }
  if (action.type === 'NODE' && action.destinationId && (action.navigation ?? 'NAVIGATE') === 'NAVIGATE') return { kind: 'node', nodeId: action.destinationId }
  return undefined
}

function nodeLink(n: FigmaNode): IRLink | undefined {
  for (const interaction of n.interactions ?? []) {
    if (interaction?.trigger && interaction.trigger.type !== 'ON_CLICK' && interaction.trigger.type !== 'ON_PRESS') continue
    for (const action of interaction?.actions ?? []) { const l = link(action); if (l) return l }
  }
  if (n.transitionNodeID) return { kind: 'node', nodeId: n.transitionNodeID }
  return undefined
}

// ---------------------------------------------------------------- prototype motion
// Easing presets: https://developers.figma.com/docs/plugins/api/Transition/ (cubic-bezier values and spring presets).
const CUBIC: Record<string, [number, number, number, number]> = {
  EASE_IN: [0.42, 0, 1, 1], EASE_OUT: [0, 0, 0.58, 1], EASE_IN_AND_OUT: [0.42, 0, 0.58, 1],
  EASE_IN_BACK: [0.3, -0.05, 0.7, -0.5], EASE_OUT_BACK: [0.45, 1.45, 0.8, 1], EASE_IN_AND_OUT_BACK: [0.7, -0.4, 0.4, 1.4],
}
const SPRINGS: Record<string, { mass: number; stiffness: number; damping: number }> = {
  GENTLE: { mass: 1, stiffness: 100, damping: 15 }, QUICK: { mass: 1, stiffness: 300, damping: 20 },
  BOUNCY: { mass: 1, stiffness: 600, damping: 15 }, SLOW: { mass: 1, stiffness: 80, damping: 20 },
}
const r3 = (v: number) => +v.toFixed(3)

/** A damped spring from 0 to 1 sampled over `durationMs` into a CSS linear() easing. */
export function springEasing({ mass, stiffness, damping }: { mass: number; stiffness: number; damping: number }, durationMs: number) {
  const steps = 40, dt = durationMs / 1000 / steps / 20
  let x = 0, v = 0
  const points = ['0']
  for (let i = 1; i <= steps; i++) {
    for (let j = 0; j < 20; j++) { const a = (-stiffness * (x - 1) - damping * v) / Math.max(mass, 0.01); v += a * dt; x += v * dt }
    points.push(String(i === steps ? 1 : r3(x)))
  }
  return `linear(${points.join(', ')})`
}

export function easing(e: any, durationMs: number): string {
  const type = e?.type ?? 'LINEAR'
  if (type === 'LINEAR') return 'linear'
  if (type === 'CUSTOM_CUBIC_BEZIER' && e.easingFunctionCubicBezier) {
    const b = e.easingFunctionCubicBezier
    return `cubic-bezier(${[b.x1, b.y1, b.x2, b.y2].map((v: unknown) => r3(Number(v) || 0)).join(', ')})`
  }
  if (CUBIC[type]) return `cubic-bezier(${CUBIC[type].join(', ')})`
  const spring = type === 'CUSTOM_SPRING' ? e.easingFunctionSpring : SPRINGS[type]
  if (spring) return springEasing({ mass: Number(spring.mass) || 1, stiffness: Number(spring.stiffness) || 100, damping: Number(spring.damping) || 10 }, durationMs)
  return 'ease'
}

function transition(t: any): IRTransition {
  if (!t) return { type: 'instant', duration: 0, easing: 'linear' }
  const duration = Math.min(20_000, Math.max(0, Math.round((Number(t.duration) || 0) * 1000)))
  const type = t.type === 'SMART_ANIMATE' ? 'smart' : duration ? 'dissolve' : 'instant'
  return { type, duration, easing: easing(t.easing, duration) }
}

const TRIGGERS: Record<string, IRInteraction['trigger']> = {
  ON_HOVER: 'hover', ON_CLICK: 'click', ON_PRESS: 'press', ON_DRAG: 'drag', MOUSE_ENTER: 'mouse-enter', MOUSE_LEAVE: 'mouse-leave', AFTER_TIMEOUT: 'timeout',
}

/** "Change to" interactions (variant swaps): hover states, drag/click carousels, timed loops. */
function interactions(n: FigmaNode): IRInteraction[] {
  const out: IRInteraction[] = []
  for (const i of n.interactions ?? []) {
    const trigger = TRIGGERS[i?.trigger?.type]
    if (!trigger) continue
    for (const a of i.actions ?? []) {
      if (a?.type !== 'NODE' || a.navigation !== 'CHANGE_TO' || typeof a.destinationId !== 'string') continue
      out.push({ trigger, delay: Math.round((Number(i.trigger.timeout) || 0) * 1000), to: a.destinationId, transition: transition(a.transition) })
    }
  }
  return out
}

/** Destination node ids of "Change to" interactions anywhere in a raw Figma subtree. */
export function changeTargets(n: FigmaNode, out = new Set<string>()): Set<string> {
  for (const i of n.interactions ?? []) for (const a of i?.actions ?? []) if (a?.type === 'NODE' && a.navigation === 'CHANGE_TO' && typeof a.destinationId === 'string') out.add(a.destinationId)
  for (const c of n.children ?? []) changeTargets(c, out)
  return out
}

const SCROLL: Record<string, IRNode['scroll']> = { HORIZONTAL_SCROLLING: 'horizontal', VERTICAL_SCROLLING: 'vertical', BOTH_SCROLLING: 'both' }

function hyperlink(h: any): IRLink | undefined {
  if (h?.type === 'URL' && h.url) return { kind: 'url', url: h.url, newTab: false }
  if (h?.type === 'NODE' && h.nodeID) return { kind: 'node', nodeId: h.nodeID }
  return undefined
}

const ALIGN_TEXT: Record<string, IRTextStyle['align']> = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }
const CASE: Record<string, IRTextStyle['textCase']> = { UPPER: 'upper', LOWER: 'lower', TITLE: 'title' }

function textStyle(s: any, fills: any[] | undefined, styleName?: string): IRTextStyle {
  const solid = paints(fills).find((p) => p.type === 'solid') as Extract<IRPaint, { type: 'solid' }> | undefined
  return {
    fontFamily: s?.fontFamily ?? 'Inter',
    fontWeight: s?.fontWeight ?? 400,
    fontSize: s?.fontSize ?? 16,
    italic: !!s?.italic,
    lineHeight: s?.lineHeightUnit === 'INTRINSIC_%' || s?.lineHeightPx == null ? null : +s.lineHeightPx.toFixed(2),
    letterSpacing: +(s?.letterSpacing ?? 0).toFixed(2),
    align: ALIGN_TEXT[s?.textAlignHorizontal] ?? 'left',
    textCase: CASE[s?.textCase] ?? 'none',
    color: solid?.color ?? null,
    ...(styleName ? { styleName } : {}),
  }
}

function addFont(ctx: NormalizeContext, family: string, weight: number, italic: boolean) {
  const f = ctx.fonts.get(family) ?? { weights: new Set<number>(), italic: false }
  f.weights.add(weight); f.italic ||= italic
  ctx.fonts.set(family, f)
}

/** characters + characterStyleOverrides/styleOverrideTable → runs with marks relative to the base style. */
export function textRuns(n: FigmaNode, base: IRTextStyle, ctx: NormalizeContext): IRTextRun[] {
  const chars: string = n.characters ?? ''
  const overrides: number[] = n.characterStyleOverrides ?? []
  const table: Record<string, any> = n.styleOverrideTable ?? {}
  const baseLink = hyperlink(n.style?.hyperlink)
  const baseDecoration = n.style?.textDecoration
  const runs: IRTextRun[] = []
  let start = 0
  for (let i = 1; i <= chars.length; i++) {
    if (i < chars.length && (overrides[i] ?? 0) === (overrides[start] ?? 0)) continue
    const o = table[String(overrides[start] ?? 0)] ?? {}
    const weight = o.fontWeight ?? base.fontWeight
    const italic = o.italic ?? base.italic
    const decoration = o.textDecoration ?? baseDecoration
    if (o.fontFamily || o.fontWeight || o.italic !== undefined) addFont(ctx, o.fontFamily ?? base.fontFamily, weight, italic)
    const marks: IRTextMarks = {}
    if (weight >= 600 && base.fontWeight < 600) marks.bold = true
    if (italic && !base.italic) marks.italic = true
    if (decoration === 'UNDERLINE') marks.underline = true
    if (decoration === 'STRIKETHROUGH') marks.strike = true
    const l = hyperlink(o.hyperlink) ?? baseLink
    if (l) marks.link = l
    const fill = o.fills ? paints(o.fills).find((p) => p.type === 'solid') as Extract<IRPaint, { type: 'solid' }> | undefined : undefined
    if (fill && JSON.stringify(fill.color) !== JSON.stringify(base.color)) marks.color = fill.color
    const text = chars.slice(start, i)
    const prev = runs[runs.length - 1]
    if (prev && JSON.stringify(prev.marks) === JSON.stringify(marks)) prev.text += text
    else runs.push({ text, marks })
    start = i
  }
  return runs.length ? runs : [{ text: '', marks: {} }]
}

const styleName = (n: FigmaNode, kind: 'fill' | 'text' | 'effect', ctx: NormalizeContext) => {
  const id = n.styles?.[kind] ?? n.styles?.[`${kind}s`]
  return id ? ctx.styles[id]?.name : undefined
}

function componentInfo(n: FigmaNode, ctx: NormalizeContext): IRNode['component'] {
  const comp = n.componentId ? ctx.components[n.componentId] : undefined
  const set = comp?.componentSetId ? ctx.componentSets[comp.componentSetId] : undefined
  const variant: Record<string, string> = {}
  for (const [key, prop] of Object.entries<any>(n.componentProperties ?? {})) {
    if (prop?.type === 'VARIANT') variant[key.replace(/#.*$/, '')] = String(prop.value)
  }
  const name = set?.name ?? comp?.name ?? n.name
  const overrides = (n.overrides ?? []).filter((o: any) => typeof o?.id === 'string' && (o.overriddenFields ?? []).some((f: string) => f === 'characters' || f === 'fills')).map((o: any) => o.id as string)
  if (!comp && !set && !Object.keys(variant).length && !overrides.length) return undefined
  // "Button/Primary" or set "Button" with variant Type=Primary → <Button variant="primary">.
  const segments = name.split('/').map((s: string) => s.trim())
  let primitive: NonNullable<IRNode['component']>['primitive']
  if (/^(button|btn|cta)$/i.test(segments[0])) {
    const v = variant.Variant ?? variant.Type ?? variant.Style ?? variant.Kind ?? segments[1] ?? comp?.name.split('/')[1] ?? 'primary'
    primitive = { type: 'button', variant: v.split('=').pop()!.trim().toLowerCase().replace(/\s+/g, '-') }
  }
  return { name, variant, ...(primitive ? { primitive } : {}), ...(overrides.length ? { overrides } : {}) }
}

/** A large frame with its own background or effects stays a frame (CSS fills, blur) even if its layers are vectors. */
const ownsBackground = (n: FigmaNode) => {
  const box = n.absoluteBoundingBox ?? { width: 0, height: 0 }
  const visible = (list: any[] | undefined) => (list ?? []).some((x: any) => x?.visible !== false)
  return (box.width > 160 || box.height > 160) && (visible(n.fills) || visible(n.effects))
}
const isVectorOnly = (n: FigmaNode): boolean =>
  VECTOR_TYPES.has(n.type) || (n.type === 'ELLIPSE' && !(n.fills ?? []).some((f: any) => f.type === 'IMAGE'))
  || ((n.type === 'GROUP' || n.type === 'FRAME' || n.type === 'INSTANCE' || n.type === 'COMPONENT') && !!n.children?.length && !ownsBackground(n) && n.children.every(isVectorOnly))

export function normalizeNode(n: FigmaNode, ctx: NormalizeContext, parent: FigmaNode | null = null, depth = 0): IRNode | null {
  if (n.visible === false) return null
  const box = n.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 }
  const pbox = parent?.absoluteBoundingBox ?? box
  const parentAuto = parent && (parent.layoutMode === 'HORIZONTAL' || parent.layoutMode === 'VERTICAL')
  const fillStyle = styleName(n, 'fill', ctx)
  const fx = shadows(n.effects)
  const imageFill = (n.fills ?? []).find((f: any) => f?.type === 'IMAGE' && f.visible !== false)
  const strokePaint = paints(n.strokes).find((p) => p.type === 'solid') as Extract<IRPaint, { type: 'solid' }> | undefined

  const base: IRNode = {
    id: n.id, name: n.name, kind: 'frame',
    width: Math.round(box.width ?? 0), height: Math.round(box.height ?? 0),
    x: Math.round((box.x ?? 0) - (pbox.x ?? 0)), y: Math.round((box.y ?? 0) - (pbox.y ?? 0)),
    widthMode: sizeMode(n, 'Horizontal', parent), heightMode: sizeMode(n, 'Vertical', parent),
    absolute: !!parent && (!parentAuto || n.layoutPositioning === 'ABSOLUTE'),
    fills: n.type === 'TEXT' ? [] : paints(n.fills, fillStyle),
    ...(strokePaint && (n.strokeWeight ?? 0) > 0 ? { stroke: { width: n.strokeWeight, color: strokePaint.color, align: (String(n.strokeAlign ?? 'INSIDE').toLowerCase() as 'inside'), dashed: !!n.strokeDashes?.length } } : {}),
    ...(radius(n) ? { radius: radius(n) } : {}),
    shadows: fx.shadows, ...(fx.blur ? { blur: fx.blur } : {}),
    opacity: n.opacity ?? 1,
    clips: !!n.clipsContent,
    children: [],
  }
  const l = nodeLink(n)
  if (l) base.link = l
  if (n.scrollBehavior === 'FIXED') base.position = 'fixed'
  else if (n.scrollBehavior === 'STICKY_SCROLLS') base.position = 'sticky'
  const motion = interactions(n)
  if (motion.length) base.interactions = motion

  if (n.type === 'TEXT') {
    const style = textStyle(n.style, n.fills, styleName(n, 'text', ctx))
    addFont(ctx, style.fontFamily, style.fontWeight, style.italic)
    return { ...base, kind: 'text', text: { runs: textRuns(n, style, ctx), style } }
  }
  if ((n.type === 'RECTANGLE' || n.type === 'ELLIPSE') && imageFill) {
    return { ...base, kind: 'image', fills: base.fills.filter((f) => f.type !== 'image'), image: { imageRef: imageFill.imageRef, scaleMode: SCALE[imageFill.scaleMode] ?? 'cover', alt: n.name } }
  }
  if (isVectorOnly(n) || (/\b(icon|logo)\b/i.test(n.name) && depth > 0 && box.width <= 160 && box.height <= 160 && !(n.children ?? []).some((c) => c.type === 'TEXT'))) {
    return { ...base, kind: 'vector', vector: {}, fills: [] }
  }
  if (!CONTAINER_TYPES.has(n.type) && n.type !== 'RECTANGLE' && n.type !== 'ELLIPSE') return null

  const node: IRNode = { ...base, layout: layout(n), ...(SCROLL[n.overflowDirection] ? { scroll: SCROLL[n.overflowDirection] } : {}) }
  if (n.type === 'INSTANCE') { const c = componentInfo(n, ctx); if (c) node.component = c }
  for (const child of n.children ?? []) {
    const c = normalizeNode(child, ctx, n, depth + 1)
    if (c) node.children.push(c)
  }
  if (depth <= 2 && node.layout!.mode === 'none' && node.children.length >= 2 && n.type !== 'GROUP') {
    ctx.warnings.push({ code: 'NO_AUTO_LAYOUT', nodeId: n.id, message: `“${n.name}” has no auto layout; its layout was converted with fixed positions and may not resize well.` })
  }
  return node
}

export function newContext(styles: StyleMap = {}, components: ComponentMap = {}, componentSets: Record<string, { name: string }> = {}): NormalizeContext {
  return { styles, components, componentSets, warnings: [], fonts: new Map() }
}
