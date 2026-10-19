'use client'
// Page editor: section tree (drag to reorder), live preview iframe (postMessage, device sizes) and the settings
// form. Drafts autosave with the revision they were loaded at; publish runs the pre-publish checklist.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Eye, EyeOff, GripVertical, History, Loader2, Monitor, Plus, Redo2, Rocket, Search as SeoIcon, Smartphone, Tablet, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Switch } from '@/frontend/components/ui/switch'
import { Textarea } from '@/frontend/components/ui/textarea'
import { SECTIONS, defaultSettings, newId, type SectionInstance, type SectionType } from '@/shared/sections/registry'
import type { ChecklistItem, Seo } from '@/shared/store-pages'
import { splitFreeformSection } from '@/shared/freeform-edit'
import type { RichText } from '@/shared/sections/fields'
import type { PreviewEvent, PreviewMessage } from '@/frontend/components/sections/preview-client'
import type { DesignTokens } from '@/shared/design-tokens'
import { AdminApiError, adminApi, errorMessage } from '../admin-api'
import { SectionSettings, type Device } from './settings-form'
import type { EditorContext } from './fields'

type PageData = {
  page: { id: string; type: string; slug: string; title: string; published: boolean; url: string | null; seo: Seo }
  draft: { versionId: string; version: number; status: string; revision: number; sections: SectionInstance[] } | null
  versions: { id: string; version: number; status: string; createdAt: string; publishedAt: string | null }[]
}

/** Plain text typed in the preview as rich text, keeping the marks of the layer's first run (bold, link, …). */
function plainToRichText(text: string, marks: Record<string, unknown>): RichText {
  const { text: _old, ...keep } = marks
  void _old
  return text.split(/\n{2,}/).map((p) => ({ type: 'p' as const, runs: [{ ...keep, text: p }] }))
}

const WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' }
const HISTORY_LIMIT = 100

function SortableRow({ section, selected, onSelect, onToggle, onDuplicate, onDelete }: { section: SectionInstance; selected: boolean; onSelect: () => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const def = SECTIONS[section.type]
  const title = String(section.settings.title || section.settings.text || section.settings.logoText || section.settings.label || '') || def.name
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-1 rounded-md border bg-background px-1 py-1 ${selected ? 'border-brand-teal ring-1 ring-brand-teal' : ''} ${isDragging ? 'z-10 shadow-lg' : ''} ${section.hidden ? 'opacity-50' : ''}`}>
      <button type="button" className="cursor-grab p-1 text-muted-foreground" aria-label={`Reorder ${def.name}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{def.name}{section.mappingConfidence < 0.6 && section.figmaNodeId && <AlertTriangle className="size-3 text-amber-600" aria-label="Low mapping confidence" />}</div>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onToggle} aria-label={section.hidden ? 'Show section' : 'Hide section'}>{section.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDuplicate} aria-label="Duplicate section"><Copy className="size-3.5" /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDelete} aria-label="Delete section"><Trash2 className="size-3.5" /></Button>
    </li>
  )
}

export function PageEditor({ pageId, onBack }: { pageId: string; onBack: () => void }) {
  const [data, setData] = useState<PageData | null>(null)
  const [sections, setSections] = useState<SectionInstance[]>([])
  const [revision, setRevision] = useState(0)
  const [selected, setSelectedSection] = useState<string | null>(null)
  // Layer of a Figma section selected in the layer tree or by clicking the preview.
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const setSelected = (id: string | null, node: string | null = null) => { setSelectedSection(id); setSelectedNode(node) }
  const [device, setDevice] = useState<Device>('desktop')
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'conflict'>('idle')
  const [past, setPast] = useState<SectionInstance[][]>([])
  const [future, setFuture] = useState<SectionInstance[][]>([])
  const [token, setToken] = useState<string | null>(null)
  const [ctx, setCtx] = useState<EditorContext>({ pages: [], tokens: null })
  const [panel, setPanel] = useState<'none' | 'add' | 'seo' | 'history' | 'publish'>('none')
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null)
  const iframe = useRef<HTMLIFrameElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ sections, revision })
  useEffect(() => { latest.current = { sections, revision } }, [sections, revision])

  const load = useCallback(async () => {
    const d = await adminApi.get<PageData>(`/api/design/pages/${pageId}`)
    setData(d); setSections(d.draft?.sections ?? []); setRevision(d.draft?.status === 'DRAFT' ? d.draft.revision : 0); setPast([]); setFuture([]); setSaving('idle')
  }, [pageId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetches; state is set when they resolve
    load().catch((e) => toast.error(errorMessage(e)))
    adminApi.get<{ token: string }>(`/api/design/pages/${pageId}/preview-token`).then((t) => setToken(t.token)).catch(() => {})
    Promise.all([
      adminApi.get<{ slug: string; title: string; type: string }[]>('/api/design/pages'),
      adminApi.get<{ editing: { tokens: DesignTokens | null } | null }>('/api/design/system'),
    ]).then(([pages, ds]) => setCtx({ pages, tokens: ds.editing?.tokens ?? null })).catch(() => {})
  }, [pageId, load])

  // Live preview: post the current sections to the iframe on every change.
  const post = useCallback(() => iframe.current?.contentWindow?.postMessage({ type: 'nexecoms:preview', sections: latest.current.sections, selectedId: selected, selectedNodeId: selectedNode } satisfies PreviewMessage, window.location.origin), [selected, selectedNode])
  useEffect(() => { post() }, [sections, selected, post])

  const save = useCallback(async () => {
    setSaving('saving')
    try {
      const res = await adminApi.put<{ revision: number }>(`/api/design/pages/${pageId}/draft`, { sections: latest.current.sections, revision: latest.current.revision })
      setRevision(res.revision); setSaving('saved')
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409) { setSaving('conflict'); toast.error(e.message) }
      else { setSaving('pending'); toast.error(errorMessage(e)) }
    }
  }, [pageId])

  const change = (next: SectionInstance[], record = true) => {
    if (saving === 'conflict') { toast.error('Reload the page before making more changes.'); return }
    if (record) { setPast((p) => [...p.slice(-HISTORY_LIMIT), sections]); setFuture([]) }
    setSections(next)
    setSaving('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(save, 1200)
  }
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Preview events: ready, click-to-select, inline text edits of Figma layers.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframe.current?.contentWindow) return
      const msg = e.data as PreviewEvent
      if (msg?.type === 'nexecoms:preview-ready') post()
      else if (msg?.type === 'nexecoms:select' && sections.some((s) => s.id === msg.sectionId)) setSelected(msg.sectionId, msg.nodeId)
      else if (msg?.type === 'nexecoms:edit-text' && typeof msg.text === 'string') {
        const s = sections.find((x) => x.id === msg.sectionId && x.type === 'freeform')
        if (!s) return
        const texts = (s.settings.texts ?? {}) as Record<string, RichText>
        const marks = { ...texts[msg.nodeId]?.[0]?.runs[0] }
        change(sections.map((x) => (x === s ? { ...s, settings: { ...s.settings, texts: { ...texts, [msg.nodeId]: plainToRichText(msg.text.slice(0, 5000), marks) } }, overriddenFields: s.overriddenFields.includes('texts') ? s.overriddenFields : [...s.overriddenFields, 'texts'] } : x)))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  })

  const splitSection = (s: SectionInstance) => {
    const r = splitFreeformSection(s)
    if (!r.ok) { toast.error(r.reason); return }
    const i = sections.indexOf(s)
    change([...sections.slice(0, i), ...r.sections, ...sections.slice(i + 1)])
    setSelected(r.sections[0].id)
    toast.success(`Split into ${r.sections.length} sections`)
  }

  const undo = () => { const prev = past.at(-1); if (!prev) return; setFuture((f) => [sections, ...f]); setPast((p) => p.slice(0, -1)); change(prev, false) }
  const redo = () => { const next = future[0]; if (!next) return; setPast((p) => [...p, sections]); setFuture((f) => f.slice(1)); change(next, false) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.closest('input,textarea,[contenteditable]')) return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = sections.findIndex((s) => s.id === e.active.id), to = sections.findIndex((s) => s.id === e.over!.id)
    change(arrayMove(sections, from, to))
  }

  const pageType = data?.page.type ?? 'PAGE'
  const addable = useMemo(() => Object.values(SECTIONS).filter((d) => d.type !== 'freeform' && d.allowedPageTypes.includes(pageType as never)), [pageType])
  const addSection = (type: SectionType) => {
    const s: SectionInstance = { id: newId(), type, figmaNodeId: null, settings: defaultSettings(type), blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1 }
    const at = selected ? sections.findIndex((x) => x.id === selected) + 1 : sections.length
    change([...sections.slice(0, at), s, ...sections.slice(at)]); setSelected(s.id); setPanel('none')
  }

  const publish = async () => {
    if (saving === 'pending' || saving === 'saving') await save()
    try {
      const items = (await adminApi.get<{ items: ChecklistItem[] }>(`/api/design/pages/${pageId}/checklist`)).items
      setChecklist(items); setPanel('publish')
    } catch (e) { toast.error(errorMessage(e)) }
  }
  const confirmPublish = async () => {
    try {
      const r = await adminApi.post<{ version: number }>(`/api/design/pages/${pageId}/publish`, { revision: latest.current.revision })
      toast.success(`Published version ${r.version}`); setPanel('none'); await load()
    } catch (e) { toast.error(errorMessage(e)) }
  }
  const rollback = async (versionId: string, version: number) => {
    if (!window.confirm(`Publish the content of version ${version} again? Unpublished changes are kept in history.`)) return
    try { await adminApi.post(`/api/design/pages/${pageId}/rollback`, { versionId }); toast.success('Rolled back'); setPanel('none'); await load() } catch (e) { toast.error(errorMessage(e)) }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
  const current = sections.find((s) => s.id === selected)
  const errors = checklist?.filter((c) => c.level === 'error') ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Pages</Button>
        <h2 className="text-lg font-semibold">{data.page.title}</h2>
        <Badge variant="outline">{data.page.published ? 'Published' : 'Not published'}</Badge>
        <span className="text-xs text-muted-foreground" aria-live="polite">{{ idle: '', pending: 'Unsaved changes…', saving: 'Saving…', saved: 'Draft saved', conflict: 'Changed elsewhere — reload' }[saving]}</span>
        {saving === 'conflict' && <Button size="sm" variant="outline" onClick={() => load()}>Reload</Button>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 className="size-4" /></Button>
          <div className="mx-1 flex rounded-md border" role="group" aria-label="Preview size">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
              <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`p-2 ${device === d ? 'bg-muted' : ''}`} aria-label={d}><Icon className="size-4" /></button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPanel('seo')}><SeoIcon className="size-4" /> SEO</Button>
          <Button variant="outline" size="sm" onClick={() => setPanel('history')}><History className="size-4" /> History</Button>
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" onClick={publish} disabled={saving === 'conflict'}><Rocket className="size-4" /> Publish</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-2 rounded-lg border bg-card p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5" aria-label="Sections">
                {sections.map((s) => (
                  <SortableRow key={s.id} section={s} selected={s.id === selected} onSelect={() => setSelected(s.id)}
                    onToggle={() => change(sections.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)))}
                    onDuplicate={() => { const i = sections.indexOf(s); change([...sections.slice(0, i + 1), { ...structuredClone(s), id: newId(), figmaNodeId: null }, ...sections.slice(i + 1)]) }}
                    onDelete={() => { if (window.confirm('Delete this section?')) { change(sections.filter((x) => x.id !== s.id)); if (selected === s.id) setSelected(null) } }} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {!sections.length && <p className="p-2 text-sm text-muted-foreground">No sections yet.</p>}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPanel('add')}><Plus className="size-4" /> Add section</Button>
        </aside>

        <div className="flex min-h-[70vh] justify-center overflow-auto rounded-lg border bg-muted/40 p-2">
          {token ? (
            <iframe ref={iframe} title="Page preview" src={`/design-preview/page/${pageId}?token=${encodeURIComponent(token)}`} sandbox="allow-scripts allow-same-origin" onLoad={post}
              className="h-[75vh] rounded border bg-white shadow-sm transition-[width]" style={{ width: WIDTH[device] }} />
          ) : <Loader2 className="m-auto size-6 animate-spin" />}
        </div>

        <aside className="max-h-[80vh] overflow-y-auto rounded-lg border bg-card p-3">
          {current ? (
            <>
              <div className="mb-3 flex items-center justify-between"><div className="font-semibold">{SECTIONS[current.type].name}</div>{device !== 'desktop' && <Badge variant="outline">Editing {device}</Badge>}</div>
              <SectionSettings key={current.id} section={current} device={device} ctx={ctx} onChange={(s) => change(sections.map((x) => (x.id === s.id ? s : x)))}
                selectedNode={selectedNode} onSelectNode={setSelectedNode} onSplit={() => splitSection(current)} />
            </>
          ) : <p className="text-sm text-muted-foreground">Select a section to edit its settings.</p>}
        </aside>
      </div>

      <Dialog open={panel === 'add'} onOpenChange={(o) => !o && setPanel('none')}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add section</DialogTitle></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">{addable.map((d) => <button key={d.type} type="button" onClick={() => addSection(d.type)} className="rounded-md border p-3 text-left hover:border-brand-teal"><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.description}</div></button>)}</div>
        </DialogContent>
      </Dialog>

      {panel === 'seo' && <SeoDialog onClose={() => setPanel('none')} page={data.page} onSaved={load} />}

      <Dialog open={panel === 'history'} onOpenChange={(o) => !o && setPanel('none')}>
        <DialogContent><DialogHeader><DialogTitle>Version history</DialogTitle></DialogHeader>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {data.versions.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium">v{v.version}</span><Badge variant="outline" className="capitalize">{v.status.toLowerCase()}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(v.publishedAt ?? v.createdAt).toLocaleString()}</span>
                {v.status !== 'DRAFT' && <Button size="sm" variant="outline" className="ml-auto" onClick={() => rollback(v.id, v.version)}>Restore &amp; publish</Button>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'publish'} onOpenChange={(o) => !o && setPanel('none')}>
        <DialogContent><DialogHeader><DialogTitle>Publish “{data.page.title}”</DialogTitle></DialogHeader>
          {checklist && checklist.length === 0 && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> All checks passed.</p>}
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {checklist?.map((c, i) => (
              <li key={i} className={`flex gap-2 rounded-md border p-2 text-sm ${c.level === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{c.message}</span>
                {c.sectionId && <button type="button" className="underline" onClick={() => { setSelected(c.sectionId!); setPanel('none') }}>Fix</button>}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPanel('none')}>Cancel</Button>
            <Button onClick={confirmPublish} disabled={errors.length > 0} className="bg-brand-teal hover:bg-brand-teal-dark">{errors.length ? `Fix ${errors.length} issue${errors.length === 1 ? '' : 's'} first` : 'Publish now'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SeoDialog({ onClose, page, onSaved }: { onClose: () => void; page: PageData['page']; onSaved: () => void }) {
  const [seo, setSeo] = useState<Seo>(page.seo)
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const save = async () => {
    try { await adminApi.patch(`/api/design/pages/${page.id}`, { title, seo, ...(page.type === 'PAGE' && slug !== page.slug ? { slug } : {}) }); toast.success('Page settings saved'); onClose(); onSaved() }
    catch (e) { toast.error(errorMessage(e)) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent><DialogHeader><DialogTitle>Page settings &amp; SEO</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Page name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          {page.type === 'PAGE' && <div className="space-y-1"><Label>URL</Label><div className="flex items-center gap-1 text-sm text-muted-foreground">/pages/<Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} /></div></div>}
          <div className="space-y-1"><Label>Search title <span className="text-xs text-muted-foreground">({(seo.title ?? '').length}/70)</span></Label><Input maxLength={70} value={seo.title ?? ''} onChange={(e) => setSeo({ ...seo, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Meta description <span className="text-xs text-muted-foreground">({(seo.description ?? '').length}/320)</span></Label><Textarea maxLength={320} rows={3} value={seo.description ?? ''} onChange={(e) => setSeo({ ...seo, description: e.target.value })} /></div>
          <div className="space-y-1"><Label>Social image URL</Label><Input value={seo.ogImage ?? ''} placeholder="Defaults to the Figma frame render" onChange={(e) => setSeo({ ...seo, ogImage: e.target.value || undefined })} /></div>
          <div className="space-y-1"><Label>Canonical URL</Label><Input value={seo.canonical ?? ''} placeholder="https://…" onChange={(e) => setSeo({ ...seo, canonical: e.target.value || undefined })} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!seo.noindex} onCheckedChange={(v) => setSeo({ ...seo, noindex: v })} /> Hide from search engines (noindex)</label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
