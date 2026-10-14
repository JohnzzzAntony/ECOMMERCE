'use client'
// Field controls for section settings, generated from the registry's Zod metadata (see src/shared/sections/fields.ts).
import { useEffect, useState } from 'react'
import { ImagePlus, Loader2, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/frontend/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Switch } from '@/frontend/components/ui/switch'
import { Textarea } from '@/frontend/components/ui/textarea'
import { sizedImage } from '@/frontend/lib/image'
import type { ColorValue, FieldMeta, ImageValue, LinkValue, RichText } from '@/shared/sections/fields'
import { fromMarkup, toMarkup } from '@/shared/sections/markup'
import type { DesignTokens } from '@/shared/design-tokens'
import { adminApi, errorMessage } from '../admin-api'

export type Asset = { id: string; url: string; width: number; height: number; alt: string; altReviewed: boolean; mime: string; blurhash?: string | null }
export type EditorContext = { pages: { slug: string; title: string; type: string }[]; tokens: DesignTokens | null }

const selectCls = 'h-9 w-full rounded-md border bg-background px-2 text-sm'

// ---------------------------------------------------------------- media library picker
export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (a: Asset) => void }) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('')
  useEffect(() => { if (open) adminApi.get<Asset[]>('/api/design/assets').then(setAssets).catch((e) => toast.error(errorMessage(e))) }, [open])
  const upload = async (file: File) => {
    setUploading(true)
    const form = new FormData(); form.append('file', file)
    try { const a = await adminApi.post<Asset>('/api/design/assets', form); setAssets((x) => [a, ...(x ?? []).filter((y) => y.id !== a.id)]) }
    catch (e) { toast.error(errorMessage(e)) } finally { setUploading(false) }
  }
  const shown = (assets ?? []).filter((a) => !filter || a.alt.toLowerCase().includes(filter.toLowerCase()))
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Media library</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Filter by alt text" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button asChild variant="outline"><label className="cursor-pointer">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label></Button>
        </div>
        <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
          {!assets && <Loader2 className="size-5 animate-spin" />}
          {shown.map((a) => (
            <button key={a.id} type="button" onClick={() => { onPick(a); onClose() }} className="group overflow-hidden rounded-md border text-left hover:border-brand-teal">
              <div className="flex aspect-square items-center justify-center bg-muted"><img src={a.mime === 'image/svg+xml' ? a.url : sizedImage(a.url, 240)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" /></div>
              <div className="truncate p-1.5 text-xs">{a.alt || <span className="text-amber-700">No alt text</span>}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ImageField({ value, onChange }: { value: ImageValue; onChange: (v: ImageValue) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-2">
      {value?.url ? (
        <div className="flex items-start gap-3">
          <img src={/\.svg/.test(value.url) ? value.url : sizedImage(value.url, 160)} alt="" className="size-16 rounded border bg-muted object-contain" />
          <div className="flex-1 space-y-1.5">
            <Input value={value.alt} placeholder="Alt text (describe the image)" disabled={value.decorative} onChange={(e) => onChange({ ...value, alt: e.target.value })} aria-label="Alt text" />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.decorative} onChange={(e) => onChange({ ...value, decorative: e.target.checked })} /> Decorative (no alt text needed)</label>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove image" onClick={() => onChange(null)}><X className="size-4" /></Button>
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><ImagePlus className="size-4" /> {value?.url ? 'Replace' : 'Choose image'}</Button>
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={(a) => onChange({ url: a.url, alt: value?.alt || a.alt, decorative: value?.decorative ?? false, width: a.width, height: a.height, assetId: a.id, ...(a.blurhash ? { blurhash: a.blurhash } : {}) })} />
    </div>
  )
}

// ---------------------------------------------------------------- catalog pickers
function useCatalog<T>(url: string) {
  const [items, setItems] = useState<T[]>([])
  useEffect(() => { fetch(url).then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : d.products ?? d.items ?? [])).catch(() => setItems([])) }, [url])
  return items
}

function CollectionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const collections = useCatalog<{ slug: string; name: string }>('/api/collections')
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="">— Choose a collection —</option>
      {collections.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
    </select>
  )
}

function ProductSearch({ onPick }: { onPick: (p: { slug: string; name: string }) => void }) {
  const [q, setQ] = useState('')
  const [found, setResults] = useState<{ slug: string; name: string }[]>([])
  const results = q.trim().length < 2 ? [] : found
  useEffect(() => {
    if (q.trim().length < 2) return
    const t = setTimeout(() => fetch(`/api/products?search=${encodeURIComponent(q)}&page_size=8`).then((r) => r.json()).then((d) => setResults(d.products ?? d ?? [])).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-8" />
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow">
          {results.map((p) => <li key={p.slug}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onPick(p); setQ(''); setResults([]) }}>{p.name}</button></li>)}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- links
export function LinkField({ value, onChange, ctx }: { value: LinkValue; onChange: (v: LinkValue) => void; ctx: EditorContext }) {
  const v = value ?? { kind: 'none' }
  return (
    <div className="space-y-2">
      <select value={v.kind} className={selectCls} onChange={(e) => {
        const kind = e.target.value as LinkValue['kind']
        onChange(kind === 'none' ? { kind } : kind === 'url' ? { kind, url: 'https://', newTab: false } : { kind, slug: '' } as LinkValue)
      }}>
        <option value="none">No link</option><option value="page">Page</option><option value="product">Product</option><option value="collection">Collection</option><option value="url">Web address</option>
      </select>
      {v.kind === 'page' && (
        <select value={v.slug} onChange={(e) => onChange({ kind: 'page', slug: e.target.value })} className={selectCls}>
          <option value="">Home</option>
          <option value="_cart">Cart</option>
          {ctx.pages.filter((p) => p.type === 'PAGE').map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
        </select>
      )}
      {v.kind === 'product' && (<div className="space-y-1">{v.slug && <p className="text-xs">Linked: <code>{v.slug}</code></p>}<ProductSearch onPick={(p) => onChange({ kind: 'product', slug: p.slug })} /></div>)}
      {v.kind === 'collection' && <CollectionSelect value={v.slug} onChange={(slug) => onChange({ kind: 'collection', slug })} />}
      {v.kind === 'url' && (
        <div className="space-y-1">
          <Input value={v.url} onChange={(e) => onChange({ ...v, url: e.target.value })} placeholder="https://" />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.newTab} onChange={(e) => onChange({ ...v, newTab: e.target.checked })} /> Open in a new tab</label>
        </div>
      )}
    </div>
  )
}

function LinksField({ value, onChange, ctx }: { value: { label: string; link: LinkValue }[]; onChange: (v: { label: string; link: LinkValue }[]) => void; ctx: EditorContext }) {
  const list = value ?? []
  const set = (i: number, patch: Partial<{ label: string; link: LinkValue }>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="space-y-2 rounded-md border p-2">
          <div className="flex gap-2"><Input value={item.label} placeholder="Label" onChange={(e) => set(i, { label: e.target.value })} /><Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>
          <LinkField value={item.link} onChange={(link) => set(i, { link })} ctx={ctx} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, { label: 'Link', link: { kind: 'none' } }])}><Plus className="size-4" /> Add link</Button>
    </div>
  )
}

// ---------------------------------------------------------------- colours, rich text
function ColorField({ value, onChange, ctx }: { value: ColorValue; onChange: (v: ColorValue) => void; ctx: EditorContext }) {
  const tokens = ctx.tokens?.colors ?? []
  const mode = value?.token ? 'token' : value?.value ? 'custom' : 'none'
  return (
    <div className="flex items-center gap-2">
      <select value={mode === 'token' ? `t:${value!.token}` : mode} className={selectCls} onChange={(e) => {
        const v = e.target.value
        onChange(v === 'none' ? null : v === 'custom' ? { value: value?.value ?? '#000000' } : { token: v.slice(2) })
      }}>
        <option value="none">Default</option>
        {tokens.map((t) => <option key={t.name} value={`t:${t.name}`}>{t.name} ({t.value})</option>)}
        <option value="custom">Custom…</option>
      </select>
      {mode === 'custom' && <input type="color" aria-label="Custom colour" value={value?.value?.slice(0, 7) ?? '#000000'} onChange={(e) => onChange({ value: e.target.value })} className="h-9 w-12 rounded border" />}
      {mode === 'token' && <span className="size-6 shrink-0 rounded border" style={{ background: tokens.find((t) => t.name === value?.token)?.value }} />}
    </div>
  )
}

function RichTextField({ value, onChange }: { value: RichText; onChange: (v: RichText) => void }) {
  const [text, setText] = useState(() => toMarkup(value))
  const [seen, setSeen] = useState(() => JSON.stringify(value))
  // The value changed from outside (undo, another device): show it, unless it is what this text already parses to.
  const json = JSON.stringify(value)
  if (json !== seen) { setSeen(json); if (JSON.stringify(fromMarkup(text)) !== json) setText(toMarkup(value)) }
  return (
    <div className="space-y-1">
      <Textarea value={text} rows={5} onChange={(e) => { setText(e.target.value); onChange(fromMarkup(e.target.value)) }} />
      <p className="text-[11px] text-muted-foreground">**bold** · *italic* · ++underline++ · [link text](/pages/about or https://…) · “- ” for lists · blank line = new paragraph</p>
    </div>
  )
}

// ---------------------------------------------------------------- dispatcher
export function FieldControl({ meta, value, onChange, ctx }: { meta: FieldMeta; value: unknown; onChange: (v: unknown) => void; ctx: EditorContext }) {
  switch (meta.control) {
    case 'text': case 'video': return <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={meta.control === 'video' ? 'https://www.youtube.com/watch?v=…' : undefined} />
    case 'textarea': return <Textarea value={String(value ?? '')} rows={3} onChange={(e) => onChange(e.target.value)} />
    case 'richtext': return <RichTextField value={(value as RichText) ?? []} onChange={onChange} />
    case 'image': return <ImageField value={(value as ImageValue) ?? null} onChange={onChange} />
    case 'link': return <LinkField value={(value as LinkValue) ?? { kind: 'none' }} onChange={onChange} ctx={ctx} />
    case 'links': return <LinksField value={(value as { label: string; link: LinkValue }[]) ?? []} onChange={onChange} ctx={ctx} />
    case 'color': return <ColorField value={(value as ColorValue) ?? null} onChange={onChange} ctx={ctx} />
    case 'select': case 'heading': return <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={selectCls}>{meta.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    case 'range': return (
      <div className="flex items-center gap-3">
        <input type="range" min={meta.min} max={meta.max} step={meta.step ?? 1} value={Number(value ?? meta.min ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" aria-label={meta.label} />
        <span className="w-14 text-right text-xs tabular-nums">{String(value ?? '')}{meta.unit ?? ''}</span>
      </div>
    )
    case 'boolean': return <Switch checked={!!value} onCheckedChange={onChange} aria-label={meta.label} />
    case 'collection': return <CollectionSelect value={String(value ?? '')} onChange={onChange} />
    case 'product': return <div className="space-y-1">{value ? <p className="text-xs">Selected: <code>{String(value)}</code></p> : null}<ProductSearch onPick={(p) => onChange(p.slug)} /></div>
    case 'products': {
      const list = (value as string[]) ?? []
      return (
        <div className="space-y-2">
          <ul className="space-y-1">{list.map((slug) => <li key={slug} className="flex items-center justify-between rounded border px-2 py-1 text-xs"><code>{slug}</code><button type="button" aria-label={`Remove ${slug}`} onClick={() => onChange(list.filter((s) => s !== slug))}><X className="size-3" /></button></li>)}</ul>
          <ProductSearch onPick={(p) => !list.includes(p.slug) && onChange([...list, p.slug])} />
        </div>
      )
    }
  }
}

export function FieldRow({ meta, children, overridden, onReset }: { meta: FieldMeta; children: React.ReactNode; overridden?: 'device' | null; onReset?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{meta.label}</Label>
        {overridden === 'device' && onReset && <button type="button" onClick={onReset} className="text-[11px] text-sky-700 underline">Use desktop value</button>}
      </div>
      {children}
    </div>
  )
}
