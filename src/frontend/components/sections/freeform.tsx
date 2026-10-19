// Freeform section: renders the Figma layout (IR) as designed — auto layout becomes flexbox, other frames use
// absolute positions. Structure is fixed; text, images and links can be overridden per node in the editor.
// Exact pages (a whole Figma frame per device) also scale to the screen width like a Figma prototype, keep
// scrolling areas, fixed/sticky layers and prototype variant animations (freeform-client.tsx).
import type { CSSProperties, ReactNode } from 'react'
import { applyVariant, childPaths, cssColor, walkIR, type IRColor, type IRInteraction, type IRNode, type IRPaint } from '@/shared/design-ir'
import type { ColorValue, ImageValue, LayerStyle, LayerVideo, LinkValue, RichText } from '@/shared/sections/fields'
import { BackgroundVideo } from './video'
import { RichTextView, SectionShell, SmartImage, SmartLink, color, settingsOf, type SectionProps } from './shared'
import { FigmaScroll, FigmaVariants } from './freeform-client'

type Overrides = { texts: Record<string, RichText>; images: Record<string, ImageValue>; links: Record<string, LinkValue>; styles: Record<string, LayerStyle>; videos: Record<string, LayerVideo>; hidden: Set<string>; headingNodeId: string; headingLevel: string }
type Ctx = {
  o: Overrides
  heading: string
  variants: Record<string, IRNode>
  /** Exact page: lengths scale with --u (CSS px per Figma px) and fixed/sticky layers apply. */
  exact: boolean
  /** Width and visible height of the page frame, for fixed layers. */
  frame: { width: number; height: number | null }
  /** Admin preview: layers carry data-nid so they can be selected and edited in place. */
  editing: boolean
}

const SAFE_URL = /^(https:\/\/[^\s"'()<>]+|\/[^\s"'()<>]*)$/
const n = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const col = (c: IRColor | null | undefined) => (c ? cssColor({ r: n(c.r), g: n(c.g), b: n(c.b), a: n(c.a, 1) }) : undefined)
const r2 = (v: number) => +n(v).toFixed(2)
/** A Figma length: px, or scaled with the frame on exact pages. */
const len = (c: Ctx, v: number): string | number => (c.exact ? `calc(var(--u) * ${r2(v)})` : r2(v))
const lenPx = (c: Ctx, v: number) => (c.exact ? `calc(var(--u) * ${r2(v)})` : `${r2(v)}px`)

function background(fills: IRPaint[]): CSSProperties {
  const layers: string[] = []
  let size: string | undefined
  let color: string | undefined
  for (const p of [...fills].reverse()) {
    if (p.type === 'solid') color = col(p.color)
    else if (p.type === 'linear-gradient') layers.push(`linear-gradient(${n(p.angle)}deg, ${p.stops.map((s) => `${col(s.color)} ${n(s.position) * 100}%`).join(', ')})`)
    else if (p.type === 'radial-gradient') layers.push(`radial-gradient(${p.stops.map((s) => `${col(s.color)} ${n(s.position) * 100}%`).join(', ')})`)
    else if (p.type === 'image' && p.assetUrl && SAFE_URL.test(p.assetUrl)) { layers.push(`url("${p.assetUrl}")`); size = p.scaleMode === 'contain' ? 'contain' : p.scaleMode === 'tile' ? 'auto' : 'cover' }
  }
  return { ...(color ? { backgroundColor: color } : {}), ...(layers.length ? { backgroundImage: layers.join(', '), backgroundSize: size ?? 'cover', backgroundPosition: 'center' } : {}) }
}

/** Height of a frame's content: a scrolling frame is only a viewport onto its (taller) children. */
function contentHeight(node: IRNode) {
  const bottoms = node.children.filter((c) => c.absolute && c.position !== 'fixed').map((c) => c.y + c.height)
  return node.scroll === 'vertical' || node.scroll === 'both' ? Math.max(0, ...bottoms) : Math.max(node.height, 0)
}

function placeFixed(node: IRNode, c: Ctx, style: CSSProperties) {
  const { width, height } = c.frame
  style.position = 'fixed'
  style.zIndex = 40
  style.left = `calc(50% + var(--u) * ${r2(node.x - width / 2)})`
  style.width = len(c, node.width); style.height = len(c, node.height)
  // Layers in the lower half of the device frame stay at the bottom of the screen, others at the top.
  if (height && node.y + node.height / 2 > height / 2) style.bottom = len(c, Math.max(0, height - node.y - node.height))
  else style.top = len(c, Math.max(0, node.y))
}

function boxStyle(node: IRNode, parent: IRNode | null, root: boolean, c: Ctx): CSSProperties {
  const style: CSSProperties = { boxSizing: 'border-box', opacity: n(node.opacity, 1) < 1 ? n(node.opacity, 1) : undefined }
  const parentFlex = parent?.layout && parent.layout.mode !== 'none'
  const inScroll = !!parent?.scroll
  if (root) {
    style.width = c.exact ? len(c, node.width) : '100%'; style.maxWidth = c.exact ? undefined : n(node.width); style.marginInline = 'auto'; style.position = 'relative'
  } else if (c.exact && node.position === 'fixed') placeFixed(node, c, style)
  else if (node.absolute && parent) {
    style.position = c.exact && node.position === 'sticky' ? 'sticky' : 'absolute'
    style.left = len(c, node.x); style.top = len(c, node.y); style.width = len(c, node.width); style.height = len(c, node.height)
  } else {
    const mainIsWidth = parent?.layout?.mode !== 'column'
    if (node.widthMode === 'fill') { if (parentFlex && mainIsWidth) style.flex = '1 1 0'; else style.alignSelf = 'stretch'; style.minWidth = 0 }
    else if (node.widthMode === 'fixed') { style.width = len(c, node.width); if (!inScroll && !c.exact) style.maxWidth = '100%' }
    if (node.heightMode === 'fill') { if (parentFlex && !mainIsWidth) style.flex = '1 1 0'; else style.alignSelf = 'stretch' }
    else if (node.heightMode === 'fixed' && (node.kind !== 'frame' || node.layout?.mode === 'none')) style.height = len(c, node.height)
    else if (node.heightMode === 'fixed') style.minHeight = len(c, node.height)
    style.flexShrink = inScroll ? 0 : node.widthMode === 'fixed' ? 1 : undefined
    if (c.exact && node.position === 'sticky') { style.position = 'sticky'; style.top = 0; style.zIndex = 30 }
  }
  if (node.kind === 'frame') {
    Object.assign(style, background(node.fills))
    const l = node.layout
    if (l && l.mode !== 'none') {
      Object.assign(style, {
        display: 'flex', flexDirection: l.mode, flexWrap: l.wrap ? 'wrap' : 'nowrap', gap: len(c, n(l.gap)),
        padding: l.padding.map((p) => lenPx(c, n(p))).join(' '),
        justifyContent: { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' }[l.justify],
        alignItems: { start: 'flex-start', center: 'center', end: 'flex-end', baseline: 'baseline', stretch: 'stretch' }[l.align],
      })
    } else if (!node.absolute || root) {
      if (!style.position) style.position = 'relative'
      if (root && c.exact) style.height = len(c, contentHeight(node))
      else if (node.children.some((ch) => ch.absolute)) style.minHeight = len(c, node.height)
    }
    if (!style.position && node.scroll) style.position = 'relative' // containing block for absolutely placed content
    if (node.scroll && !root) {
      // A Figma scrolling frame: the content scrolls inside it (touch, wheel, trackpad; mouse drag via FigmaScroll).
      style.overflowX = node.scroll === 'vertical' ? 'hidden' : 'auto'
      style.overflowY = node.scroll === 'horizontal' ? 'hidden' : 'auto'
      Object.assign(style, { scrollbarWidth: 'none', overscrollBehaviorX: 'contain' })
    } else if (node.clips) style.overflow = root && node.scroll ? undefined : 'hidden'
    if (root && node.clips) style.overflowX = 'clip'
  }
  if (node.stroke) style.border = `${lenPx(c, n(node.stroke.width))} ${node.stroke.dashed ? 'dashed' : 'solid'} ${col(node.stroke.color)}`
  if (node.radius) style.borderRadius = node.radius.map((r) => lenPx(c, n(r))).join(' ')
  if (node.shadows?.length) style.boxShadow = node.shadows.map((s) => `${s.inset ? 'inset ' : ''}${lenPx(c, n(s.x))} ${lenPx(c, n(s.y))} ${lenPx(c, n(s.blur))} ${lenPx(c, n(s.spread))} ${col(s.color)}`).join(', ')
  if (node.blur) {
    const blur = `blur(${lenPx(c, n(node.blur.radius) / 2)})` // Figma's blur radius is about twice CSS blur()
    if (node.blur.type === 'layer') style.filter = blur; else { style.backdropFilter = blur; (style as Record<string, unknown>).WebkitBackdropFilter = blur }
  }
  return style
}

const FAMILY = /^[A-Za-z0-9 _-]{1,60}$/

function textStyle(node: IRNode, c: Ctx): CSSProperties {
  const t = node.text!.style
  return {
    margin: 0,
    fontFamily: FAMILY.test(t.fontFamily) ? `"${t.fontFamily}", var(--font-body-family, system-ui), sans-serif` : undefined,
    fontSize: len(c, n(t.fontSize, 16)), fontWeight: n(t.fontWeight, 400), fontStyle: t.italic ? 'italic' : undefined,
    lineHeight: t.lineHeight ? lenPx(c, n(t.lineHeight)) : 'normal', letterSpacing: n(t.letterSpacing) ? lenPx(c, n(t.letterSpacing)) : undefined,
    color: col(t.color), textAlign: t.align,
    textTransform: t.textCase === 'upper' ? 'uppercase' : t.textCase === 'lower' ? 'lowercase' : t.textCase === 'title' ? 'capitalize' : undefined,
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
  }
}

/** The admin's per-layer style overrides on top of the Figma styles. */
function layerStyle(node: IRNode, c: Ctx): CSSProperties {
  const o = c.o.styles[node.id]
  if (!o) return {}
  const style: CSSProperties = {}
  const bg = color(o.background as ColorValue)
  if (bg) style.backgroundColor = bg
  if (typeof o.radius === 'number') style.borderRadius = lenPx(c, o.radius)
  if (typeof o.opacity === 'number') style.opacity = n(o.opacity) / 100
  if (node.layout && node.layout.mode !== 'none') {
    if (typeof o.gap === 'number') style.gap = len(c, o.gap)
    if (typeof o.paddingY === 'number') { style.paddingTop = lenPx(c, o.paddingY); style.paddingBottom = lenPx(c, o.paddingY) }
    if (typeof o.paddingX === 'number') { style.paddingLeft = lenPx(c, o.paddingX); style.paddingRight = lenPx(c, o.paddingX) }
  }
  if (node.kind === 'text') {
    const fg = color(o.textColor as ColorValue)
    if (fg) style.color = fg
    if (typeof o.fontSize === 'number') style.fontSize = len(c, o.fontSize)
    if (typeof o.fontWeight === 'number') style.fontWeight = o.fontWeight
    if (o.align) style.textAlign = o.align
  }
  return style
}

function irRuns(node: IRNode): RichText {
  return [{ type: 'p', runs: node.text!.runs.map((r) => ({ text: r.text, ...(r.marks.bold ? { bold: true } : {}), ...(r.marks.italic ? { italic: true } : {}), ...(r.marks.underline ? { underline: true } : {}), ...(r.marks.link?.kind === 'url' && /^https?:\/\//.test(r.marks.link.url) ? { link: { kind: 'url' as const, url: r.marks.link.url, newTab: r.marks.link.newTab } } : {}) })) }]
}

/** Variant ids an instance can change to: its own interactions, then those of the variants it reaches. */
function instanceStates(node: IRNode, variants: Record<string, IRNode>) {
  const ids: string[] = []
  const queue = [...(node.interactions ?? [])]
  while (queue.length) {
    const i = queue.shift()!
    if (ids.includes(i.to) || !variants[i.to]) continue
    ids.push(i.to); queue.push(...(variants[i.to].interactions ?? []))
  }
  return ids
}

type NodeProps = { node: IRNode; parent: IRNode | null; c: Ctx; root?: boolean; fl?: string; stateRoot?: boolean }

function Node({ node, parent, c, root = false, fl, stateRoot = false }: NodeProps): ReactNode {
  if (!root && c.o.hidden.has(node.id)) return null
  const states = !stateRoot && node.interactions?.length ? instanceStates(node, c.variants) : []
  if (states.length) {
    // Prototype "Change to" interactions: every reachable variant is rendered on the server; the client swaps them.
    const rendered: Record<string, ReactNode> = { '@': <Node node={node} parent={parent} c={c} root={root} fl="" stateRoot /> }
    const interactions: Record<string, IRInteraction[]> = { '@': node.interactions ?? [] }
    for (const id of states) {
      rendered[id] = <Node node={applyVariant(node, c.variants[id])} parent={parent} c={c} root={root} fl="" stateRoot />
      interactions[id] = c.variants[id].interactions ?? []
    }
    return <FigmaVariants states={rendered} interactions={interactions} />
  }

  const style = { ...boxStyle(node, parent, root, c), ...(node.kind === 'text' ? {} : layerStyle(node, c)) }
  const attrs = { style, ...(fl !== undefined ? { 'data-fl': fl } : {}), ...(c.editing ? { 'data-nid': node.id, 'data-kind': node.kind } : {}) }
  let content: ReactNode
  if (node.kind === 'text') {
    const Tag = (node.id === c.heading && ['h1', 'h2', 'h3', 'h4'].includes(c.o.headingLevel) ? c.o.headingLevel : 'div') as 'div'
    content = <Tag {...attrs} style={{ ...style, ...textStyle(node, c), ...layerStyle(node, c) }}><RichTextView value={c.o.texts[node.id] ?? irRuns(node)} className="space-y-0 [&>p]:m-0" /></Tag>
  } else if (c.o.videos[node.id]) {
    // A video set on an image or frame layer plays over its Figma fill, cropped to the layer like a fill.
    const v = c.o.videos[node.id]
    const override = c.o.images[node.id]
    const poster = override?.url ?? (node.kind === 'image' ? node.image?.assetUrl : undefined) ?? node.fills.find((f) => f.type === 'image')?.assetUrl
    content = (
      <div {...attrs} style={{ ...style, overflow: 'hidden', ...(style.position ? {} : { position: 'relative' }) }}>
        <BackgroundVideo url={v.url} poster={v.poster ?? (poster && SAFE_URL.test(poster) ? poster : undefined)} autoplay={v.autoplay} loop={v.loop} controls={v.controls} label={node.name} />
        {node.kind === 'frame' && node.children.map((ch) => <Node key={ch.id} node={ch} parent={node} c={c} fl={fl !== undefined ? childPaths(fl, node.children)[node.children.indexOf(ch)] : undefined} />)}
      </div>
    )
  } else if (node.kind === 'image' || node.kind === 'vector') {
    const override = c.o.images[node.id]
    const url = override?.url ?? (node.kind === 'image' ? node.image?.assetUrl : node.vector?.assetUrl)
    content = url && SAFE_URL.test(url) ? (
      <div {...attrs} style={{ ...style, ...(node.kind === 'image' ? { overflow: 'hidden' } : {}) }}>
        <SmartImage image={override ?? { url, alt: node.kind === 'image' ? node.image?.alt ?? '' : '', decorative: node.kind === 'vector', width: Math.max(1, n(node.width, 1)), height: Math.max(1, n(node.height, 1)) }} sizes={`${Math.max(1, n(node.width, 100))}px`}
          className={node.kind === 'image' ? `h-full w-full ${node.image?.scaleMode === 'contain' ? 'object-contain' : 'object-cover'}` : 'h-full w-full'} />
      </div>
    ) : <div {...attrs} aria-hidden />
  } else {
    const paths = fl !== undefined ? childPaths(fl, node.children) : []
    content = (
      <div {...attrs} {...(node.scroll && !root ? { 'data-figma-scroll': node.scroll } : {})}>
        {node.children.map((ch, i) => <Node key={ch.id} node={ch} parent={node} c={c} fl={fl !== undefined ? paths[i] : undefined} />)}
      </div>
    )
  }
  const link = c.o.links[node.id] ?? (node.link?.kind === 'url' && /^(https?:|mailto:|tel:)/.test(node.link.url) ? { kind: 'url' as const, url: node.link.url, newTab: node.link.newTab } : undefined)
  return link && link.kind !== 'none' ? <SmartLink link={link} className="contents">{content}</SmartLink> : content
}

function largestText(tree: IRNode) {
  let best: IRNode | null = null
  walkIR(tree, (x) => { if (x.kind === 'text' && (!best || n(x.text?.style.fontSize) > n(best.text?.style.fontSize))) best = x })
  return (best as IRNode | null)?.id ?? ''
}

const hasScroll = (tree: IRNode) => { let found = false; walkIR(tree, (x) => { found ||= !!x.scroll && x !== tree }); return found }

type Settings = Omit<Overrides, 'hidden'> & { hiddenLayers?: string[]; tree: IRNode | null; trees?: { tablet?: IRNode; mobile?: IRNode }; variants?: Record<string, IRNode>; exact?: boolean }
const isTree = (t: unknown): t is IRNode => !!t && typeof t === 'object' && Array.isArray((t as IRNode).children)

export default function Freeform({ section, editing = false }: SectionProps) {
  const s = settingsOf<Settings>(section)
  if (!isTree(s.tree)) return null
  const o: Overrides = { texts: s.texts ?? {}, images: s.images ?? {}, links: s.links ?? {}, styles: s.styles ?? {}, videos: s.videos ?? {}, hidden: new Set(Array.isArray(s.hiddenLayers) ? s.hiddenLayers : []), headingNodeId: s.headingNodeId, headingLevel: s.headingLevel }
  const variants = s.variants && typeof s.variants === 'object' ? s.variants : {}
  const exact = s.exact === true
  const ctxFor = (tree: IRNode): Ctx => {
    let hasHeading = false
    walkIR(tree, (x) => { hasHeading ||= x.id === o.headingNodeId })
    return { o, variants, exact, editing, heading: hasHeading ? o.headingNodeId : largestText(tree), frame: { width: tree.width, height: tree.scroll ? tree.height : null } }
  }
  const scroll = [s.tree, s.trees?.tablet, s.trees?.mobile].some((t) => isTree(t) && hasScroll(t))

  if (!exact) {
    return (
      <SectionShell section={section} className="overflow-x-clip">
        <Node node={s.tree} parent={null} c={ctxFor(s.tree)} root />
        {scroll && <FigmaScroll />}
      </SectionShell>
    )
  }

  // Exact page: one design per device range, each scaled to the screen width (the base design never above 100%).
  const mobile = isTree(s.trees?.mobile) ? s.trees!.mobile! : null
  const tablet = isTree(s.trees?.tablet) ? s.trees!.tablet! : null
  const tabletMax = mobile ? '(min-width:768px) and (max-width:1199px)' : '(max-width:1199px)'
  const sid = section.id.replace(/[^\w-]/g, '')
  const css = [
    mobile ? `@media (max-width:767px){[data-ff="${sid}"]>[data-dev="base"]{display:none}}@media (min-width:768px){[data-ff="${sid}"]>[data-dev="mobile"]{display:none}}` : '',
    tablet ? `@media ${tabletMax}{[data-ff="${sid}"]>[data-dev="base"]{display:none}}@media not all and ${tabletMax}{[data-ff="${sid}"]>[data-dev="tablet"]{display:none}}` : '',
  ].join('')
  const device = (key: string, tree: IRNode, cap: boolean) => {
    const bg = background(tree.fills.filter((f) => f.type === 'solid'))
    return (
      <div data-dev={key} style={{ containerType: 'inline-size', width: '100%', ...bg }}>
        <div style={{ '--u': cap ? `min(calc(100cqw / ${r2(tree.width)}), 1px)` : `calc(100cqw / ${r2(tree.width)})` } as CSSProperties}>
          <Node node={tree} parent={null} c={ctxFor(tree)} root />
        </div>
      </div>
    )
  }
  return (
    <SectionShell section={section} className="overflow-x-clip">
      <div data-ff={sid}>
        {css && <style>{css}</style>}
        {device('base', s.tree, true)}
        {tablet && device('tablet', tablet, false)}
        {mobile && device('mobile', mobile, false)}
      </div>
      {scroll && <FigmaScroll />}
    </SectionShell>
  )
}
