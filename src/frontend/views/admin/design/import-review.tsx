'use client'
// Review & install (Phase 8): progress, Figma render next to the live preview, sections with confidence, type and
// layer remapping, warnings, install. Re-sync imports show the diff with per-section accept/reject (Phase 11).
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { SECTIONS, SECTION_TYPES, type SectionInstance, type SectionType } from '@/shared/sections/registry'
import type { IRWarning } from '@/shared/design-ir'
import { DEVICES, PAGE_LAYOUTS, PAGE_LAYOUT_LABELS, PAGE_TYPES, PAGE_TYPE_LABELS, defaultLayout, importPlanSchema, type PageLayout, type PlanPage } from '@/shared/design-plan'
import { slugify } from '@/shared/slug'
import { adminApi, errorMessage } from '../admin-api'
import { DEVICE_SIZES, DevicePreview } from './device-preview'

type MappedPage = { title: string; type: string; slug?: string; frames: { device: string; nodeId: string; name?: string }[]; sections: SectionInstance[] }
type ImportDetail = {
  id: string; kind: 'INSTALL' | 'RESYNC'; status: string; progress: number; error: string | null; attempts: number
  warnings: IRWarning[]; pages: MappedPage[]; frameRenders: Record<string, string>
  plan: PlanPage[]
  file: { name: string; fileKey: string; branchKey: string | null }
}

const STAGE_LABEL: Record<string, string> = { QUEUED: 'Waiting to start', FETCHING: 'Reading selected pages from Figma', NORMALIZING: 'Reading design structure', TOKENS: 'Reading colors and fonts', MAPPING: 'Preparing editable sections', ASSETS: 'Copying images and fonts', REVIEW: 'Ready to preview', INSTALLED: 'Installed as drafts', FAILED: 'Import needs attention' }
const WARNING_HELP: Record<string, string> = {
  NO_AUTO_LAYOUT: 'Use auto layout in Figma, or change the section type here.', MISSING_FONT: 'Upload the font in Design system → Fonts.',
  MISSING_ALT: 'Add alt text in the page editor after installing.', LOW_CONTRAST: 'Adjust colours in the design system or the section.',
  MULTIPLE_H1: 'Set other headings to H2 in the editor.', UNMAPPED_SECTION: 'Pick a section type below.', ASSET_FAILED: 'Choose a replacement image in the editor.',
}

const confidenceBadge = (c: number) => c >= 0.9 ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Exact</Badge>
  : c >= 0.6 ? <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Likely {Math.round(c * 100)}%</Badge>
    : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{c === 0 ? 'Unmapped' : `Unsure ${Math.round(c * 100)}%`}</Badge>

export function ImportReview({ importId, onBack }: { importId: string; onBack: () => void }) {
  const [job, setJob] = useState<ImportDetail | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [device, setDevice] = useState<keyof typeof DEVICE_SIZES>('desktop')

  const load = useCallback(() => adminApi.get<ImportDetail>(`/api/design/imports/${importId}`).then(setJob).catch((e) => toast.error(errorMessage(e))), [importId])
  useEffect(() => { load(); adminApi.get<{ token: string }>(`/api/design/imports/${importId}/preview-token`).then((t) => setToken(t.token)).catch(() => {}) }, [importId, load])
  // Poll while the pipeline runs.
  useEffect(() => {
    if (!job || ['REVIEW', 'INSTALLED', 'FAILED'].includes(job.status)) return
    const t = setTimeout(load, 2000)
    return () => clearTimeout(t)
  }, [job, load])

  if (!job) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
  const running = !['REVIEW', 'INSTALLED', 'FAILED'].includes(job.status)

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Imports</Button>
      <h2 className="text-lg font-semibold">{job.kind === 'RESYNC' ? 'Updates from' : 'Import of'} {job.file.name}</h2>
      <Badge variant="outline">{STAGE_LABEL[job.status] ?? job.status}</Badge>
    </div>
  )
  if (running || job.status === 'FAILED') {
    return (
      <div className="space-y-4">{header}
        <Card><CardContent className="space-y-3 pt-6">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand-teal transition-all" style={{ width: `${job.progress}%` }} /></div>
          <p className="text-sm">{STAGE_LABEL[job.status]}{running && '…'}</p>
          {running && <p className="text-xs text-muted-foreground">You can leave this screen open. Your selected pages are saved and will appear here when ready.</p>}
          {job.error && <p className="text-sm text-red-700">{job.error}</p>}
          {job.status === 'FAILED' && <Button variant="outline" onClick={async () => { try { await adminApi.post(`/api/design/imports/${importId}/retry`, {}); load() } catch (e) { toast.error(errorMessage(e)) } }}><RotateCcw className="size-4" /> Retry</Button>}
        </CardContent></Card>
      </div>
    )
  }
  if (job.kind === 'RESYNC') return <div className="space-y-4">{header}<ResyncReview importId={importId} installed={job.status === 'INSTALLED'} onDone={load} /></div>

  const page = job.pages[pageIndex]
  const render = page && job.frameRenders[(page.frames.find((f) => f.device === device) ?? page.frames.find((f) => f.device === 'desktop') ?? page.frames[0])?.nodeId]
  const remap = async (section: SectionInstance, change: { type?: SectionType; hidden?: boolean; fieldMap?: Record<string, string> }) => {
    setBusy(true)
    try { await adminApi.patch(`/api/design/imports/${importId}/sections`, { pageIndex, sectionId: section.id, ...change }); await load(); setPreviewKey((k) => k + 1) }
    catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  const install = async () => {
    setBusy(true)
    try {
      const r = await adminApi.post<{ pages: { slug: string; version: number }[] }>(`/api/design/imports/${importId}/install`, {})
      toast.success(`Installed ${r.pages.length} page${r.pages.length === 1 ? '' : 's'} as drafts. Review and publish them in Store pages.`)
      load()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  const warnings = job.warnings.filter((w) => !w.pageTitle || w.pageTitle === page?.title)

  return (
    <div className="space-y-4">
      {header}
      <div className="flex flex-wrap items-center gap-2">
        {job.pages.map((p, i) => <Button key={i} size="sm" variant={i === pageIndex ? 'default' : 'outline'} onClick={() => setPageIndex(i)}>{p.title}</Button>)}
        <div className="ml-auto">
          {job.status === 'INSTALLED' ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-3" /> Installed as drafts</Badge>
            : <Button onClick={install} disabled={busy} className="bg-brand-teal hover:bg-brand-teal-dark">{busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Install as drafts</Button>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Installing creates draft versions of these pages and the design system. Nothing is published until you publish each page.</p>

      {(job.status === 'REVIEW' || job.status === 'INSTALLED') && job.plan?.length > 0 && <PlanEditor job={job} disabled={busy} onSaved={() => { setPageIndex(0); load() }} />}

      <Card className="border-brand-teal/20 bg-brand-teal/5">
        <CardContent className="space-y-1 pt-5 text-sm">
          <p className="font-medium">Review the preview, then install as drafts.</p>
          <p className="text-muted-foreground">Use the page buttons and Desktop / Tablet / Mobile controls to check each screen. After installing, edit the generated sections in Store pages. Nothing goes live until you publish.</p>
        </CardContent>
      </Card>

      {page && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm">Figma</CardTitle></CardHeader><CardContent className="max-h-[70vh] overflow-auto">{render ? <img src={render} alt={`Figma design of ${page.title}`} className="w-full" /> : <p className="text-sm text-muted-foreground">No render available.</p>}</CardContent></Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Preview</CardTitle>
              <div className="flex gap-1">{(Object.keys(DEVICE_SIZES) as (keyof typeof DEVICE_SIZES)[]).map((d) => <Button key={d} size="sm" variant={d === device ? 'default' : 'outline'} className="h-7 capitalize" onClick={() => setDevice(d)}>{d}</Button>)}</div>
            </CardHeader>
            <CardContent>{token && <DevicePreview key={`${pageIndex}-${previewKey}-${device}`} device={device} title="Preview" className="h-[640px]" src={`/design-preview/import/${importId}/${pageIndex}?token=${encodeURIComponent(token)}`} />}</CardContent>
          </Card>
        </div>
      )}

      {warnings.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Warnings ({warnings.length})</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2">{warnings.slice(0, 50).map((w, i) => <li key={i} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><span><Badge variant="outline" className="mr-2">{w.code}</Badge>{w.message} <span className="text-muted-foreground">{WARNING_HELP[w.code]}</span></span></li>)}</ul></CardContent>
        </Card>
      )}

      {page && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sections of {page.title}</CardTitle><CardDescription>Change a section's type or which Figma layers fill its fields. Choices are remembered for future imports of this file.</CardDescription></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {page.sections.map((s) => <SectionRow key={s.id} importId={importId} pageIndex={pageIndex} section={s} pageType={page.type} disabled={busy || job.status === 'INSTALLED'} onRemap={(c) => remap(s, c)} />)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Pages of the import: frame per device, type and layout. Saving re-reads the stored Figma snapshot. */
function PlanEditor({ job, disabled, onSaved }: { job: ImportDetail; disabled: boolean; onSaved: () => void }) {
  const [plan, setPlan] = useState<PlanPage[]>(() => job.plan.map((p) => ({ ...p, layout: p.layout ?? 'sections', frames: { ...p.frames } })))
  const [saving, setSaving] = useState(false)
  const names = new Map<string, string>()
  for (const p of job.plan) for (const d of DEVICES) if (p.frames[d]) names.set(p.frames[d]!, `${p.title} (${d})`)
  for (const p of job.pages) for (const f of p.frames) if (f.name) names.set(f.nodeId, f.name)
  const frameIds = [...names.keys()]
  const update = (i: number, patch: Partial<PlanPage>) => setPlan((all) => all.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const assign = (i: number, device: (typeof DEVICES)[number], id: string) => setPlan((all) => all.map((p, j) => {
    const frames = { ...p.frames }
    if (j === i) { if (id) frames[device] = id; else delete frames[device] }
    else for (const d of DEVICES) if (id && frames[d] === id) delete frames[d] // a frame belongs to one page
    return { ...p, frames }
  }).filter((p, j) => j === i || Object.keys(p.frames).length))
  const save = async () => {
    const parsed = importPlanSchema.safeParse({ fileKey: job.file.fileKey, branchKey: job.file.branchKey, pages: plan })
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Check the pages'); return }
    if (!window.confirm(job.status === 'INSTALLED' ? 'Rebuild this import from the stored Figma design? Your installed pages are not changed until you install again.' : 'Rebuild the pages from the Figma design? Section changes made in this review are reset.')) return
    setSaving(true)
    try { await adminApi.post(`/api/design/imports/${job.id}/plan`, { pages: plan }); toast.success('Rebuilding the pages…'); onSaved() }
    catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pages and layout</CardTitle>
        <CardDescription>Put each device's frame on the same page (e.g. the phone frame as the Home page's mobile design). <strong>Exact Figma design</strong> keeps positions, scrolling areas, fixed bars and prototype animations; <strong>editable sections</strong> converts the frame into template sections. Screens the prototype steps through with the ↓/↑ arrow keys become one page that scrolls through them with the prototype's animations.{job.status === 'INSTALLED' && ' Rebuilding an installed import keeps your pages as they are until you install it again (as new drafts).'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.map((row, i) => (
          <div key={i} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_1fr_1fr_2fr] lg:items-end">
            <div className="space-y-1"><div className="text-xs font-medium">Title</div><input className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={row.title} onChange={(e) => update(i, { title: e.target.value })} /></div>
            <div className="space-y-1">
              <div className="text-xs font-medium">Page type</div>
              <select value={row.type} onChange={(e) => { const type = e.target.value as PlanPage['type']; update(i, { type, layout: defaultLayout(type), slug: type === 'PAGE' ? row.slug ?? (slugify(row.title) || 'page') : undefined }) }} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {PAGE_TYPES.map((t) => <option key={t} value={t}>{PAGE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium">Layout</div>
              <select value={row.layout ?? 'sections'} onChange={(e) => update(i, { layout: e.target.value as PageLayout })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {PAGE_LAYOUTS.map((l) => <option key={l} value={l}>{PAGE_LAYOUT_LABELS[l]}{l === defaultLayout(row.type) ? ' (recommended)' : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEVICES.map((d) => (
                <div key={d} className="space-y-1">
                  <div className="text-xs font-medium capitalize">{d}</div>
                  <select value={row.frames[d] ?? ''} onChange={(e) => assign(i, d, e.target.value)} className="h-9 w-full rounded-md border bg-background px-1 text-xs">
                    <option value="">—</option>
                    {frameIds.map((id) => <option key={id} value={id}>{names.get(id)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button onClick={save} disabled={disabled || saving} variant="outline">{saving ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Rebuild pages</Button>
      </CardContent>
    </Card>
  )
}

const FIELDS = ['title', 'subtitle', 'body', 'eyebrow', 'image', 'cta']

function SectionRow({ importId, pageIndex, section, pageType, disabled, onRemap }: { importId: string; pageIndex: number; section: SectionInstance; pageType: string; disabled: boolean; onRemap: (c: { type?: SectionType; hidden?: boolean; fieldMap?: Record<string, string> }) => void }) {
  const [layers, setLayers] = useState<{ id: string; name: string; kind: string; text?: string }[] | null>(null)
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const allowed = SECTION_TYPES.filter((t) => t !== 'custom-code' && SECTIONS[t].allowedPageTypes.includes(pageType as never))
  const openLayers = async () => {
    if (layers) { setLayers(null); return }
    try { setLayers((await adminApi.get<{ layers: typeof layers }>(`/api/design/imports/${importId}/layers?page=${pageIndex}&node=${encodeURIComponent(section.figmaNodeId ?? '')}`)).layers) } catch (e) { toast.error(errorMessage(e)) }
  }
  return (
    <li className={`rounded-md border p-3 ${section.hidden ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Section type" value={section.type} disabled={disabled || !section.figmaNodeId} onChange={(e) => onRemap({ type: e.target.value as SectionType })} className="h-9 rounded-md border bg-background px-2 text-sm">
          {allowed.map((t) => <option key={t} value={t}>{SECTIONS[t].name}</option>)}
        </select>
        {confidenceBadge(section.mappingConfidence)}
        <span className="truncate text-sm text-muted-foreground">{String(section.settings.title ?? section.settings.text ?? '')}</span>
        <div className="ml-auto flex gap-2">
          {section.figmaNodeId && section.type !== 'freeform' && <Button size="sm" variant="outline" disabled={disabled} onClick={openLayers}>Remap layers</Button>}
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onRemap({ hidden: !section.hidden })}>{section.hidden ? 'Include' : 'Skip'}</Button>
        </div>
      </div>
      {layers && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {FIELDS.filter((f) => f === 'cta' || f in section.settings).map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <span className="w-20 capitalize">{field}</span>
              <select value={fieldMap[field] ?? ''} onChange={(e) => setFieldMap({ ...fieldMap, [field]: e.target.value })} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm">
                <option value="">Automatic</option>
                {layers.filter((l) => (field === 'image' ? l.kind === 'image' || l.kind === 'vector' : field === 'cta' ? l.kind === 'button' || l.kind === 'text' : l.kind === 'text')).map((l) => <option key={l.id} value={l.id}>{l.name}{l.text ? ` — “${l.text}”` : ''}</option>)}
              </select>
            </label>
          ))}
          <Button size="sm" disabled={disabled} onClick={() => onRemap({ fieldMap: Object.fromEntries(Object.entries(fieldMap).filter(([, v]) => v)) })}>Apply mapping</Button>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- re-sync
type Change = { kind: 'added' | 'removed' | 'changed'; key: string; section?: SectionInstance; before?: SectionInstance; after?: SectionInstance; fields?: { field: string; overridden: boolean }[] }
type Diff = { pages: { pageKey: string; title: string; exists: boolean; changes: Change[] }[]; tokens: { group: string; name: string }[] }

function ResyncReview({ importId, installed, onDone }: { importId: string; installed: boolean; onDone: () => void }) {
  const [diff, setDiff] = useState<Diff | null>(null)
  const [decisions, setDecisions] = useState<Record<string, Record<string, { accept: boolean; acceptOverridden: string[] }>>>({})
  const [acceptTokens, setAcceptTokens] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    adminApi.get<Diff>(`/api/design/imports/${importId}/diff`).then((d) => {
      setDiff(d)
      // Default: accept everything except values the admin edited.
      setDecisions(Object.fromEntries(d.pages.map((p) => [p.pageKey, Object.fromEntries(p.changes.map((c) => [c.key, { accept: true, acceptOverridden: [] }]))])))
    }).catch((e) => toast.error(errorMessage(e)))
  }, [importId])
  if (!diff) return <Loader2 className="size-6 animate-spin" />
  const set = (page: string, key: string, patch: Partial<{ accept: boolean; acceptOverridden: string[] }>) => setDecisions((d) => ({ ...d, [page]: { ...d[page], [key]: { ...d[page][key], ...patch } } }))
  const total = diff.pages.reduce((n, p) => n + p.changes.length, 0)
  const apply = async () => {
    setBusy(true)
    try { const r = await adminApi.post<{ pages: unknown[] }>(`/api/design/imports/${importId}/apply`, { decisions, acceptTokens }); toast.success(`Created new drafts for ${r.pages.length} page(s). Publish them when ready.`); onDone() }
    catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      {total === 0 && diff.tokens.length === 0 && <p className="text-sm text-muted-foreground">No changes in the imported frames.</p>}
      {diff.pages.filter((p) => p.changes.length).map((p) => (
        <Card key={p.pageKey}>
          <CardHeader><CardTitle className="text-base">{p.title}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {p.changes.map((c) => {
              const d = decisions[p.pageKey]?.[c.key]
              const s = c.section ?? c.after!
              return (
                <div key={c.key} className="rounded-md border p-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!d?.accept} disabled={installed} onChange={(e) => set(p.pageKey, c.key, { accept: e.target.checked })} />
                    <Badge variant="outline" className="capitalize">{c.kind}</Badge>
                    <span className="font-medium">{SECTIONS[s.type].name}</span>
                    <span className="truncate text-muted-foreground">{String(s.settings.title ?? '')}</span>
                  </label>
                  {c.kind === 'changed' && (
                    <ul className="mt-2 space-y-1 pl-6">
                      {c.fields!.map((f) => (
                        <li key={f.field} className="flex items-center gap-2 text-xs">
                          <code>{f.field}</code>
                          {f.overridden ? (
                            <label className="flex items-center gap-1 text-amber-800"><input type="checkbox" disabled={installed || !d?.accept} checked={d?.acceptOverridden.includes(f.field)} onChange={(e) => set(p.pageKey, c.key, { acceptOverridden: e.target.checked ? [...(d?.acceptOverridden ?? []), f.field] : (d?.acceptOverridden ?? []).filter((x) => x !== f.field) })} /> You edited this — replace with the Figma value</label>
                          ) : <span className="text-muted-foreground">updated from Figma</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
      {diff.tokens.length > 0 && (
        <Card><CardContent className="pt-6"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acceptTokens} disabled={installed} onChange={(e) => setAcceptTokens(e.target.checked)} /> Update design tokens ({diff.tokens.length} changed: {diff.tokens.slice(0, 6).map((t) => t.name).join(', ')}{diff.tokens.length > 6 ? '…' : ''}) — saved as a draft design system</label></CardContent></Card>
      )}
      {!installed ? <Button onClick={apply} disabled={busy} className="bg-brand-teal hover:bg-brand-teal-dark">{busy && <Loader2 className="size-4 animate-spin" />} Apply selected changes as new drafts</Button>
        : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Applied</Badge>}
    </div>
  )
}
