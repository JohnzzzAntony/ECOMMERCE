// Freeform section: renders the Figma layout (IR) as designed — auto layout becomes flexbox, other frames use
// absolute positions. Structure is fixed; text, images and links can be overridden per node in the editor.
import type { CSSProperties, ReactNode } from 'react'
import { cssColor, type IRColor, type IRNode, type IRPaint } from '@/shared/design-ir'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'
import { RichTextView, SectionShell, SmartImage, SmartLink, settingsOf, type SectionProps } from './shared'

type Overrides = { texts: Record<string, RichText>; images: Record<string, ImageValue>; links: Record<string, LinkValue>; headingNodeId: string; headingLevel: string }

const SAFE_URL = /^(https:\/\/[^\s"'()<>]+|\/[^\s"'()<>]*)$/
const n = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const col = (c: IRColor | null | undefined) => (c ? cssColor({ r: n(c.r), g: n(c.g), b: n(c.b), a: n(c.a, 1) }) : undefined)

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

function boxStyle(node: IRNode, parent: IRNode | null, root: boolean): CSSProperties {
  const style: CSSProperties = { boxSizing: 'border-box', opacity: n(node.opacity, 1) < 1 ? n(node.opacity, 1) : undefined }
  const parentFlex = parent?.layout && parent.layout.mode !== 'none'
  if (root) { style.width = '100%'; style.maxWidth = n(node.width); style.marginInline = 'auto'; style.position = 'relative' }
  else if (node.absolute && parent) { style.position = 'absolute'; style.left = n(node.x); style.top = n(node.y); style.width = n(node.width); style.height = n(node.height) }
  else {
    const mainIsWidth = parent?.layout?.mode !== 'column'
    if (node.widthMode === 'fill') { if (parentFlex && mainIsWidth) style.flex = '1 1 0'; else style.alignSelf = 'stretch'; style.minWidth = 0 }
    else if (node.widthMode === 'fixed') { style.width = n(node.width); style.maxWidth = '100%' }
    if (node.heightMode === 'fill') { if (parentFlex && !mainIsWidth) style.flex = '1 1 0'; else style.alignSelf = 'stretch' }
    else if (node.heightMode === 'fixed' && (node.kind !== 'frame' || node.layout?.mode === 'none')) style.height = n(node.height)
    else if (node.heightMode === 'fixed') style.minHeight = n(node.height)
    style.flexShrink = node.widthMode === 'fixed' ? 1 : undefined
  }
  if (node.kind === 'frame') {
    Object.assign(style, background(node.fills))
    const l = node.layout
    if (l && l.mode !== 'none') {
      Object.assign(style, {
        display: 'flex', flexDirection: l.mode, flexWrap: l.wrap ? 'wrap' : 'nowrap', gap: n(l.gap),
        padding: l.padding.map((p) => `${n(p)}px`).join(' '),
        justifyContent: { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' }[l.justify],
        alignItems: { start: 'flex-start', center: 'center', end: 'flex-end', baseline: 'baseline', stretch: 'stretch' }[l.align],
      })
    } else if (!node.absolute || root) { style.position = 'relative'; if (node.children.some((c) => c.absolute)) style.minHeight = n(node.height) }
    if (node.clips) style.overflow = 'hidden'
  }
  if (node.stroke) style.border = `${n(node.stroke.width)}px ${node.stroke.dashed ? 'dashed' : 'solid'} ${col(node.stroke.color)}`
  if (node.radius) style.borderRadius = node.radius.map((r) => `${n(r)}px`).join(' ')
  if (node.shadows?.length) style.boxShadow = node.shadows.map((s) => `${s.inset ? 'inset ' : ''}${n(s.x)}px ${n(s.y)}px ${n(s.blur)}px ${n(s.spread)}px ${col(s.color)}`).join(', ')
  if (node.blur) { if (node.blur.type === 'layer') style.filter = `blur(${n(node.blur.radius)}px)`; else style.backdropFilter = `blur(${n(node.blur.radius)}px)` }
  return style
}

const FAMILY = /^[A-Za-z0-9 _-]{1,60}$/

function textStyle(node: IRNode): CSSProperties {
  const t = node.text!.style
  return {
    margin: 0,
    fontFamily: FAMILY.test(t.fontFamily) ? `"${t.fontFamily}", var(--font-body-family, system-ui), sans-serif` : undefined,
    fontSize: n(t.fontSize, 16), fontWeight: n(t.fontWeight, 400), fontStyle: t.italic ? 'italic' : undefined,
    lineHeight: t.lineHeight ? `${n(t.lineHeight)}px` : 'normal', letterSpacing: n(t.letterSpacing) ? `${n(t.letterSpacing)}px` : undefined,
    color: col(t.color), textAlign: t.align,
    textTransform: t.textCase === 'upper' ? 'uppercase' : t.textCase === 'lower' ? 'lowercase' : t.textCase === 'title' ? 'capitalize' : undefined,
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
  }
}

function irRuns(node: IRNode): RichText {
  return [{ type: 'p', runs: node.text!.runs.map((r) => ({ text: r.text, ...(r.marks.bold ? { bold: true } : {}), ...(r.marks.italic ? { italic: true } : {}), ...(r.marks.underline ? { underline: true } : {}), ...(r.marks.link?.kind === 'url' && /^https?:\/\//.test(r.marks.link.url) ? { link: { kind: 'url' as const, url: r.marks.link.url, newTab: r.marks.link.newTab } } : {}) })) }]
}

function Node({ node, parent, o, root = false }: { node: IRNode; parent: IRNode | null; o: Overrides; root?: boolean }): ReactNode {
  const style = boxStyle(node, parent, root)
  let content: ReactNode
  if (node.kind === 'text') {
    const Tag = (node.id === o.headingNodeId && ['h1', 'h2', 'h3', 'h4'].includes(o.headingLevel) ? o.headingLevel : 'div') as 'div'
    content = <Tag style={{ ...style, ...textStyle(node) }}><RichTextView value={o.texts[node.id] ?? irRuns(node)} className="space-y-0 [&>p]:m-0" /></Tag>
  } else if (node.kind === 'image' || node.kind === 'vector') {
    const override = o.images[node.id]
    const url = override?.url ?? (node.kind === 'image' ? node.image?.assetUrl : node.vector?.assetUrl)
    content = url && SAFE_URL.test(url) ? (
      <div style={{ ...style, ...(node.kind === 'image' ? { overflow: 'hidden' } : {}) }}>
        <SmartImage image={override ?? { url, alt: node.kind === 'image' ? node.image?.alt ?? '' : '', decorative: node.kind === 'vector', width: Math.max(1, n(node.width, 1)), height: Math.max(1, n(node.height, 1)) }} sizes={`${Math.max(1, n(node.width, 100))}px`}
          className={node.kind === 'image' ? 'h-full w-full object-cover' : 'h-full w-full'} />
      </div>
    ) : <div style={style} aria-hidden />
  } else {
    content = <div style={style}>{node.children.map((c) => <Node key={c.id} node={c} parent={node} o={o} />)}</div>
  }
  const link = o.links[node.id] ?? (node.link?.kind === 'url' && /^(https?:|mailto:|tel:)/.test(node.link.url) ? { kind: 'url' as const, url: node.link.url, newTab: node.link.newTab } : undefined)
  return link && link.kind !== 'none' ? <SmartLink link={link} className="contents">{content}</SmartLink> : content
}

export default function Freeform({ section }: SectionProps) {
  const s = settingsOf<Overrides & { tree: IRNode | null }>(section)
  if (!s.tree || typeof s.tree !== 'object' || !Array.isArray(s.tree.children)) return null
  return (
    <SectionShell section={section} className="overflow-x-clip">
      <Node node={s.tree} parent={null} o={{ texts: s.texts ?? {}, images: s.images ?? {}, links: s.links ?? {}, headingNodeId: s.headingNodeId, headingLevel: s.headingLevel }} root />
    </SectionShell>
  )
}
