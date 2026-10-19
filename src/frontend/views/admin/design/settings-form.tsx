'use client'
// Settings form generated from the section's Zod schema. Every edited key is added to overriddenFields, so a later
// Figma re-sync keeps the admin's value unless they accept the Figma one. On tablet/mobile, layout and content keys
// are saved as responsive overrides.
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Copy, Eye, EyeOff, Frame as FrameIcon, Image as ImageIcon, Plus, Scissors, Shapes, Trash2, Type } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { Textarea } from '@/frontend/components/ui/textarea'
import { LAYER_STYLE_FIELDS, fieldMeta, type FieldMeta, type ImageValue, type LayerStyleKey, type LayerVideo, type LinkValue, type RichText } from '@/shared/sections/fields'
import { fromMarkup, toMarkup } from '@/shared/sections/markup'
import { SECTIONS, defaultBlockSettings, newId, type SectionInstance } from '@/shared/sections/registry'
import { plainText, type IRNode } from '@/shared/design-ir'
import { deleteLayer, duplicateLayer, isFlow, layerTrees, locateLayer, moveLayer, setLayerStyle, toggleLayer, treeField, treeLabel, layerName, type FreeformSettings as FS, type LayerLocation, type TreeKey } from '@/shared/freeform-edit'
import { FieldControl, FieldRow, LinkField, MediaPicker, VideoField, type EditorContext } from './fields'
import { Switch } from '@/frontend/components/ui/switch'

export type Device = 'desktop' | 'tablet' | 'mobile'
export const RESPONSIVE_KEYS = new Set(['title', 'subtitle', 'body', 'image', 'layout', 'imagePosition', 'align', 'columns', 'minHeight', 'paddingTop', 'paddingBottom', 'text', 'eyebrow', 'height'])

const markOverridden = (s: SectionInstance, key: string) => (s.overriddenFields.includes(key) ? s.overriddenFields : [...s.overriddenFields, key])

function Fields({ shape, values, onField, ctx, device, section }: { shape: Record<string, unknown>; values: Record<string, unknown>; onField: (key: string, v: unknown | undefined) => void; ctx: EditorContext; device: Device; section?: SectionInstance }) {
  return (
    <div className="space-y-4">
      {Object.entries(shape).map(([key, schema]) => {
        const meta = fieldMeta(schema as never) as FieldMeta | undefined
        if (!meta) return null
        const responsive = section && device !== 'desktop' && RESPONSIVE_KEYS.has(key)
        const deviceValue = responsive ? section!.responsive[device as 'tablet' | 'mobile']?.[key] : undefined
        return (
          <FieldRow key={key} meta={{ ...meta, label: responsive ? `${meta.label} (${device})` : meta.label }} overridden={deviceValue !== undefined ? 'device' : null} onReset={() => onField(key, undefined)}>
            <FieldControl meta={meta} value={deviceValue !== undefined ? deviceValue : values[key]} onChange={(v) => onField(key, v)} ctx={ctx} />
          </FieldRow>
        )
      })}
    </div>
  )
}

type SectionSettingsProps = {
  section: SectionInstance; onChange: (s: SectionInstance) => void; ctx: EditorContext; device: Device
  /** Figma sections: the selected layer (also picked by clicking the preview), and splitting an exact page. */
  selectedNode: string | null; onSelectNode: (id: string | null) => void; onSplit?: () => void
  /** Scroll story: the screen chosen in the section list ('@' = the first). */
  scene?: string | null
}

export function SectionSettings(props: SectionSettingsProps) {
  const { section, onChange, ctx, device } = props
  const def = SECTIONS[section.type]
  if (section.type === 'freeform') return <FreeformSettings {...props} />
  const onField = (key: string, value: unknown | undefined) => {
    if (device !== 'desktop' && RESPONSIVE_KEYS.has(key)) {
      const d = device as 'tablet' | 'mobile'
      const current = { ...(section.responsive[d] ?? {}) }
      if (value === undefined) delete current[key]; else current[key] = value
      onChange({ ...section, responsive: { ...section.responsive, [d]: Object.keys(current).length ? current : undefined }, overriddenFields: markOverridden(section, key) })
    } else onChange({ ...section, settings: { ...section.settings, [key]: value }, overriddenFields: markOverridden(section, key) })
  }
  return (
    <div className="space-y-6">
      <Fields shape={def.settings.shape} values={section.settings} onField={onField} ctx={ctx} device={device} section={section} />
      {def.blocks && <Blocks section={section} onChange={onChange} ctx={ctx} />}
    </div>
  )
}

function Blocks({ section, onChange, ctx }: { section: SectionInstance; onChange: (s: SectionInstance) => void; ctx: EditorContext }) {
  const def = SECTIONS[section.type].blocks!
  const [open, setOpen] = useState<string | null>(null)
  const update = (blocks: SectionInstance['blocks']) => onChange({ ...section, blocks, overriddenFields: markOverridden(section, 'blocks') })
  const move = (i: number, d: number) => { const b = [...section.blocks]; const [x] = b.splice(i, 1); b.splice(i + d, 0, x); update(b) }
  return (
    <div className="space-y-2 border-t pt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocks ({section.blocks.length}/{def.max})</div>
      {section.blocks.map((b, i) => {
        const bdef = def.types[b.type]
        const label = String((b.settings as Record<string, unknown>).title ?? (b.settings as Record<string, unknown>).question ?? (b.settings as Record<string, unknown>).author ?? (b.settings as Record<string, unknown>).caption ?? '') || `${bdef?.name ?? b.type} ${i + 1}`
        return (
          <div key={b.id} className="rounded-md border">
            <div className="flex items-center gap-1 p-2">
              <button type="button" className="flex-1 truncate text-left text-sm" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>{label}</button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp className="size-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === section.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown className="size-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={section.blocks.length >= def.max} onClick={() => update([...section.blocks.slice(0, i + 1), { ...b, id: newId() }, ...section.blocks.slice(i + 1)])} aria-label="Duplicate block"><Copy className="size-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => update(section.blocks.filter((x) => x.id !== b.id))} aria-label="Delete block"><Trash2 className="size-3.5" /></Button>
            </div>
            {open === b.id && bdef && (
              <div className="border-t p-3">
                <Fields shape={bdef.settings.shape} values={b.settings as Record<string, unknown>} device="desktop" ctx={ctx}
                  onField={(key, v) => update(section.blocks.map((x) => (x.id === b.id ? { ...x, settings: { ...x.settings, [key]: v } } : x)))} />
              </div>
            )}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        {Object.entries(def.types).map(([type, bd]) => (
          <Button key={type} type="button" size="sm" variant="outline" disabled={section.blocks.length >= def.max} onClick={() => { const id = newId(); update([...section.blocks, { id, type, settings: defaultBlockSettings(section.type, type) }]); setOpen(id) }}><Plus className="size-4" /> {bd.name}</Button>
        ))}
      </div>
    </div>
  )
}

/**
 * Figma section, edited like a Shopify section: a layer tree (select, hide, reorder, duplicate, delete) and an
 * inspector for the selected layer (text, link, image, style). Layers can also be picked in the preview.
 */
function FreeformSettings({ section, onChange, ctx, device, selectedNode, onSelectNode, onSplit, scene }: SectionSettingsProps) {
  const s = section.settings as unknown as FFS
  const trees = layerTrees(s)
  const located = selectedNode ? locateLayer(s, selectedNode) : null
  const deviceKey: TreeKey = device !== 'desktop' && trees.some(([k]) => k === device) ? device : 'tree'
  const sceneKey: TreeKey | null = s.scenes?.length && scene ? (scene === '@' ? 'tree' : `scene:${scene}`) : null
  const shownKey = located?.key ?? (sceneKey && trees.some(([k]) => k === sceneKey) ? sceneKey : deviceKey)
  const shown = trees.find(([k]) => k === shownKey)?.[1] ?? s.tree
  const update = (next: FS, ...keys: string[]) => onChange({ ...section, settings: next as unknown as Record<string, unknown>, overriddenFields: keys.reduce((o, k) => (o.includes(k) ? o : [...o, k]), section.overriddenFields) })
  const headingMeta = fieldMeta(SECTIONS.freeform.settings.shape.headingLevel as never)!
  return (
    <div className="space-y-5">
      {located?.parent
        ? <LayerInspector key={located.node.id} at={located} s={s} ctx={ctx} update={update} onSelect={onSelectNode} />
        : <p className="text-sm text-muted-foreground">Click anything in the preview to edit it, or double-click text to type. You can also pick a part below.</p>}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Parts of this section</span>{trees.length > 1 && <span className="font-normal normal-case">{treeLabel(s, shownKey)}</span>}
        </div>
        <LayerTree root={shown} s={s} selected={selectedNode} onSelect={onSelectNode} onToggle={(id) => update(toggleLayer(s, id), 'hiddenLayers')} />
      </div>
      <details className="rounded-md border p-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced</summary>
        <div className="space-y-3 pt-3">
          <FieldRow meta={headingMeta}><FieldControl meta={headingMeta} value={s.headingLevel} onChange={(v) => update({ ...s, headingLevel: v as string }, 'headingLevel')} ctx={ctx} /></FieldRow>
          {s.exact && onSplit && !s.scenes?.length && <Button type="button" size="sm" variant="outline" className="w-full" onClick={onSplit}><Scissors className="size-4" /> Split into separate sections</Button>}
        </div>
      </details>
    </div>
  )
}

type FFS = FS & { texts: Record<string, RichText>; images: Record<string, ImageValue>; links: Record<string, LinkValue>; videos?: Record<string, LayerVideo> }
const KIND_ICON = { frame: FrameIcon, text: Type, image: ImageIcon, vector: Shapes } as const

function LayerTree({ root, s, selected, onSelect, onToggle }: { root: IRNode; s: FS; selected: string | null; onSelect: (id: string | null) => void; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  // The first level and the ancestors of the selected layer start open.
  const ancestors = new Set<string>()
  if (selected) {
    const path: string[] = []
    const visit = (n: IRNode): boolean => { if (n.id === selected) return true; path.push(n.id); if (n.children.some(visit)) return true; path.pop(); return false }
    if (visit(root)) path.forEach((id) => ancestors.add(id))
  }
  const hidden = new Set(s.hiddenLayers ?? [])
  const row = (n: IRNode, depth: number): ReactNode => {
    const Icon = KIND_ICON[n.kind] ?? FrameIcon
    const isOpen = open[n.id] ?? (depth === 0 || ancestors.has(n.id))
    const label = layerName(n)
    return (
      <li key={n.id}>
        <div className={`group flex items-center gap-1 rounded px-1 py-0.5 text-xs ${n.id === selected ? 'bg-sky-100 text-sky-950' : 'hover:bg-muted'} ${hidden.has(n.id) ? 'opacity-50' : ''}`} style={{ paddingLeft: depth * 12 + 4 }}>
          {n.children.length ? <button type="button" className="text-muted-foreground" onClick={() => setOpen({ ...open, [n.id]: !isOpen })} aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`} aria-expanded={isOpen}>{isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</button> : <span className="w-3" />}
          <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onSelect(n.id)}><Icon className="size-3 shrink-0 text-muted-foreground" /><span className="truncate">{label}</span></button>
          {depth > 0 && <button type="button" className={`text-muted-foreground ${hidden.has(n.id) ? '' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'}`} onClick={() => onToggle(n.id)} aria-label={hidden.has(n.id) ? `Show ${label}` : `Hide ${label}`}>{hidden.has(n.id) ? <EyeOff className="size-3" /> : <Eye className="size-3" />}</button>}
        </div>
        {isOpen && n.children.length > 0 && <ul>{n.children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    )
  }
  return <ul className="max-h-80 overflow-y-auto rounded-md border p-1" aria-label="Layers">{row(root, 0)}</ul>
}

/** Value shown for a style key the admin hasn't overridden: the Figma value. */
function figmaStyle(n: IRNode, key: LayerStyleKey): unknown {
  switch (key) {
    case 'fontSize': return n.text?.style.fontSize
    case 'fontWeight': return n.text ? String(n.text.style.fontWeight) : undefined
    case 'align': return n.text?.style.align
    case 'paddingY': return n.layout?.padding[0]
    case 'paddingX': return n.layout?.padding[3]
    case 'gap': return n.layout?.gap
    case 'radius': return n.radius?.[0] ?? 0
    case 'opacity': return Math.round((n.opacity ?? 1) * 100)
    default: return null
  }
}

function styleKeys(n: IRNode): LayerStyleKey[] {
  if (n.kind === 'text') return ['textColor', 'fontSize', 'fontWeight', 'align', 'opacity']
  if (n.kind !== 'frame') return ['radius', 'opacity']
  const box: LayerStyleKey[] = ['background', 'radius', 'opacity']
  return n.layout && n.layout.mode !== 'none' ? [...box, 'paddingY', 'paddingX', 'gap'] : box
}

function LayerInspector({ at, s, ctx, update, onSelect }: { at: LayerLocation; s: FFS; ctx: EditorContext; update: (next: FS, ...keys: string[]) => void; onSelect: (id: string | null) => void }) {
  const { node: n, key } = at
  const [picking, setPicking] = useState(false)
  const flow = isFlow(at.parent, n)
  const hidden = (s.hiddenLayers ?? []).includes(n.id)
  const style: Record<string, unknown> = s.styles?.[n.id] ?? {}
  const img = s.images?.[n.id]
  const video = s.videos?.[n.id]
  const structural = (next: FS | null, select?: string | null) => { if (!next) return; update(next, treeField(key)); if (select !== undefined) onSelect(select) }
  const name = layerName(n)
  const canVideo = n.kind === 'image' || n.fills.some((f) => f.type === 'image')
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <div className="text-base font-semibold break-words">{name}</div>
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => update(toggleLayer(s, n.id), 'hiddenLayers')}>{hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {hidden ? 'Show' : 'Hide'}</Button>
          {flow && <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { const r = duplicateLayer(s, n.id); if (r) structural(r.settings, r.id) }}><Copy className="size-3.5" /> Duplicate</Button>}
          {flow && <Button type="button" variant="outline" size="icon" className="size-7" disabled={at.index === 0} onClick={() => structural(moveLayer(s, n.id, -1))} aria-label="Move up"><ChevronUp className="size-3.5" /></Button>}
          {flow && <Button type="button" variant="outline" size="icon" className="size-7" disabled={at.index === at.parent!.children.length - 1} onClick={() => structural(moveLayer(s, n.id, 1))} aria-label="Move down"><ChevronDown className="size-3.5" /></Button>}
          <Button type="button" variant="outline" size="sm" className="ml-auto h-7 px-2 text-xs text-red-700 hover:text-red-800" onClick={() => { if (window.confirm(`Remove “${name}”?`)) structural(deleteLayer(s, n.id), null) }}><Trash2 className="size-3.5" /> Remove</Button>
        </div>
      </div>
      {n.kind === 'text' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium"><span>Text</span>{n.id === s.headingNodeId && <span className="text-muted-foreground">main heading</span>}</div>
          <Textarea rows={3} value={toMarkup(s.texts?.[n.id] ?? [{ type: 'p', runs: [{ text: plainText(n) }] }])} onChange={(e) => update({ ...s, texts: { ...s.texts, [n.id]: fromMarkup(e.target.value) } }, 'texts')} />
        </div>
      )}
      {(n.kind === 'image' || n.kind === 'vector') && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium">Image</div>
          <div className="flex items-center gap-2">
            <input aria-label={`Alt text for ${n.name}`} className="h-8 min-w-0 flex-1 rounded border px-2 text-xs" placeholder="Alt text" value={img?.alt ?? n.image?.alt ?? ''}
              onChange={(e) => update({ ...s, images: { ...s.images, [n.id]: { url: img?.url ?? n.image?.assetUrl ?? n.vector?.assetUrl ?? '', width: img?.width ?? Math.max(1, Math.round(n.width)), height: img?.height ?? Math.max(1, Math.round(n.height)), decorative: false, alt: e.target.value } } }, 'images')} />
            <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>Replace</Button>
          </div>
          <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={(a) => update({ ...s, images: { ...s.images, [n.id]: { url: a.url, alt: a.alt, decorative: false, width: a.width, height: a.height, assetId: a.id } } }, 'images')} />
        </div>
      )}
      {canVideo && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium">Background video</div>
          <p className="text-[11px] text-muted-foreground">Plays instead of the image, muted and on loop.</p>
          <VideoField value={video?.url ?? ''} onChange={(url) => update({ ...s, videos: url ? { ...s.videos, [n.id]: { autoplay: true, loop: true, controls: false, ...video, url } } : Object.fromEntries(Object.entries(s.videos ?? {}).filter(([k]) => k !== n.id)) }, 'videos')} />
          {video && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {(['autoplay', 'loop', 'controls'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5 capitalize"><Switch checked={!!video[k]} onCheckedChange={(v) => update({ ...s, videos: { ...s.videos, [n.id]: { ...video, [k]: v } } }, 'videos')} />{k === 'controls' ? 'Show controls' : k}</label>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="text-xs font-medium">Link</div>
        <LinkField value={s.links?.[n.id] ?? { kind: 'none' }} onChange={(l) => update({ ...s, links: { ...s.links, [n.id]: l } }, 'links')} ctx={ctx} />
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</div>
        {styleKeys(n).map((k) => {
          const meta: FieldMeta = LAYER_STYLE_FIELDS[k]
          const own = style[k]
          return (
            <div key={k} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{meta.label}</span>
                {own !== undefined && <button type="button" className="text-[11px] text-sky-700 underline" onClick={() => update(setLayerStyle(s, n.id, k, undefined), 'styles')}>Use Figma value</button>}
              </div>
              <FieldControl meta={meta} value={own !== undefined ? (k === 'fontWeight' ? String(own) : own) : figmaStyle(n, k)} ctx={ctx}
                onChange={(v) => update(setLayerStyle(s, n.id, k, k === 'fontWeight' ? Number(v) : v), 'styles')} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
