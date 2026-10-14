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
  component?: { name: string; variant: Record<string, string>; primitive?: { type: 'button'; variant: string } }
  link?: IRLink
  children: IRNode[]
}

export type IRWarningCode = 'NO_AUTO_LAYOUT' | 'MISSING_FONT' | 'MISSING_ALT' | 'LOW_CONTRAST' | 'MULTIPLE_H1' | 'UNMAPPED_SECTION' | 'ASSET_FAILED'
export type IRWarning = { code: IRWarningCode; nodeId?: string; pageTitle?: string; message: string }

export type IRFrame = { nodeId: string; name: string; device: 'desktop' | 'tablet' | 'mobile'; root: IRNode }
export type IRPage = { title: string; type: string; slug?: string; frames: IRFrame[] }
export type IRDocument = { fileKey: string; version: string; pages: IRPage[]; fonts: { family: string; weights: number[]; italic: boolean }[]; warnings: IRWarning[] }

export const cssColor = (c: IRColor) => (c.a >= 1 ? `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(3)})`)

export function walkIR(node: IRNode, visit: (n: IRNode, parent: IRNode | null) => void, parent: IRNode | null = null) {
  visit(node, parent)
  for (const child of node.children) walkIR(child, visit, node)
}

export function plainText(node: IRNode) {
  return node.text?.runs.map((r) => r.text).join('') ?? ''
}
