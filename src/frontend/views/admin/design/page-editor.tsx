'use client'
// Page editor: section tree (drag to reorder), live preview iframe (postMessage, device sizes) and the settings
// form. Drafts autosave with the revision they were loaded at; publish runs the pre-publish checklist.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Eye, EyeOff, GripVertical, History, LayoutList, Loader2, Monitor, Palette, Plus, Redo2, Rocket, Search as SeoIcon, Smartphone, Sparkles, Tablet, Trash2, Undo2 } from 'lucide-react'
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
import { locateLayer, splitFreeformSection, type FreeformSettings } from '@/shared/freeform-edit'
import type { RichText } from '@/shared/sections/fields'
import type { PreviewEvent, PreviewMessage } from '@/frontend/components/sections/preview-client'
import type { DesignTokens } from '@/shared/design-tokens'
import { AdminApiError, adminApi, errorMessage } from '../admin-api'
import { SectionSettings, type Device } from './settings-form'
import { DevicePreview } from './device-preview'
import { DesignSystemSection } from './design-system'
import { AiGenerateDialog, type GeneratedCode } from './ai-generate-dialog'
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

const HISTORY_LIMIT = 100

/** Name of a section in the list: its own heading, else (Figma sections) the page it was designed as. */
function sectionTitle(section: SectionInstance, pageTitle: string) {
  const own = String(section.settings.title || section.settings.text || section.settings.logoText || section.settings.label || '')
  return own || (section.type === 'freeform' ? pageTitle : SECTIONS[section.type].name)
}

// Actions appear on hover or keyboard focus, as in Shopify's editor, so names aren't crowded out.
const ROW_ACTION = 'size-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

function SortableRow({ section, title, selected, onSelect, onToggle, onDuplicate, onDelete }: { section: SectionInstance; title: string; selected: boolean; onSelect: () => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const def = SECTIONS[section.type]
  const screens = (section.settings.scenes as string[] | undefined)?.length
  const subtitle = screens ? `${screens + 1} screens` : title === def.name ? '' : def.name
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group flex items-center gap-1 rounded-md border bg-background px-1 py-1 ${selected ? 'border-brand-teal ring-1 ring-brand-teal' : ''} ${isDragging ? 'z-10 shadow-lg' : ''} ${section.hidden ? 'opacity-50' : ''}`}>
      <button type="button" className="cursor-grab p-1 text-muted-foreground" aria-label={`Reorder ${title}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">{title}</div>
        {(subtitle || (section.mappingConfidence < 0.6 && section.figmaNodeId)) && <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{subtitle}{section.mappingConfidence < 0.6 && section.figmaNodeId && <AlertTriangle className="size-3 text-amber-600" aria-label="Low mapping confidence" />}</div>}
      </button>
      <Button type="button" variant="ghost" size="icon" className={section.hidden ? 'size-7' : ROW_ACTION} onClick={onToggle} aria-label={section.hidden ? 'Show section' : 'Hide section'}>{section.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
      <Button type="button" variant="ghost" size="icon" className={ROW_ACTION} onClick={onDuplicate} aria-label="Duplicate section"><Copy className="size-3.5" /></Button>
      <Button type="button" variant="ghost" size="icon" className={ROW_ACTION} onClick={onDelete} aria-label="Delete section"><Trash2 className="size-3.5" /></Button>
    </li>
  )
}

type PageLink = { id: string; title: string; type: string }

/** pages/onOpenPage: switch pages from the editor (page picker, header and footer shortcuts). */
export function PageEditor({ pageId, onBack, pages = [], onOpenPage }: { pageId: string; onBack: () => void; pages?: PageLink[]; onOpenPage?: (id: string) => void }) {
  const [data, setData] = useState<PageData | null>(null)
  const [sections, setSections] = useState<SectionInstance[]>([])
  const [revision, setRevision] = useState(0)
  const [selected, setSelectedSection] = useState<string | null>(null)
  // Layer of a Figma section selected in the layer tree or by clicking the preview.
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const setSelected = (id: string | null, node: string | null = null) => { setSelectedSection(id); setSelectedNode(node) }
  // Scroll story scene shown in the preview ('@' = first): follows the selected layer or the layer panel's choice.
  const [scene, setScene] = useState<string | null>(null)
  // The preview has hydrated and answers clicks (it reports ready); until then it is static HTML.
  const [previewReady, setPreviewReady] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'conflict'>('idle')
  const [past, setPast] = useState<SectionInstance[][]>([])
  const [future, setFuture] = useState<SectionInstance[][]>([])
  const [token, setToken] = useState<string | null>(null)
  const [ctx, setCtx] = useState<EditorContext>({ pages: [], tokens: null })
  const [panel, setPanel] = useState<'none' | 'add' | 'ai' | 'seo' | 'history' | 'publish'>('none')
  const [rail, setRail] = useState<'sections' | 'theme'>('sections')
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
  const post = useCallback(() => iframe.current?.contentWindow?.postMessage({ type: 'nexecoms:preview', sections: latest.current.sections, selectedId: selected, selectedNodeId: selectedNode, scene } satisfies PreviewMessage, window.location.origin), [selected, selectedNode, scene])
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
  // Leaving the page (back, page picker) saves pending changes instead of dropping them with the timer.
  const saveRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => { saveRef.current = save }, [save])
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); void saveRef.current() } }, [])

  // Preview events: ready, click-to-select, inline text edits of Figma layers.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframe.current?.contentWindow) return
      const msg = e.data as PreviewEvent
      if (msg?.type === 'nexecoms:preview-ready') { setPreviewReady(true); post() }
      else if (msg?.type === 'nexecoms:select' && sections.some((s) => s.id === msg.sectionId)) {
        setSelected(msg.sectionId, msg.nodeId)
        const section = sections.find((s) => s.id === msg.sectionId)!
        const at = msg.nodeId && section.type === 'freeform' ? locateLayer(section.settings as unknown as FreeformSettings, msg.nodeId) : null
        if (at?.key === 'tree') setScene('@'); else if (at?.key.startsWith('scene:')) setScene(at.key.slice(6))
      }
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
  const addSection = (type: SectionType, settings = defaultSettings(type)) => {
    const s: SectionInstance = { id: newId(), type, figmaNodeId: null, settings, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1 }
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
  // Shortcut to the store-wide header or footer page (shown on every page), as in Shopify's section list.
  const globalRow = (type: string, label: string) => {
    const target = pages.find((p) => p.type === type)
    if (!target || !onOpenPage || data.page.type === type) return null
    return <button type="button" onClick={() => onOpenPage(target.id)} className="flex w-full items-center justify-between rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:border-brand-teal hover:text-foreground">{label}<span className="text-[11px]">Every page</span></button>
  }
  const current = sections.find((s) => s.id === selected)
  const errors = checklist?.filter((c) => c.level === 'error') ?? []

  // Full-screen like Shopify's editor: covers the admin chrome (z-40 keeps dialogs, z-50, above it).
  // shortcut: fixed-width side panels, the preview just scales down; needs a ~1024px+ screen.
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Exit editor"><ArrowLeft className="size-4" /> Exit</Button>
        {pages.length > 1 && onOpenPage
          ? <select aria-label="Page" value={pageId} onChange={(e) => onOpenPage(e.target.value)} className="h-8 max-w-56 rounded-md border bg-background px-2 text-sm font-semibold">
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}{p.type === 'HEADER' ? ' (header)' : p.type === 'FOOTER' ? ' (footer)' : p.type === 'ANNOUNCEMENT' ? ' (announcement bar)' : ''}</option>)}
            </select>
          : <h2 className="truncate text-sm font-semibold">{data.page.title}</h2>}
        <Badge variant="outline">{data.page.published ? 'Published' : 'Not published'}</Badge>
        <span className="text-xs text-muted-foreground" aria-live="polite">{{ idle: '', pending: 'Unsaved changes…', saving: 'Saving…', saved: 'Draft saved', conflict: 'Changed elsewhere — reload' }[saving]}</span>
        {saving === 'conflict' && <Button size="sm" variant="outline" onClick={() => load()}>Reload</Button>}
        <div className="mx-auto flex rounded-md border" role="group" aria-label="Preview size">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`p-1.5 ${device === d ? 'bg-muted' : ''}`} aria-label={d}><Icon className="size-4" /></button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPanel('seo')}><SeoIcon className="size-4" /> SEO</Button>
          <Button variant="outline" size="sm" onClick={() => setPanel('history')}><History className="size-4" /> History</Button>
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" onClick={publish} disabled={saving === 'conflict'}><Rocket className="size-4" /> Publish</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2" aria-label="Editor panels">
          {([['sections', LayoutList, 'Sections'], ['theme', Palette, 'Theme settings']] as const).map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => setRail(key)} aria-pressed={rail === key} aria-label={label} title={label}
              className={`rounded-md p-2 ${rail === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}><Icon className="size-5" /></button>
          ))}
        </nav>

        {rail === 'theme' ? (
          <aside className="w-[480px] shrink-0 overflow-y-auto border-r p-3"><DesignSystemSection /></aside>
        ) : (
        <aside className="w-64 shrink-0 space-y-2 overflow-y-auto border-r p-2">
          {globalRow('HEADER', 'Header')}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5" aria-label="Sections">
                {sections.map((s) => (
                  <Fragment key={s.id}>
                  <SortableRow section={s} title={sectionTitle(s, data.page.title)} selected={s.id === selected} onSelect={() => setSelected(s.id)}
                    onToggle={() => change(sections.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)))}
                    onDuplicate={() => { const i = sections.indexOf(s); change([...sections.slice(0, i + 1), { ...structuredClone(s), id: newId(), figmaNodeId: null }, ...sections.slice(i + 1)]) }}
                    onDelete={() => { if (window.confirm('Delete this section?')) { change(sections.filter((x) => x.id !== s.id)); if (selected === s.id) setSelected(null) } }} />
                  {s.id === selected && !!(s.settings.scenes as string[] | undefined)?.length && (
                    <li><ul className="ml-6 space-y-0.5 border-l pl-2" aria-label="Screens">
                      {['@', ...(s.settings.scenes as string[])].map((id, i) => (
                        <li key={id}><button type="button" onClick={() => { setSelectedNode(null); setScene(id) }}
                          className={`w-full rounded px-2 py-1 text-left text-xs ${(scene ?? '@') === id ? 'bg-sky-100 font-medium text-sky-950' : 'hover:bg-muted'}`}>Screen {i + 1}</button></li>
                      ))}
                    </ul></li>
                  )}
                  </Fragment>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {!sections.length && <p className="p-2 text-sm text-muted-foreground">No sections yet.</p>}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPanel('add')}><Plus className="size-4" /> Add section</Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPanel('ai')}><Sparkles className="size-4" /> Generate with AI</Button>
          {globalRow('FOOTER', 'Footer')}
        </aside>
        )}

        <div className="flex min-w-0 flex-1 bg-muted/40 p-4">
          {token ? (
            <DevicePreview iframeRef={iframe} device={device} title="Page preview" src={`/design-preview/page/${pageId}?token=${encodeURIComponent(token)}`} sandbox="allow-scripts allow-same-origin" onLoad={post} data-ready={previewReady || undefined}
              className="h-full shadow-sm" />
          ) : <Loader2 className="m-auto size-6 animate-spin" />}
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l p-3">
          {current ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                {selectedNode
                  ? <button type="button" onClick={() => setSelectedNode(null)} className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 shrink-0" /><span className="truncate">{sectionTitle(current, data.page.title)}</span></button>
                  : <div className="font-semibold">{sectionTitle(current, data.page.title)}</div>}
                {device !== 'desktop' && <Badge variant="outline">Editing {device}</Badge>}
              </div>
              <SectionSettings key={current.id} section={current} device={device} ctx={ctx} onChange={(s) => change(sections.map((x) => (x.id === s.id ? s : x)))}
                selectedNode={selectedNode} onSplit={() => splitSection(current)} scene={scene}
                onSelectNode={(id) => {
                  setSelectedNode(id)
                  const at = id && current.type === 'freeform' ? locateLayer(current.settings as unknown as FreeformSettings, id) : null
                  if (at?.key === 'tree') setScene('@'); else if (at?.key.startsWith('scene:')) setScene(at.key.slice(6))
                }} />
            </>
          ) : <p className="text-sm text-muted-foreground">Select a section to edit its settings.</p>}
        </aside>
      </div>

      <Dialog open={panel === 'add'} onOpenChange={(o) => !o && setPanel('none')}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add section</DialogTitle></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">{addable.map((d) => <button key={d.type} type="button" onClick={() => addSection(d.type)} className="rounded-md border p-3 text-left hover:border-brand-teal"><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.description}</div></button>)}</div>
        </DialogContent>
      </Dialog>

      <AiGenerateDialog open={panel === 'ai'} onClose={() => setPanel('none')} onResult={(code: GeneratedCode) => addSection('custom-code', code)} />

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
