'use client'
// Theme library (upload, install, activate, export, delete) and the customizer
// (theme settings, homepage sections, custom CSS) with a live storefront preview.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Download, Eye, EyeOff, Loader2, Palette, Plus,
  RefreshCw, Save, Trash2, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import {
  SECTION_TYPES, type SectionField, type SectionType, type ThemeSection, type ThemeSettingDef, type ThemeSettings, type ThemeValue,
} from '@/shared/theme'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { LinkPicker, useLinkTargets, type LinkTargets } from './link-picker'
import { refreshStorefrontTheme } from './navigation'
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

const FIELD_LABELS: Record<SectionField, string> = {
  eyebrow: 'Small heading', title: 'Heading', text: 'Text', button_label: 'Button label', link: 'Link', html: 'HTML content', page: 'Page',
}

// ---------- library ----------

function InstallCard({ onInstalled }: { onInstalled: (theme: AdminTheme, warnings: string[]) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [activate, setActivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const install = async () => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('activate', String(activate))
    setBusy(true)
    try {
      const res = await adminApi.post<{ theme: AdminTheme; warnings: string[] }>('/api/admin/themes', form)
      onInstalled(res.theme, res.warnings)
      setFile(null)
      if (input.current) input.current.value = ''
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Upload className="size-4 text-brand-teal" /> Add a theme</CardTitle>
        <CardDescription>
          Upload a <strong>.zip</strong>: a native theme package (<code>theme.json</code>) or a static <strong>HTML template</strong> from ThemeForest, Envato or any marketplace.
          WordPress and Shopify themes can’t run here; use the HTML version of the theme.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input ref={input} type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="cursor-pointer sm:max-w-sm" />
        <label className="flex items-center gap-2 text-sm"><Switch checked={activate} onCheckedChange={setActivate} disabled={busy} /> Publish after install</label>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark sm:ml-auto" disabled={!file || busy} onClick={install}>
          {busy ? <><Loader2 className="size-4 animate-spin" /> Installing…</> : <><Upload className="size-4" /> Install</>}
        </Button>
      </CardContent>
      {busy && <p className="px-6 pb-5 text-xs text-muted-foreground">Uploading the template’s images and fonts. Large templates can take a minute.</p>}
    </Card>
  )
}

function ThemeCard({ theme, onCustomize, onChanged }: { theme: AdminTheme; onCustomize: () => void; onChanged: () => void }) {
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
    <Card className={theme.isActive ? 'border-brand-teal ring-1 ring-brand-teal' : ''}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex h-20 overflow-hidden rounded-lg border border-border">
          {swatches.map((c, i) => <div key={i} className="flex-1" style={{ background: c || '#eee' }} />)}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-brand-ink">{theme.name}</h3>
            {theme.isActive && <Badge className="bg-emerald-600">Live</Badge>}
            <Badge variant="outline" className="text-[10px] uppercase">{theme.kind === 'html' ? 'HTML template' : 'Native'}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">v{theme.version}{theme.author ? ` · ${theme.author}` : ''}{theme.pageCount ? ` · ${theme.pageCount} page${theme.pageCount === 1 ? '' : 's'}` : ''}</p>
          {theme.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{theme.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" onClick={onCustomize}><Palette className="size-4" /> Customize</Button>
          {!theme.isActive && <Button size="sm" variant="outline" disabled={busy} onClick={activate}><CheckCircle2 className="size-4" /> Publish</Button>}
          <Button size="sm" variant="ghost" asChild><a href={`/api/admin/themes/export?id=${theme.id}`}><Download className="size-4" /> Export</a></Button>
          {!theme.isActive && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={remove}><Trash2 className="size-4" /> Delete</Button>}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- customizer ----------

function SettingInput({ def, value, onChange }: { def: ThemeSettingDef; value: ThemeValue | undefined; onChange: (v: ThemeValue) => void }) {
  const str = value === undefined ? '' : String(value)
  switch (def.type) {
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(str) ? str : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" aria-label={def.label} />
          <Input value={str} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
        </div>
      )
    case 'checkbox':
      return <Switch checked={value === true} onCheckedChange={onChange} aria-label={def.label} />
    case 'range':
      return (
        <div className="flex items-center gap-3">
          <input type="range" min={def.min ?? 0} max={def.max ?? 100} step={def.step ?? 1} value={Number(value ?? def.min ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--brand-teal)]" aria-label={def.label} />
          <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{String(value ?? '')}{def.unit ?? ''}</span>
        </div>
      )
    case 'select':
      return (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{(def.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )
    case 'image':
      return <ImageUpload label="" value={str} onChange={onChange} folder="themes" />
    case 'textarea':
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} rows={3} />
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} />
  }
}

function SettingsPanel({ schema, settings, onChange }: { schema: ThemeSettingDef[]; settings: ThemeSettings; onChange: (s: ThemeSettings) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, ThemeSettingDef[]>()
    for (const def of schema) map.set(def.group ?? 'General', [...(map.get(def.group ?? 'General') ?? []), def])
    return [...map.entries()]
  }, [schema])
  return (
    <div className="space-y-4">
      {groups.map(([group, defs]) => (
        <Card key={group}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{group}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {defs.map((def) => (
              <div key={def.id} className={`grid gap-1.5 ${def.type === 'image' || def.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                <Label className="text-xs font-medium text-muted-foreground">{def.label}</Label>
                <SettingInput def={def} value={settings[def.id]} onChange={(v) => onChange({ ...settings, [def.id]: v })} />
                {def.help && <p className="text-[11px] text-muted-foreground">{def.help}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SectionsPanel({ sections, onChange, targets }: { sections: ThemeSection[]; onChange: (s: ThemeSection[]) => void; targets: LinkTargets }) {
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<SectionType | ''>('')
  const update = (i: number, next: ThemeSection) => onChange(sections.map((s, j) => (j === i ? next : s)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = (type: SectionType) => {
    const section: ThemeSection = { id: `s-${type}-${Date.now().toString(36)}`, type, enabled: true, settings: {} }
    onChange([...sections, section])
    setOpen(section.id)
    setAdding('')
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Homepage sections, top to bottom. Leave a heading blank to use the default text.</p>
      {sections.map((sec, i) => {
        const meta = SECTION_TYPES[sec.type]
        const fields = meta.fields as readonly SectionField[]
        return (
          <Card key={sec.id} className={sec.enabled ? '' : 'opacity-60'}>
            <div className="flex items-center gap-2 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === sec.id ? null : sec.id)}>
                <div className="truncate text-sm font-semibold text-brand-ink">{sec.settings.title || meta.label}</div>
                <div className="text-[11px] text-muted-foreground">{meta.label}{sec.type === 'page' && sec.settings.page ? ` · ${sec.settings.page}` : ''}</div>
              </button>
              <Button variant="ghost" size="icon" onClick={() => update(i, { ...sec, enabled: !sec.enabled })} aria-label={sec.enabled ? 'Hide' : 'Show'} title={sec.enabled ? 'Hide' : 'Show'}>
                {sec.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-4" /></Button>
              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => onChange(sections.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="size-4" /></Button>
            </div>
            {open === sec.id && (
              <CardContent className="space-y-3 border-t border-border pt-4">
                {'note' in meta && <p className="text-xs text-muted-foreground">{meta.note}</p>}
                {fields.length === 0 && <p className="text-xs text-muted-foreground">This section has no options.</p>}
                {fields.map((f) => (
                  <div key={f} className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{FIELD_LABELS[f]}</Label>
                    {f === 'html' || f === 'text'
                      ? <Textarea value={sec.settings[f] ?? ''} onChange={(e) => update(i, { ...sec, settings: { ...sec.settings, [f]: e.target.value } })} rows={f === 'html' ? 10 : 3} className={f === 'html' ? 'font-mono text-xs' : ''} />
                      : f === 'link'
                        ? <LinkPicker value={sec.settings.link ?? ''} onChange={(link) => update(i, { ...sec, settings: { ...sec.settings, link } })} targets={targets} allowNone />
                        : f === 'page'
                          ? (
                            <Select value={sec.settings.page || undefined} onValueChange={(page) => update(i, { ...sec, settings: { ...sec.settings, page } })}>
                              <SelectTrigger className="w-full"><SelectValue placeholder={targets.pages.length ? 'Choose a page' : 'Create a page under Pages first'} /></SelectTrigger>
                              <SelectContent>{targets.pages.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                            </Select>
                          )
                          : <Input value={sec.settings[f] ?? ''} onChange={(e) => update(i, { ...sec, settings: { ...sec.settings, [f]: e.target.value } })} />}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}
      <div className="flex gap-2 pt-2">
        <Select value={adding} onValueChange={(v) => setAdding(v as SectionType)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose a section to add" /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SECTION_TYPES) as SectionType[]).map((t) => <SelectItem key={t} value={t}>{SECTION_TYPES[t].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!adding} onClick={() => adding && add(adding)}><Plus className="size-4" /> Add section</Button>
      </div>
    </div>
  )
}

function Customizer({ theme, onBack, onSaved }: { theme: AdminTheme; onBack: () => void; onSaved: (t: AdminTheme) => void }) {
  const [settings, setSettings] = useState(theme.settings)
  const [sections, setSections] = useState(theme.sections)
  const [css, setCss] = useState(theme.css)
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const targets = useLinkTargets()
  const dirty = JSON.stringify(settings) !== JSON.stringify(theme.settings) || JSON.stringify(sections) !== JSON.stringify(theme.sections) || css !== theme.css

  const save = async (activate = false) => {
    setSaving(true)
    try {
      const { theme: updated } = await adminApi.put<{ theme: AdminTheme }>('/api/admin/themes', { id: theme.id, settings, sections, css, ...(activate ? { activate: true } : {}) })
      onSaved(updated)
      setPreviewKey((k) => k + 1)
      refreshStorefrontTheme()
      toast.success(activate ? `${theme.name} saved and published` : 'Theme saved')
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }

  const discard = () => { setSettings(theme.settings); setSections(theme.sections); setCss(theme.css) }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to themes"><ArrowLeft className="size-4" /></Button>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-brand-ink">{theme.name} {theme.isActive && <Badge className="bg-emerald-600">Live</Badge>}</h2>
            <p className="text-sm text-muted-foreground">{theme.isActive ? 'Changes go live when you save.' : 'This theme is not live. Save, then publish to use it.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
          <Button variant="outline" disabled={!dirty || saving} onClick={discard}>Discard</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!dirty || saving} onClick={() => save()}><Save className="size-4" /> {saving ? 'Saving…' : 'Save'}</Button>
          {!theme.isActive && <Button variant="outline" disabled={saving} onClick={() => save(true)}><CheckCircle2 className="size-4" /> Save & publish</Button>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Tabs defaultValue="settings">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="settings">Theme settings</TabsTrigger>
            <TabsTrigger value="sections">Homepage</TabsTrigger>
            <TabsTrigger value="css">Custom CSS</TabsTrigger>
          </TabsList>
          <TabsContent value="settings"><SettingsPanel schema={theme.schema} settings={settings} onChange={setSettings} /></TabsContent>
          <TabsContent value="sections"><SectionsPanel sections={sections} onChange={setSections} targets={targets} /></TabsContent>
          <TabsContent value="css" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {theme.kind === 'html'
                ? 'Stylesheet of the imported template. It styles the template’s pages only, not the shop pages.'
                : 'Added to every storefront page. Use the theme variables, e.g. var(--brand-teal), var(--radius).'}
            </p>
            <Textarea value={css} onChange={(e) => setCss(e.target.value)} rows={28} spellCheck={false} className="font-mono text-xs" />
          </TabsContent>
        </Tabs>

        <Card className="hidden overflow-hidden xl:block">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">{theme.isActive ? 'Live storefront (updates after Save)' : 'Live storefront — publish this theme to preview it here'}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setPreviewKey((k) => k + 1)} aria-label="Reload preview"><RefreshCw className="size-4" /></Button>
              <Button variant="ghost" size="sm" asChild><a href="/" target="_blank" rel="noreferrer">Open</a></Button>
            </div>
          </div>
          <iframe key={previewKey} src="/" title="Storefront preview" className="h-[75vh] w-full border-0" />
        </Card>
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
    <div className="space-y-5">
      <SectionHeader title="Themes" subtitle="Install themes, choose the live one, and customize colors, fonts, branding, homepage sections and CSS." >
        <Button variant="outline" asChild>
          <a href="/docs/theme-format.md" target="_blank" rel="noreferrer">Theme format guide</a>
        </Button>
      </SectionHeader>
      <InstallCard onInstalled={(theme, list) => {
        reload()
        if (theme.isActive) refreshStorefrontTheme()
        toast.success(`${theme.name} installed`)
        if (list.length) setWarnings({ name: theme.name, list })
      }} />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => <ThemeCard key={t.id} theme={t} onCustomize={() => setEditing(t.id)} onChanged={reload} />)}
        </div>
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
