'use client'
// Theme library (upload, install, activate, export, delete) and the customizer
// (click-to-edit sections, theme settings, custom CSS) with a live storefront preview.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, Download, Eye, EyeOff, Loader2,
  Monitor, Palette, Pencil, Plus, RotateCcw, Save, Smartphone, Trash2, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import {
  MENU_HANDLES, SECTION_TYPES, sectionSchema, type MenuHandle, type MenuItem, type SectionType, type ThemeSection, type ThemeSettingDef, type ThemeSettings, type ThemeValue,
} from '@/shared/theme'
import { EDITOR_PARAM, type EditorMessage } from '@/frontend/components/theme/editor-bridge'
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
  schema: ThemeSettingDef[]
  settings: ThemeSettings
  sections: ThemeSection[]
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

function ThemeRow({ theme, onCustomize, onChanged }: { theme: AdminTheme; onCustomize: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const swatches = ['color_primary', 'color_accent', 'color_highlight', 'color_text', 'color_surface'].map((k) => String(theme.settings[k] ?? ''))

  const activate = async () => {
    setBusy(true)
    try {
      await adminApi.put('/api/admin/themes', { id: theme.id, activate: true })
      toast.success(`${theme.name} is now live`)
      onChanged()
      refreshStorefrontTheme()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Delete "${theme.name}"?${theme.pageCount ? ` Its ${theme.pageCount} imported page(s) are deleted too.` : ''}`)) return
    setBusy(true)
    try {
      await adminApi.del(`/api/admin/themes?id=${theme.id}`)
      toast.success('Theme deleted')
      onChanged()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${theme.isActive ? 'bg-brand-teal/5' : ''}`}>
      <div className="flex h-8 w-16 shrink-0 overflow-hidden rounded border border-border">
        {swatches.map((c, i) => <div key={i} className="flex-1" style={{ background: c || '#eee' }} />)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-brand-ink">{theme.name}</span>
          {theme.isActive && <Badge className="h-5 bg-emerald-600 px-1.5 text-[10px]">Live</Badge>}
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">{theme.kind === 'html' ? 'HTML' : 'Native'}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          v{theme.version}{theme.author ? ` · ${theme.author}` : ''}{theme.pageCount ? ` · ${theme.pageCount} page${theme.pageCount === 1 ? '' : 's'}` : ''}{theme.description ? ` · ${theme.description}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" className="h-8 bg-brand-teal hover:bg-brand-teal-dark" onClick={onCustomize}><Palette className="size-4" /> Edit</Button>
        {!theme.isActive && <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={activate}><CheckCircle2 className="size-4" /> Publish</Button>}
        <Button size="icon" variant="ghost" className="size-8" asChild title="Export"><a href={`/api/admin/themes/export?id=${theme.id}`} aria-label="Export"><Download className="size-4" /></a></Button>
        {!theme.isActive && <Button size="icon" variant="ghost" className="size-8 text-red-600 hover:text-red-700" disabled={busy} onClick={remove} aria-label="Delete" title="Delete"><Trash2 className="size-4" /></Button>}
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

function SectionRow({ label, sub, enabled, onSelect, children }: { label: string; sub?: string; enabled?: boolean; onSelect: () => void; children?: React.ReactNode }) {
  return (
    <div className={`group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted ${enabled === false ? 'opacity-50' : ''}`}>
      <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="truncate text-sm font-medium text-brand-ink">{label}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </button>
      <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{children}</div>
    </div>
  )
}

/** The theme's own pages: click to preview in the frame, pencil to edit. */
function ThemePages({ themeId, previewing, onPreview }: { themeId: string; previewing: string; onPreview: (slug: string) => void }) {
  const { items, loading, reload } = useAdminList<AdminPage>('/api/admin/pages')
  const [draft, setDraft] = useState<Draft | null>(null)
  const pages = items.filter((p) => p.theme?.id === themeId)
  return (
    <div className="space-y-1 px-2 pb-4">
      <p className="px-2 pb-2 text-xs text-muted-foreground">Pages that came with this theme. Click to preview, pencil to edit content, styles and SEO.</p>
      <SectionRow label={previewing ? 'Home page' : 'Home page (previewing)'} sub='Sections' onSelect={() => onPreview('')} />
      {loading && <Skeleton className="h-10 w-full" />}
      {!loading && !pages.length && <p className="px-2 py-3 text-xs text-muted-foreground">This theme has no pages of its own. Store pages are under Pages.</p>}
      {pages.map((p) => (
        <SectionRow key={p.id} label={p.title} sub={`/?page=${p.slug}${p.isPublished ? '' : ' · draft'}`} onSelect={() => onPreview(p.slug)}>
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

function Customizer({ theme, onBack, onSaved }: { theme: AdminTheme; onBack: () => void; onSaved: (t: AdminTheme) => void }) {
  const [settings, setSettings] = useState(theme.settings)
  const [sections, setSections] = useState(theme.sections)
  const [css, setCss] = useState(theme.css)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState('sections')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [adding, setAdding] = useState<SectionType | ''>('')
  const [saving, setSaving] = useState(false)
  const [previewPage, setPreviewPage] = useState(theme.kind === 'html' ? String(sections.find((s) => s.type === 'page')?.settings.page ?? '') : '')
  const frame = useRef<HTMLIFrameElement>(null)
  const targets = useLinkTargets()
  const dirty = JSON.stringify(settings) !== JSON.stringify(theme.settings) || JSON.stringify(sections) !== JSON.stringify(theme.sections) || css !== theme.css

  // ----- preview frame link -----
  const draft = useMemo(() => ({ schema: theme.schema, settings, sections, css, kind: theme.kind }), [theme.schema, theme.kind, settings, sections, css])
  const latest = useRef({ draft, selected })
  latest.current = { draft, selected }
  const post = (msg: EditorMessage) => frame.current?.contentWindow?.postMessage(msg, window.location.origin)

  useEffect(() => {
    const onMessage = (e: MessageEvent<EditorMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.type === 'nx-editor-ready') {
        post({ type: 'nx-editor-theme', theme: latest.current.draft })
        if (latest.current.selected) post({ type: 'nx-editor-select', id: latest.current.selected })
      }
      if (e.data?.type === 'nx-editor-select') setSelected(e.data.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Stream edits, at most once per frame, so typing and dragging sliders stay smooth.
  useEffect(() => {
    const id = requestAnimationFrame(() => post({ type: 'nx-editor-theme', theme: draft }))
    return () => cancelAnimationFrame(id)
  }, [draft])

  const select = (id: string | null) => {
    setSelected(id)
    post({ type: 'nx-editor-select', id })
  }

  // ----- edits -----
  const update = (id: string, patch: Partial<ThemeSection>) => setSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const move = (i: number, d: number) => setSections((list) => {
    const j = i + d
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const remove = (id: string) => { setSections((list) => list.filter((s) => s.id !== id)); if (selected === id) setSelected(null) }
  const add = (type: SectionType) => {
    const section: ThemeSection = { id: `s-${type}-${Date.now().toString(36)}`, type, enabled: true, settings: {} }
    setSections((list) => [...list, section])
    setAdding('')
    // Select after the frame has rendered the new section.
    setTimeout(() => select(section.id), 150)
  }

  const save = async (activate = false) => {
    setSaving(true)
    try {
      const { theme: updated } = await adminApi.put<{ theme: AdminTheme }>('/api/admin/themes', { id: theme.id, settings, sections, css, ...(activate ? { activate: true } : {}) })
      onSaved(updated)
      refreshStorefrontTheme()
      toast.success(activate ? `${theme.name} saved and published` : 'Theme saved')
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }
  const discard = () => { setSettings(theme.settings); setSections(theme.sections); setCss(theme.css) }
  const leave = () => { if (!dirty || confirm('Leave without saving your changes?')) onBack() }

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
          <TabsTrigger value="sections">Home</TabsTrigger>
          <TabsTrigger value="settings">Style</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="menus">Menus</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"><ThemePages themeId={theme.id} previewing={previewPage} onPreview={setPreviewPage} /></TabsContent>
        <TabsContent value="menus"><ThemeMenus theme={theme} targets={targets} /></TabsContent>
        <TabsContent value="sections" className="space-y-1 px-2 pb-4">
          <p className="px-2 pb-2 text-xs text-muted-foreground">Click a section here or in the preview to edit it.</p>
          <SectionRow label="Header" sub="Logo, announcement" onSelect={() => select('@header')} />
          <div className="my-1 border-t border-border" />
          {sections.map((sec, i) => (
            <SectionRow key={sec.id} label={String(sec.settings.title || '') || SECTION_TYPES[sec.type].label} sub={SECTION_TYPES[sec.type].label} enabled={sec.enabled} onSelect={() => select(sec.id)}>
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
          <div className="my-1 border-t border-border" />
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
        <div className="mx-auto flex rounded-md border border-border p-0.5">
          <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="icon" className="size-8" onClick={() => setDevice('desktop')} aria-label="Desktop preview"><Monitor className="size-4" /></Button>
          <Button variant={device === 'mobile' ? 'secondary' : 'ghost'} size="icon" className="size-8" onClick={() => setDevice('mobile')} aria-label="Mobile preview"><Smartphone className="size-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="hidden text-xs text-amber-700 sm:inline">Unsaved changes</span>}
          <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={discard}>Discard</Button>
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!dirty || saving} onClick={() => save()}><Save className="size-4" /> {saving ? 'Saving…' : 'Save'}</Button>
          {!theme.isActive && <Button size="sm" variant="outline" disabled={saving} onClick={() => save(true)}><CheckCircle2 className="size-4" /> Save & publish</Button>}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-background">{panel}</aside>
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden p-3">
          <iframe
            ref={frame}
            src={previewPage ? `/?page=${encodeURIComponent(previewPage)}&${EDITOR_PARAM}=1` : `/?${EDITOR_PARAM}=1`}
            title="Storefront preview"
            className={`h-full rounded-md border border-border bg-white shadow-sm transition-[width] duration-300 ${device === 'mobile' ? 'w-[390px]' : 'w-full'}`}
          />
        </div>
      </div>
    </div>
  )
}

// ---------- section ----------

export function ThemesSection() {
  const { items, setItems, loading, error, reload } = useAdminList<AdminTheme>('/api/admin/themes')
  const [editing, setEditing] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<{ name: string; list: string[] } | null>(null)
  const current = items.find((t) => t.id === editing)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- leave the customizer if its theme was deleted
  useEffect(() => { if (editing && !loading && !current) setEditing(null) }, [editing, loading, current])

  if (error) return <LoadError message={error} onRetry={reload} />
  if (current) {
    return <Customizer key={current.id} theme={current} onBack={() => setEditing(null)} onSaved={(t) => { setItems(items.map((x) => (x.id === t.id ? t : x))); if (t.isActive) reload() }} />
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
        <Card className="py-0"><CardContent className="divide-y divide-border p-0">
          {items.map((t) => <ThemeRow key={t.id} theme={t} onCustomize={() => setEditing(t.id)} onChanged={reload} />)}
        </CardContent></Card>
      )}

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
