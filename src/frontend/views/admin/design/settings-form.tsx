'use client'
// Settings form generated from the section's Zod schema. Every edited key is added to overriddenFields, so a later
// Figma re-sync keeps the admin's value unless they accept the Figma one. On tablet/mobile, layout and content keys
// are saved as responsive overrides.
import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { Textarea } from '@/frontend/components/ui/textarea'
import { fieldMeta, type FieldMeta, type ImageValue, type LinkValue, type RichText } from '@/shared/sections/fields'
import { fromMarkup, toMarkup } from '@/shared/sections/markup'
import { SECTIONS, defaultBlockSettings, newId, type SectionInstance } from '@/shared/sections/registry'
import { plainText, walkIR, type IRNode } from '@/shared/design-ir'
import { FieldControl, FieldRow, LinkField, MediaPicker, type EditorContext } from './fields'

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

export function SectionSettings({ section, onChange, ctx, device }: { section: SectionInstance; onChange: (s: SectionInstance) => void; ctx: EditorContext; device: Device }) {
  const def = SECTIONS[section.type]
  if (section.type === 'freeform') return <FreeformSettings section={section} onChange={onChange} ctx={ctx} />
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

/** Freeform: the layout is fixed; each text, image and link layer can be overridden. */
function FreeformSettings({ section, onChange, ctx }: { section: SectionInstance; onChange: (s: SectionInstance) => void; ctx: EditorContext }) {
  const s = section.settings as { tree: IRNode; texts: Record<string, RichText>; images: Record<string, ImageValue>; links: Record<string, LinkValue>; headingNodeId: string; headingLevel: string }
  const [picking, setPicking] = useState<string | null>(null)
  const texts: IRNode[] = [], images: IRNode[] = []
  if (s.tree?.children) walkIR(s.tree, (n) => { if (n.kind === 'text') texts.push(n); if (n.kind === 'image') images.push(n) })
  const set = (patch: Partial<typeof s>, key: string) => onChange({ ...section, settings: { ...section.settings, ...patch }, overriddenFields: markOverridden(section, key) })
  const headingMeta = fieldMeta(SECTIONS.freeform.settings.shape.headingLevel as never)!
  return (
    <div className="space-y-5">
      <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">This section keeps the Figma layout. To get a responsive, fully editable section, change its type in the section list.</p>
      <FieldRow meta={headingMeta}><FieldControl meta={headingMeta} value={s.headingLevel} onChange={(v) => set({ headingLevel: v as string }, 'headingLevel')} ctx={ctx} /></FieldRow>
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text</div>
        {texts.map((n) => (
          <div key={n.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs"><span className="truncate">{n.name}</span>{n.id === s.headingNodeId && <span className="text-muted-foreground">main heading</span>}</div>
            <Textarea rows={2} value={toMarkup(s.texts?.[n.id] ?? [{ type: 'p', runs: [{ text: plainText(n) }] }])} onChange={(e) => set({ texts: { ...s.texts, [n.id]: fromMarkup(e.target.value) } }, 'texts')} />
            <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Link</summary><div className="pt-2"><LinkField value={s.links?.[n.id] ?? { kind: 'none' }} onChange={(l) => set({ links: { ...s.links, [n.id]: l } }, 'links')} ctx={ctx} /></div></details>
          </div>
        ))}
      </div>
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Images</div>
          {images.map((n) => {
            const img = s.images?.[n.id]
            return (
              <div key={n.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{n.name}</span>
                <input aria-label={`Alt text for ${n.name}`} className="h-8 w-40 rounded border px-2" placeholder="Alt text" value={img?.alt ?? n.image?.alt ?? ''}
                  onChange={(e) => set({ images: { ...s.images, [n.id]: { url: img?.url ?? n.image?.assetUrl ?? '', width: img?.width ?? n.width, height: img?.height ?? n.height, decorative: false, alt: e.target.value } } }, 'images')} />
                <Button type="button" size="sm" variant="outline" onClick={() => setPicking(n.id)}>Replace</Button>
              </div>
            )
          })}
          <MediaPicker open={!!picking} onClose={() => setPicking(null)} onPick={(a) => picking && set({ images: { ...s.images, [picking]: { url: a.url, alt: a.alt, decorative: false, width: a.width, height: a.height, assetId: a.id } } }, 'images')} />
        </div>
      )}
    </div>
  )
}
