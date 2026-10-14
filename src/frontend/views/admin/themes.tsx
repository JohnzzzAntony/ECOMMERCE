'use client'
// Theme library (upload, install, activate, export, delete) and the customizer
// (click-to-edit sections, theme settings, custom CSS) with a live storefront preview.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, Code2, Copy, Download, Eye, EyeOff, GripVertical, Loader2,
  FileArchive, History, Monitor, MoreHorizontal, Palette, Pencil, Plus, Redo2, RotateCcw, Save, ShieldCheck, Smartphone, Tablet, Trash2, Undo2, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import {
  MENU_HANDLES, resolveLink, SECTION_TYPES, sectionSchema, type MenuHandle, type MenuItem, type SectionType, type ThemeDoc, type ThemeReport, type ThemeSection, type ThemeSettingDef, type ThemeSettings, type ThemeValue,
} from '@/shared/theme'
import { EDITOR_PARAM, PREVIEW_PARAM, type EditorMessage } from '@/frontend/components/theme/editor-bridge'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { LinkPicker, useLinkTargets, type LinkTargets } from './link-picker'
import { MenuEditor, refreshStorefrontTheme } from './navigation'
import { PageDialog, pageDraft, type AdminPage, type Draft } from './pages'
import { ImageUpload, LoadError, SectionHeader } from './shared'

export interface AdminTheme {
  id: string
  slug: string
  name: string
  version: string
  author: string | null
  description: string | null
  kind: 'native' | 'html'
  isActive: boolean
  css: string
  pageCount: number
  updatedAt: string
  /** Bumped by every save; sent back with writes so concurrent edits are detected. */
  revision: number
  /** settings/sections/css below are unpublished edits; `published` is what the store shows. */
  hasDraft: boolean
  sourceUrl: string | null
  report: ThemeReport
  schema: ThemeSettingDef[]
  settings: ThemeSettings
  sections: ThemeSection[]
  published: ThemeDoc
}

interface Revision { id: string; number: number; note: string; author: string | null; createdAt: string }

const LEVELS: Record<ThemeReport['level'], string> = {
  A: 'Fully editable (theme manifest)',
  B: 'Editable through a framework adapter',
  C: 'Visual page editing (rendered HTML)',
  D: 'Preview only',
}

// ---------- library ----------

/** Compact install bar: pick a .zip, optionally publish right away. */
function InstallBar({ onInstalled }: { onInstalled: (theme: AdminTheme, warnings: string[]) => void }) {
  const [activate, setActivate] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const install = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('activate', String(activate))
    setBusy(file.name)
    try {
      const res = await adminApi.post<{ theme: AdminTheme; warnings: string[] }>('/api/admin/themes', form)
      onInstalled(res.theme, res.warnings)
    } catch (e) { toast.error(errorMessage(e)) } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2">
      <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) install(f) }} />
      <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!!busy} onClick={() => input.current?.click()}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> Installing…</> : <><Upload className="size-4" /> Upload theme .zip</>}
      </Button>
      <label className="flex items-center gap-2 text-xs"><Switch checked={activate} onCheckedChange={setActivate} disabled={!!busy} /> Publish after install</label>
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {busy
          ? `Installing ${busy}: uploading images and fonts, creating pages, menus and options. Large templates take a minute.`
          : 'theme.json package, HTML template, or a built React/Vue/Next site (dist/, build/, out/). Pages, menus and colors/fonts become editable.'}
      </p>
    </div>
  )
}

/** "…" menu with the less common theme actions. */
function ActionsMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <Button size="icon" variant="outline" className="size-8" onClick={() => setOpen(!open)} aria-label="Theme actions" aria-expanded={open}><MoreHorizontal className="size-4" /></Button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-md border border-border bg-popover p-1 shadow-lg" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuAction({ icon: Icon, label, onClick, href, danger }: { icon: React.ElementType; label: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${danger ? 'text-red-600' : ''}`
  return href
    ? <a role="menuitem" href={href} target={href.startsWith('/?') ? '_blank' : undefined} rel="noreferrer" className={cls}><Icon className="size-4" />{label}</a>
    : <button role="menuitem" className={cls} onClick={onClick}><Icon className="size-4" />{label}</button>
}

type Opener = (id: string, tab?: string) => void

function ThemeRow({ theme, current, onOpen, onChanged, onReport }: { theme: AdminTheme; current?: boolean; onOpen: Opener; onChanged: (focus?: AdminTheme) => void; onReport: (t: AdminTheme) => void }) {
  const [busy, setBusy] = useState(false)
  const swatches = ['color_primary', 'color_accent', 'color_highlight', 'color_text', 'color_surface'].map((k) => String(theme.settings[k] ?? ''))
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) } }

  const publish = () => run(async () => {
    if (!confirm(`Publish "${theme.name}"? It replaces the live theme and its menus become the store menus.`)) return
    await adminApi.put('/api/admin/themes', { id: theme.id, activate: true })
    toast.success(`${theme.name} is now live`)
    onChanged()
    refreshStorefrontTheme()
  })
  const rename = () => run(async () => {
    const name = prompt('Theme name', theme.name)?.trim()
    if (!name || name === theme.name) return
    await adminApi.put('/api/admin/themes', { id: theme.id, name })
    toast.success('Theme renamed')
    onChanged()
  })
  const duplicate = () => run(async () => {
    const res = await adminApi.post<{ theme: AdminTheme }>('/api/admin/themes/duplicate', { id: theme.id })
    toast.success(`Created "${res.theme.name}"`)
    onChanged()
  })
  const remove = () => run(async () => {
    if (!confirm(`Delete "${theme.name}"?${theme.pageCount ? ` Its ${theme.pageCount} page(s) are deleted too.` : ''} This can't be undone.`)) return
    await adminApi.del(`/api/admin/themes?id=${theme.id}`)
    toast.success('Theme deleted')
    onChanged()
  })

  const meta = `v${theme.version}${theme.author ? ` · ${theme.author}` : ''}${theme.pageCount ? ` · ${theme.pageCount} page${theme.pageCount === 1 ? '' : 's'}` : ''} · Level ${theme.report.level}: ${theme.kind === 'html' ? 'HTML template' : 'Native'}${theme.hasDraft ? ' · unpublished changes' : ''}`
  const actions = (
    <ActionsMenu>
      <MenuAction icon={Eye} label="Preview" href={theme.isActive ? '/' : `/?${PREVIEW_PARAM}=${theme.id}`} />
      <MenuAction icon={Pencil} label="Rename" onClick={rename} />
      <MenuAction icon={Copy} label="Duplicate" onClick={duplicate} />
      <MenuAction icon={ShieldCheck} label="Compatibility report" onClick={() => onReport(theme)} />
      <MenuAction icon={Download} label="Download theme file" href={`/api/admin/themes/export?id=${theme.id}`} />
      {theme.sourceUrl && <MenuAction icon={FileArchive} label="Download original upload" href={theme.sourceUrl} />}
      <MenuAction icon={Code2} label="Edit code" onClick={() => onOpen(theme.id, 'css')} />
      {!theme.isActive && <MenuAction icon={Trash2} label="Delete" danger onClick={remove} />}
    </ActionsMenu>
  )

  if (current) {
    return (
      <Card className="overflow-hidden py-0">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-full shrink-0 overflow-hidden rounded-md border border-border sm:w-40">
            {swatches.map((c, i) => <div key={i} className="flex-1" style={{ background: c || '#eee' }} />)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current theme</div>
            <div className="mt-0.5 flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-brand-ink">{theme.name}</h3>
              <Badge className="h-5 bg-emerald-600 px-1.5 text-[10px]">Live</Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{meta} · Saved {new Date(theme.updatedAt).toLocaleString()}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <Button size="sm" className="h-8 bg-brand-teal hover:bg-brand-teal-dark" disabled={busy} onClick={() => onOpen(theme.id)}><Palette className="size-4" /> Customize</Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <div className="flex h-8 w-14 shrink-0 overflow-hidden rounded border border-border">
        {swatches.map((c, i) => <div key={i} className="flex-1" style={{ background: c || '#eee' }} />)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-brand-ink">{theme.name}</div>
        <p className="truncate text-xs text-muted-foreground">{meta} · Saved {new Date(theme.updatedAt).toLocaleDateString()}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={publish}>Publish</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => onOpen(theme.id)}>Customize</Button>
      </div>
    </div>
  )
}

// ---------- customizer (visual editor) ----------
// Full-screen editor like Shopify's: sidebar on the left, the real storefront on the right in a
// same-origin frame. Unsaved changes stream into the frame (editor-bridge.ts); clicking a section
// in the frame opens its settings here.

function SettingInput({ def, value, onChange, targets }: { def: ThemeSettingDef; value: ThemeValue | undefined; onChange: (v: ThemeValue) => void; targets: LinkTargets }) {
  const str = value === undefined ? '' : String(value)
  switch (def.type) {
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(str) ? str : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent" aria-label={def.label} />
          <Input value={str} placeholder="Theme default" onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
          {str && def.default === '' && <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onChange('')} aria-label="Reset" title="Reset"><RotateCcw className="size-3.5" /></Button>}
        </div>
      )
    case 'checkbox':
      return <Switch checked={value === true} onCheckedChange={onChange} aria-label={def.label} />
    case 'range':
      return (
        <div className="flex items-center gap-3">
          <input type="range" min={def.min ?? 0} max={def.max ?? 100} step={def.step ?? 1} value={Number(value ?? def.min ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--brand-teal)]" aria-label={def.label} />
          <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{String(value ?? '')}{def.unit ?? ''}</span>
        </div>
      )
    case 'select': {
      // Radix Select can't hold an empty value; '' (theme default) is stored as a sentinel.
      const NONE = '__default'
      return (
        <Select value={str || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{(def.options ?? []).map((o) => <SelectItem key={o.value || NONE} value={o.value || NONE}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )
    }
    case 'image':
      return <ImageUpload label="" value={str} onChange={onChange} folder="themes" />
    case 'textarea':
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} rows={3} />
    case 'html':
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} rows={12} spellCheck={false} className="font-mono text-xs" />
    case 'link':
      return <LinkPicker value={str} onChange={onChange} targets={targets} allowNone />
    case 'page':
      return (
        <Select value={str || undefined} onValueChange={onChange}>
          <SelectTrigger className="w-full"><SelectValue placeholder={targets.pages.length ? 'Choose a page' : 'Create a page under Pages first'} /></SelectTrigger>
          <SelectContent>{targets.pages.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      )
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} />
  }
}

/** Settings grouped like Shopify's sidebar: collapsible groups, the first one open. */
function SettingsGroups({ schema, values, onChange, targets }: { schema: ThemeSettingDef[]; values: ThemeSettings; onChange: (s: ThemeSettings) => void; targets: LinkTargets }) {
  const groups = useMemo(() => {
    const map = new Map<string, ThemeSettingDef[]>()
    for (const def of schema) map.set(def.group ?? 'General', [...(map.get(def.group ?? 'General') ?? []), def])
    return [...map.entries()]
  }, [schema])
  return (
    <div className="divide-y divide-border">
      {groups.map(([group, defs], i) => (
        <details key={group} open={i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-brand-ink hover:bg-muted/50">
            {group}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {defs.map((def) => (
              <div key={def.id} className={def.type === 'checkbox' ? 'flex items-center justify-between gap-3' : 'grid gap-1.5'}>
                <Label className="text-xs font-medium text-muted-foreground">{def.label}</Label>
                <SettingInput def={def} value={values[def.id] ?? def.default} onChange={(v) => onChange({ ...values, [def.id]: v })} targets={targets} />
                {def.help && <p className="text-[11px] text-muted-foreground">{def.help}</p>}
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

const CHROME: Record<string, { label: string; groups: string[] }> = {
  '@header': { label: 'Header', groups: ['Branding', 'Header'] },
  '@footer': { label: 'Footer', groups: ['Footer'] },
}

function SectionRow({ label, sub, enabled, onSelect, children, drag }: {
  label: string; sub?: string; enabled?: boolean; onSelect: () => void; children?: React.ReactNode
  /** Drag-and-drop reordering handlers (sections list). */
  drag?: React.HTMLAttributes<HTMLDivElement> & { draggable: true }
}) {
  return (
    <div {...drag} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted ${enabled === false ? 'opacity-50' : ''}`}>
      {drag && <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />}
      <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="truncate text-sm font-medium text-brand-ink">{label}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </button>
      <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{children}</div>
    </div>
  )
}

/** The theme's own pages: click to preview in the frame, pencil to edit. */
function ThemePages({ themeId, viewing, onPreview }: { themeId: string; viewing: string; onPreview: (link: string) => void }) {
  const { items, loading, reload } = useAdminList<AdminPage>('/api/admin/pages')
  const [draft, setDraft] = useState<Draft | null>(null)
  const pages = items.filter((p) => p.theme?.id === themeId)
  return (
    <div className="space-y-1 px-2 pb-4">
      <p className="px-2 pb-2 text-xs text-muted-foreground">Pages that came with this theme. Click to preview, pencil to edit content, styles and SEO.</p>
      <SectionRow label={viewing === 'view:home' ? 'Home page (previewing)' : 'Home page'} sub='Sections' onSelect={() => onPreview('view:home')} />
      {loading && <Skeleton className="h-10 w-full" />}
      {!loading && !pages.length && <p className="px-2 py-3 text-xs text-muted-foreground">This theme has no pages of its own. Store pages are under Pages.</p>}
      {pages.map((p) => (
        <SectionRow key={p.id} label={viewing === `page:${p.slug}` ? `${p.title} (previewing)` : p.title} sub={`/?page=${p.slug}${p.isPublished ? '' : ' · draft'}`} onSelect={() => onPreview(`page:${p.slug}`)}>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setDraft(pageDraft(p))} aria-label="Edit page"><Pencil className="size-3.5" /></Button>
        </SectionRow>
      ))}
      <PageDialog draft={draft} setDraft={setDraft} onSaved={reload} />
    </div>
  )
}

/** The theme's menus. For the live theme these are the store menus. */
function ThemeMenus({ theme, targets }: { theme: AdminTheme; targets: LinkTargets }) {
  const [menus, setMenus] = useState<Record<MenuHandle, MenuItem[]> | null>(null)
  const [open, setOpen] = useState<MenuHandle | null>(null)
  useEffect(() => {
    adminApi.get<Record<MenuHandle, MenuItem[]>>(`/api/admin/menus?theme=${theme.id}`).then(setMenus).catch((e) => toast.error(errorMessage(e)))
  }, [theme.id])
  return (
    <div className="space-y-1 px-2 pb-4">
      <p className="px-2 pb-2 text-xs text-muted-foreground">
        {theme.isActive ? 'Menus shown in the store header and footer.' : 'Saved with this theme; they become the store menus when you publish it.'}
      </p>
      {!menus ? <Skeleton className="h-20 w-full" /> : (Object.keys(MENU_HANDLES) as MenuHandle[]).map((h) => (
        <SectionRow key={h} label={MENU_HANDLES[h]} sub={menus[h].map((m) => m.label).join(' · ') || 'Empty'} onSelect={() => setOpen(h)}>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(h)} aria-label="Edit menu"><Pencil className="size-3.5" /></Button>
        </SectionRow>
      ))}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{open ? MENU_HANDLES[open] : ''}</DialogTitle>
            <DialogDescription>{theme.name}</DialogDescription>
          </DialogHeader>
          {open && menus && <MenuEditor handle={open} saved={menus[open]} targets={targets} themeId={theme.id} onSaved={(items) => setMenus({ ...menus, [open]: items })} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type Doc = ThemeDoc
type SaveState = 'saved' | 'pending' | 'saving' | 'error'
const AUTOSAVE_MS = 1200
const DEVICES = { desktop: { width: 'w-full', icon: Monitor }, tablet: { width: 'w-[820px] max-w-full', icon: Tablet }, mobile: { width: 'w-[390px]', icon: Smartphone } } as const

/** Pages of the store to open in the preview (like Shopify's template picker). */
function previewOptions(targets: LinkTargets) {
  return [
    { group: 'Store', items: [
      { value: 'view:home', label: 'Home page' }, { value: 'view:products', label: 'All products' },
      ...(targets.categories[0] ? [{ value: `category:${targets.categories[0].value}`, label: `Category: ${targets.categories[0].label}` }] : []),
      ...(targets.collections[0] ? [{ value: `collection:${targets.collections[0].value}`, label: `Collection: ${targets.collections[0].label}` }] : []),
      { value: 'view:cart', label: 'Cart' }, { value: 'view:blog', label: 'Blog' }, { value: 'view:contact', label: 'Contact' },
      { value: 'view:about', label: 'About' }, { value: 'view:faq', label: 'FAQ' }, { value: 'view:offers', label: 'Offers' },
    ] },
    { group: 'Pages', items: targets.pages.map((p) => ({ value: `page:${p.value}`, label: p.label })) },
  ]
}

function Customizer({ theme, initialTab, onBack, onSaved }: { theme: AdminTheme; initialTab?: string; onBack: () => void; onSaved: (t: AdminTheme) => void }) {
  const [settings, setSettings] = useState(theme.settings)
  const [sections, setSections] = useState(theme.sections)
  const [css, setCss] = useState(theme.css)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState(initialTab ?? 'sections')
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop')
  const [adding, setAdding] = useState<SectionType | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const [showRevisions, setShowRevisions] = useState(false)
  const [viewing, setViewing] = useState('view:home')
  const [dragging, setDragging] = useState<number | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const targets = useLinkTargets()
  const dirty = JSON.stringify(settings) !== JSON.stringify(theme.settings) || JSON.stringify(sections) !== JSON.stringify(theme.sections) || css !== theme.css

  // ----- preview frame link -----
  const draft = useMemo(() => ({ schema: theme.schema, settings, sections, css, kind: theme.kind }), [theme.schema, theme.kind, settings, sections, css])
  const latest = useRef({ draft, selected, viewing })
  latest.current = { draft, selected, viewing }
  const post = (msg: EditorMessage) => frame.current?.contentWindow?.postMessage(msg, window.location.origin)
  const navigateFrame = (link: string) => {
    const target = resolveLink(link)
    if (target.kind === 'view') post({ type: 'nx-editor-navigate', view: target.view, params: target.params })
  }
  const go = (link: string) => { setViewing(link); navigateFrame(link) }

  // ----- undo / redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y) -----
  // Edits are grouped: a step is recorded once changes pause for 400 ms.
  const history = useRef<{ past: Doc[]; future: Doc[]; last: Doc; restoring: boolean }>({ past: [], future: [], last: { settings, sections, css }, restoring: false })
  const [, setHistoryVersion] = useState(0)
  useEffect(() => {
    const h = history.current
    const doc = { settings, sections, css }
    if (h.restoring) { h.restoring = false; return }
    const t = setTimeout(() => {
      if (JSON.stringify(h.last) === JSON.stringify(doc)) return
      h.past = [...h.past.slice(-99), h.last]
      h.future = []
      h.last = doc
      setHistoryVersion((v) => v + 1)
    }, 400)
    return () => clearTimeout(t)
  }, [settings, sections, css])
  const restore = (doc: Doc) => {
    history.current.restoring = true
    history.current.last = doc
    setSettings(doc.settings); setSections(doc.sections); setCss(doc.css)
    setHistoryVersion((v) => v + 1)
  }
  const undo = () => {
    const h = history.current
    const current = { settings: latest.current.draft.settings, sections: latest.current.draft.sections, css: latest.current.draft.css }
    // Unrecorded changes (typed in the last 400 ms) undo to the last recorded state.
    const pending = JSON.stringify(current) !== JSON.stringify(h.last)
    const prev = pending ? h.last : h.past.pop()
    if (!prev) return
    h.future.push(current)
    restore(prev)
  }
  const redo = () => {
    const h = history.current
    const next = h.future.pop()
    if (!next) return
    h.past.push(h.last)
    restore(next)
  }
  const undoRef = useRef({ undo, redo })
  undoRef.current = { undo, redo }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current.undo() }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); undoRef.current.redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const canUndo = history.current.past.length > 0 || JSON.stringify({ settings, sections, css }) !== JSON.stringify(history.current.last)
  const canRedo = history.current.future.length > 0

  useEffect(() => {
    const onMessage = (e: MessageEvent<EditorMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.type === 'nx-editor-ready') {
        post({ type: 'nx-editor-theme', theme: latest.current.draft })
        if (latest.current.selected) post({ type: 'nx-editor-select', id: latest.current.selected })
        if (latest.current.viewing !== 'view:home') navigateFrame(latest.current.viewing)
      }
      if (e.data?.type === 'nx-editor-select') setSelected(e.data.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Stream edits at most every 16 ms so typing and dragging sliders stay smooth. (A timer, not
  // requestAnimationFrame, which stops firing while the admin tab is in the background.)
  useEffect(() => {
    const id = setTimeout(() => post({ type: 'nx-editor-theme', theme: draft }), 16)
    return () => clearTimeout(id)
  }, [draft])

  const select = (id: string | null) => {
    setSelected(id)
    post({ type: 'nx-editor-select', id })
  }

  // ----- edits -----
  const update = (id: string, patch: Partial<ThemeSection>) => setSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const reorder = (from: number, to: number) => setSections((list) => {
    if (to < 0 || to >= list.length || from === to) return list
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  })
  const move = (i: number, d: number) => reorder(i, i + d)
  const remove = (id: string) => { setSections((list) => list.filter((s) => s.id !== id)); if (selected === id) setSelected(null) }
  const add = (type: SectionType) => {
    const section: ThemeSection = { id: `s-${type}-${Date.now().toString(36)}`, type, enabled: true, settings: {} }
    setSections((list) => [...list, section])
    setAdding('')
    // Select after the frame has rendered the new section.
    setTimeout(() => select(section.id), 150)
  }

  // ----- autosave (draft), publish, discard -----
  // Edits are saved as the theme's draft; the store keeps showing the published version until Publish.
  const server = useRef(theme)
  server.current = theme
  const inFlight = useRef<Promise<boolean> | null>(null)
  const saveDraft = async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current
    const doc = { settings: latest.current.draft.settings, sections: latest.current.draft.sections, css: latest.current.draft.css }
    const base = server.current
    if (JSON.stringify(doc) === JSON.stringify({ settings: base.settings, sections: base.sections, css: base.css })) { setSaveState('saved'); return true }
    setSaveState('saving')
    const run = adminApi.put<{ theme: AdminTheme }>('/api/admin/themes', { id: theme.id, draft: doc, baseRevision: base.revision })
      .then(({ theme: updated }) => {
        server.current = updated
        onSaved(updated)
        setSaveState('saved'); setSaveError('')
        return true
      })
      .catch((e) => { setSaveState('error'); setSaveError(errorMessage(e)); return false })
      .finally(() => { inFlight.current = null })
    inFlight.current = run
    return run
  }
  useEffect(() => {
    if (!dirty || saveState === 'error') return
    setSaveState('pending')
    const t = setTimeout(() => { void saveDraft() }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [settings, sections, css])

  const publish = async () => {
    const makeLive = !theme.isActive
    if (makeLive && !confirm(`Publish "${theme.name}"? It replaces the live theme and its menus become the store menus.`)) return
    setSaving(true)
    try {
      if (!(await saveDraft())) return
      const { theme: updated } = await adminApi.put<{ theme: AdminTheme }>('/api/admin/themes', { id: theme.id, baseRevision: server.current.revision, ...(makeLive ? { activate: true } : { publish: true }) })
      server.current = updated
      onSaved(updated)
      refreshStorefrontTheme()
      toast.success(makeLive ? `${theme.name} is now live` : 'Changes published')
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }
  const discard = async () => {
    if (!confirm('Discard all unpublished changes? The theme goes back to its published version.')) return
    setSaving(true)
    try {
      if (inFlight.current) await inFlight.current
      const { theme: updated } = await adminApi.put<{ theme: AdminTheme }>('/api/admin/themes', { id: theme.id, discardDraft: true, baseRevision: server.current.revision })
      server.current = updated
      onSaved(updated)
      restore(updated.published)
      setSaveState('saved'); setSaveError('')
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }
  const leave = async () => {
    if (dirty && !(await saveDraft()) && !confirm('Your latest changes could not be saved. Leave anyway?')) return
    onBack()
  }
  // Closing the tab with an unsaved change: let the browser warn.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const unpublished = theme.hasDraft || dirty

  // ----- sidebar -----
  const current = sections.find((s) => s.id === selected)
  const chrome = selected ? CHROME[selected] : undefined
  let panel: React.ReactNode
  if (current) {
    const meta: { label: string; note?: string } = SECTION_TYPES[current.type]
    panel = (
      <>
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Button variant="ghost" size="icon" onClick={() => select(null)} aria-label="Back to sections"><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-brand-ink">{meta.label}</div>
            <div className="text-[11px] text-muted-foreground">Section</div>
          </div>
          <Switch checked={current.enabled} onCheckedChange={(enabled) => update(current.id, { enabled })} aria-label="Show section" title={current.enabled ? 'Visible' : 'Hidden'} />
        </div>
        {meta.note && <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{meta.note}</p>}
        <SettingsGroups key={current.id} schema={sectionSchema(current.type)} values={current.settings} onChange={(s) => update(current.id, { settings: s })} targets={targets} />
        <div className="p-4">
          <Button variant="outline" className="w-full text-red-600 hover:text-red-700" onClick={() => remove(current.id)}><Trash2 className="size-4" /> Remove section</Button>
        </div>
      </>
    )
  } else if (chrome) {
    panel = (
      <>
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Button variant="ghost" size="icon" onClick={() => select(null)} aria-label="Back to sections"><ArrowLeft className="size-4" /></Button>
          <div className="text-sm font-semibold text-brand-ink">{chrome.label}</div>
        </div>
        <SettingsGroups key={selected} schema={theme.schema.filter((d) => chrome.groups.includes(d.group ?? ''))} values={settings} onChange={setSettings} targets={targets} />
        <p className="px-4 py-3 text-xs text-muted-foreground">Menu links are edited under Navigation. Colors and fonts are in Theme settings.</p>
      </>
    )
  } else {
    panel = (
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <TabsList className="m-2 grid h-auto grid-cols-5 [&>button]:px-1 [&>button]:text-xs">
          <TabsTrigger value="sections" title="Sections">Sections</TabsTrigger>
          <TabsTrigger value="settings" title="Theme settings">Settings</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="menus">Menus</TabsTrigger>
          <TabsTrigger value="css" title="Edit code">Code</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"><ThemePages themeId={theme.id} viewing={viewing} onPreview={go} /></TabsContent>
        <TabsContent value="menus"><ThemeMenus theme={theme} targets={targets} /></TabsContent>
        <TabsContent value="sections" className="space-y-1 px-2 pb-4">
          <p className="px-2 pb-2 text-xs text-muted-foreground">Click a section here or in the preview to edit it. Drag to reorder.</p>
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Header</div>
          <SectionRow label="Header" sub="Logo, announcement" onSelect={() => select('@header')} />
          <div className="mt-3 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template · Home page</div>
          {sections.map((sec, i) => (
            <SectionRow key={sec.id} label={String(sec.settings.title || '') || SECTION_TYPES[sec.type].label} sub={SECTION_TYPES[sec.type].label} enabled={sec.enabled} onSelect={() => select(sec.id)}
              drag={{
                draggable: true,
                onDragStart: (e) => { setDragging(i); e.dataTransfer.effectAllowed = 'move' },
                onDragOver: (e) => { if (dragging !== null) e.preventDefault() },
                onDrop: (e) => { e.preventDefault(); if (dragging !== null) reorder(dragging, i); setDragging(null) },
                onDragEnd: () => setDragging(null),
                className: dragging === i ? 'opacity-40' : undefined,
              }}>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => update(sec.id, { enabled: !sec.enabled })} aria-label={sec.enabled ? 'Hide' : 'Show'} title={sec.enabled ? 'Hide' : 'Show'}>
                {sec.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7 text-red-600 hover:text-red-700" onClick={() => remove(sec.id)} aria-label="Remove"><Trash2 className="size-3.5" /></Button>
            </SectionRow>
          ))}
          <div className="flex gap-2 px-2 pt-2">
            <Select value={adding} onValueChange={(v) => setAdding(v as SectionType)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Add section" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SECTION_TYPES) as SectionType[]).map((t) => <SelectItem key={t} value={t}>{SECTION_TYPES[t].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={!adding} onClick={() => adding && add(adding)} aria-label="Add section"><Plus className="size-4" /></Button>
          </div>
          <div className="mt-3 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Footer</div>
          <SectionRow label="Footer" sub="About text, newsletter, payments" onSelect={() => select('@footer')} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsGroups schema={theme.schema} values={settings} onChange={setSettings} targets={targets} />
        </TabsContent>
        <TabsContent value="css" className="space-y-2 px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            {theme.kind === 'html'
              ? 'Stylesheet of the imported template. It styles the template’s pages only, not the shop pages.'
              : 'Added to every storefront page. Use the theme variables, e.g. var(--brand-teal), var(--radius). Sections can be targeted with their CSS class setting.'}
          </p>
          <Textarea value={css} onChange={(e) => setCss(e.target.value)} rows={30} spellCheck={false} className="font-mono text-xs" />
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/40">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
        <Button variant="ghost" size="icon" onClick={leave} aria-label="Exit editor"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate text-sm font-semibold text-brand-ink">{theme.name} {theme.isActive ? <Badge className="bg-emerald-600">Live</Badge> : <Badge variant="outline">Draft</Badge>}</div>
        </div>
        <div className="mx-auto flex items-center gap-2">
        <Select value={viewing} onValueChange={go}>
          <SelectTrigger size="sm" className="h-8 w-52" aria-label="Page to preview"><SelectValue placeholder="Page" /></SelectTrigger>
          <SelectContent>
            {previewOptions(targets).map((g) => g.items.length ? (
              <SelectGroup key={g.group}><SelectLabel>{g.group}</SelectLabel>{g.items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectGroup>
            ) : null)}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Preview size">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => {
            const Icon = DEVICES[d].icon
            return <Button key={d} variant={device === d ? 'secondary' : 'ghost'} size="icon" className="size-8" onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} preview`} title={`${d[0].toUpperCase()}${d.slice(1)} preview`}><Icon className="size-4" /></Button>
          })}
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon" className="size-8" disabled={!canUndo} onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={!canRedo} onClick={redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 className="size-4" /></Button>
        </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-xs sm:flex" role="status" aria-live="polite">
            {saveState === 'saving' || saveState === 'pending'
              ? <><Loader2 className="size-3.5 animate-spin text-muted-foreground" /> Saving draft…</>
              : saveState === 'error'
                ? <><span className="max-w-56 truncate text-red-600" title={saveError}>Not saved: {saveError}</span><Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void saveDraft()}>Retry</Button></>
                : unpublished
                  ? <span className="text-amber-700">Draft saved · not published</span>
                  : <span className="text-muted-foreground">{theme.isActive ? 'Published' : 'Saved'}</span>}
          </span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowRevisions(true)} aria-label="Version history" title="Version history"><History className="size-4" /></Button>
          <Button variant="ghost" size="sm" disabled={!unpublished || saving} onClick={discard}>Discard</Button>
          <Button size="sm" variant="outline" disabled={saving || saveState === 'saving'} onClick={() => void saveDraft()} title="Drafts save automatically"><Save className="size-4" /> Save</Button>
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" disabled={saving || (theme.isActive && !unpublished)} onClick={publish}>
            <CheckCircle2 className="size-4" /> {saving ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-background">{panel}</aside>
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden p-3">
          <iframe
            ref={frame}
            src={`/?${EDITOR_PARAM}=1`}
            title="Storefront preview"
            className={`h-full rounded-md border border-border bg-white shadow-sm transition-[width] duration-300 ${DEVICES[device].width}`}
          />
        </div>
      </div>
      <RevisionsDialog open={showRevisions} onOpenChange={setShowRevisions} theme={theme} onRestored={(updated) => {
        server.current = updated
        onSaved(updated)
        restore(updated.published)
        setSaveState('saved'); setSaveError('')
        refreshStorefrontTheme()
      }} />
    </div>
  )
}

/** Published versions of a theme; any of them can be published again. */
function RevisionsDialog({ open, onOpenChange, theme, onRestored }: { open: boolean; onOpenChange: (o: boolean) => void; theme: AdminTheme; onRestored: (t: AdminTheme) => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let live = true
    adminApi.get<Revision[]>(`/api/admin/themes/revisions?theme=${theme.id}`)
      .then((r) => { if (live) setRows(r) })
      .catch((e) => { if (live) { setRows([]); toast.error(errorMessage(e)) } })
    return () => { live = false }
  }, [open, theme.id, theme.revision])
  const rollback = async (rev: Revision) => {
    if (!confirm(`Publish version #${rev.number} again?${theme.hasDraft ? ' Unpublished changes are discarded.' : ''}`)) return
    setBusy(rev.id)
    try {
      const { theme: updated } = await adminApi.post<{ theme: AdminTheme }>('/api/admin/themes/revisions', { theme: theme.id, revision: rev.id, baseRevision: theme.revision })
      onRestored(updated)
      toast.success(`Version #${rev.number} published`)
      onOpenChange(false)
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(null) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Every publish is kept. Roll back to republish an earlier version{theme.isActive ? ' on the live store' : ''}.</DialogDescription>
        </DialogHeader>
        {!rows ? <Skeleton className="h-24" /> : !rows.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No published versions yet. Publish to create the first one.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">#{r.number} · {r.note || 'Published'} {i === 0 && <Badge variant="outline" className="ml-1">Current</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}{r.author ? ` · ${r.author}` : ''}</div>
                </div>
                {i > 0 && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => rollback(r)}><RotateCcw className="size-3.5" /> {busy === r.id ? 'Restoring…' : 'Roll back'}</Button>}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** What the theme's adapter supports, detected at install. */
function ReportDialog({ theme, onClose }: { theme: AdminTheme | null; onClose: () => void }) {
  const r = theme?.report
  return (
    <Dialog open={!!theme} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compatibility report</DialogTitle>
          <DialogDescription>{theme?.name}</DialogDescription>
        </DialogHeader>
        {r && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={r.level === 'A' ? 'bg-emerald-600' : r.level === 'D' ? 'bg-red-600' : 'bg-amber-600'}>Level {r.level}</Badge>
              <span className="font-medium">{LEVELS[r.level]}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Detected</dt><dd>{r.detected} ({Math.round(r.confidence * 100)}%)</dd>
              <dt className="text-muted-foreground">Adapter</dt><dd>{r.label} · {r.adapter}@{r.adapterVersion}</dd>
              <dt className="text-muted-foreground">Pages</dt><dd>{r.counts.pages}</dd>
              <dt className="text-muted-foreground">Home sections</dt><dd>{r.counts.sections}</dd>
              <dt className="text-muted-foreground">Settings</dt><dd>{r.counts.settings}</dd>
            </dl>
            <ReportList title="Editable" items={r.capabilities} />
            <ReportList title="Not supported" items={r.unsupported} />
            <ReportList title="Install notes" items={r.warnings} />
            <ReportList title="To improve compatibility" items={r.recommendations} />
            <a className="text-xs text-brand-teal underline" href="/docs/theme-format.md" target="_blank" rel="noreferrer">Theme format and adapters guide</a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )
}

// ---------- section ----------

export function ThemesSection() {
  const { items, setItems, loading, error, reload } = useAdminList<AdminTheme>('/api/admin/themes')
  const [editing, setEditing] = useState<{ id: string; tab?: string } | null>(null)
  const [warnings, setWarnings] = useState<{ name: string; list: string[] } | null>(null)
  const [report, setReport] = useState<AdminTheme | null>(null)
  const current = items.find((t) => t.id === editing?.id)
  const live = items.find((t) => t.isActive)
  const library = items.filter((t) => !t.isActive)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- leave the customizer if its theme was deleted
  useEffect(() => { if (editing && !loading && !current) setEditing(null) }, [editing, loading, current])

  if (error) return <LoadError message={error} onRetry={reload} />
  if (current) {
    return <Customizer key={current.id} theme={current} initialTab={editing?.tab} onBack={() => setEditing(null)} onSaved={(t) => {
      // Becoming the live theme deactivates another one: refetch the list then.
      if (t.isActive !== current.isActive) reload()
      else setItems((list) => list.map((x) => (x.id === t.id ? t : x)))
    }} />
  }

  return (
    <div className="space-y-3">
      <SectionHeader title="Themes" subtitle="Install, publish and edit themes: home sections, style settings, pages, menus and CSS." >
        <Button variant="outline" size="sm" asChild>
          <a href="/docs/theme-format.md" target="_blank" rel="noreferrer">Theme format guide</a>
        </Button>
      </SectionHeader>
      <InstallBar onInstalled={(theme, list) => {
        reload()
        if (theme.isActive) refreshStorefrontTheme()
        toast.success(`${theme.name} installed`)
        if (list.length) setWarnings({ name: theme.name, list })
      }} />
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <>
          {live && <ThemeRow theme={live} current onOpen={(id, tab) => setEditing({ id, tab })} onChanged={reload} onReport={setReport} />}
          <div>
            <h3 className="mb-1.5 mt-4 text-sm font-semibold text-brand-ink">Theme library</h3>
            <p className="mb-2 text-xs text-muted-foreground">Edit and preview themes without changing the live store. Publish one when it’s ready.</p>
            <Card className="py-0"><CardContent className="divide-y divide-border p-0">
              {library.map((t) => <ThemeRow key={t.id} theme={t} onOpen={(id, tab) => setEditing({ id, tab })} onChanged={reload} onReport={setReport} />)}
              {!library.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No other themes. Upload one or duplicate the current theme.</p>}
            </CardContent></Card>
          </div>
        </>
      )}

      <ReportDialog theme={report} onClose={() => setReport(null)} />
      <Dialog open={!!warnings} onOpenChange={(o) => !o && setWarnings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-500" /> {warnings?.name} installed with notes</DialogTitle>
            <DialogDescription>The theme works; review these before publishing.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">{warnings?.list.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <DialogFooter><Button onClick={() => setWarnings(null)}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
