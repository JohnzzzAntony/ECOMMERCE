'use client'
// Import design: open a Figma file (or browse a team), pick frames, pair responsive variants, assign page types,
// and queue the import. Thumbnails come from Figma for this screen only.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckSquare, FileImage, FolderOpen, Loader2, Play, Plus, Square, Trash2, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { DEVICES, PAGE_LAYOUTS, PAGE_LAYOUT_LABELS, PAGE_TYPE_LABELS, PAGE_TYPES, defaultLayout, frameDevice, importPlanSchema, pairFrames, type Device, type PageLayout, type PageType, type PlanPage } from '@/shared/design-plan'
import { FigmaLinkError, parseFigmaLink } from '@/shared/figma-url'
import { slugify } from '@/shared/slug'
import { adminApi, errorMessage } from './admin-api'
import { StatusBadge } from './shared'
import { ImportReview } from './design/import-review'

type Frame = { id: string; name: string; width: number; height: number; section: string | null }
type FileStructure = {
  fileKey: string; branchKey: string | null; name: string; version: string; lastModified: string
  pages: { id: string; name: string; flows: { nodeId: string; name: string }[]; frames: Frame[] }[]
}
type ImportRow = { id: string; kind: 'INSTALL' | 'RESYNC'; status: string; progress: number; error: string | null; createdAt: string; file: { name: string }; pages: PlanPage[]; frameCount: number }
type FileRow = { id: string; name: string; updateAvailable: boolean; watching: 'webhook' | 'polling'; version: string; latestVersion: string | null }
type Browse = { teamId: string; projects: { id: string; name: string }[]; files?: { projectName: string; items: { key: string; name: string; thumbnailUrl: string | null; lastModified: string | null }[] } }

const fileUrl = (key: string, branch: string | null, suffix = '', query = '') =>
  `/api/design/figma/files/${key}${suffix}?${new URLSearchParams({ ...(branch ? { branch } : {}), ...Object.fromEntries(new URLSearchParams(query)) })}`

export function DesignImportSection() {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [browse, setBrowse] = useState<Browse | null>(null)
  const [file, setFile] = useState<FileStructure | null>(null)
  const [startNodeId, setStartNodeId] = useState<string | null>(null)
  const [imports, setImports] = useState<ImportRow[]>([])
  const [files, setFiles] = useState<FileRow[]>([])
  const [reviewing, setReviewing] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('import')))

  const loadImports = useCallback(() => {
    adminApi.get<FileRow[]>('/api/design/files').then(setFiles).catch(() => {})
    return adminApi.get<ImportRow[]>('/api/design/imports').then(setImports).catch(() => {})
  }, [])
  useEffect(() => { loadImports() }, [loadImports])
  // Refresh while imports are running.
  useEffect(() => {
    if (!imports.some((i) => !['REVIEW', 'INSTALLED', 'FAILED'].includes(i.status))) return
    const t = setTimeout(loadImports, 3000)
    return () => clearTimeout(t)
  }, [imports, loadImports])

  const resync = (fileId: string) => run(`resync:${fileId}`, async () => {
    const r = await adminApi.post<{ id: string }>(`/api/design/files/${fileId}/resync`, {})
    setReviewing(r.id)
  })

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label)
    try { await action() } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(null) }
  }

  const openFile = (fileKey: string, branchKey: string | null, preselect: string | null = null, start: string | null = null) => run('file', async () => {
    const structure = await adminApi.get<FileStructure>(fileUrl(fileKey, branchKey))
    setFile(structure); setStartNodeId(start ?? preselect)
  })

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault()
    let parsed
    try { parsed = parseFigmaLink(link) } catch (err) { toast.error(err instanceof FigmaLinkError ? err.message : 'Invalid link'); return }
    if (parsed.kind === 'team') {
      const { teamId } = parsed
      run('team', async () => { const { projects } = await adminApi.get<{ projects: Browse['projects'] }>(`/api/design/figma/teams/${teamId}`); setFile(null); setBrowse({ teamId, projects }) })
    } else {
      setBrowse(null)
      openFile(parsed.fileKey, parsed.branchKey, parsed.nodeId, parsed.startNodeId)
    }
  }

  const openProject = (project: { id: string; name: string }) => run(`project:${project.id}`, async () => {
    const { files } = await adminApi.get<{ files: NonNullable<Browse['files']>['items'] }>(`/api/design/figma/projects/${project.id}`)
    setBrowse((b) => b && { ...b, files: { projectName: project.name, items: files } })
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import a Figma design</CardTitle>
          <CardDescription>Paste a link to a Figma Design file, prototype or branch, or a team page to browse its projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitLink} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="figma-link">Figma link</Label>
              <Input id="figma-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.figma.com/design/…" spellCheck={false} />
            </div>
            <Button type="submit" disabled={!link.trim() || !!busy} className="bg-brand-teal hover:bg-brand-teal-dark">
              {busy === 'file' || busy === 'team' ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />} Open
            </Button>
          </form>
        </CardContent>
      </Card>

      {browse && !file && (
        <Card>
          <CardHeader><CardTitle className="text-base">{browse.files ? browse.files.projectName : 'Team projects'}</CardTitle></CardHeader>
          <CardContent>
            {browse.files ? (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" onClick={() => setBrowse({ ...browse, files: undefined })}><ArrowLeft className="size-4" /> Projects</Button>
                {browse.files.items.length === 0 && <p className="text-sm text-muted-foreground">No files in this project.</p>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {browse.files.items.map((f) => (
                    <button key={f.key} onClick={() => openFile(f.key, null)} className="overflow-hidden rounded-lg border text-left transition hover:border-brand-teal">
                      {f.thumbnailUrl ? <img src={f.thumbnailUrl} alt="" className="aspect-video w-full bg-muted object-cover" /> : <div className="flex aspect-video items-center justify-center bg-muted"><FileImage className="size-6 text-muted-foreground" /></div>}
                      <div className="p-3 text-sm font-medium">{f.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="divide-y rounded-md border">
                {browse.projects.length === 0 && <li className="p-3 text-sm text-muted-foreground">No projects visible to the connected account.</li>}
                {browse.projects.map((p) => (
                  <li key={p.id}><button onClick={() => openProject(p)} className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-muted/50">
                    {p.name} {busy === `project:${p.id}` && <Loader2 className="size-4 animate-spin" />}
                  </button></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {reviewing && <ImportReview importId={reviewing} onBack={() => { setReviewing(null); loadImports() }} />}
      {!reviewing && files.some((f) => f.updateAvailable) && (
        <Card className="border-sky-200">
          <CardHeader><CardTitle className="text-base">Updates available</CardTitle><CardDescription>These Figma files changed since they were installed. Re-sync to review the changes; your edits are kept unless you accept the Figma value.</CardDescription></CardHeader>
          <CardContent><ul className="space-y-2">{files.filter((f) => f.updateAvailable).map((f) => (
            <li key={f.id} className="flex items-center gap-3 text-sm"><span className="font-medium">{f.name}</span><span className="text-xs text-muted-foreground">via {f.watching}</span>
              <Button size="sm" className="ml-auto" disabled={!!busy} onClick={() => resync(f.id)}>{busy === `resync:${f.id}` ? <Loader2 className="size-4 animate-spin" /> : null} Re-sync</Button></li>
          ))}</ul></CardContent>
        </Card>
      )}
      {!reviewing && file && <FilePicker key={`${file.fileKey}:${file.branchKey}:${startNodeId}`} file={file} startNodeId={startNodeId} onClose={() => setFile(null)} onQueued={(id) => { setReviewing(id); loadImports() }} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Imports</CardTitle><CardDescription>Queued imports are processed in the background; nothing is published automatically.</CardDescription></CardHeader>
        <CardContent>
          {imports.length === 0 ? <p className="text-sm text-muted-foreground">No imports yet.</p> : (
            <ul className="divide-y rounded-md border">
              {imports.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <StatusBadge status={i.status.toLowerCase()} />
                  {i.kind === 'RESYNC' && <Badge variant="outline">Re-sync</Badge>}
                  <span className="font-medium">{i.file.name}</span>
                  {!['REVIEW', 'INSTALLED', 'FAILED'].includes(i.status) && <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-label={`${i.progress}% done`}><span className="block h-full bg-brand-teal" style={{ width: `${i.progress}%` }} /></span>}
                  <span className="text-muted-foreground">{i.pages.map((p) => p.title).join(', ')}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleString()}</span>
                  <Button size="sm" variant={i.status === 'REVIEW' ? 'default' : 'outline'} onClick={() => setReviewing(i.id)}>{i.status === 'REVIEW' ? 'Review' : 'Open'}</Button>
                  {i.error && <span className="w-full text-xs text-red-600">{i.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function selected0(startNodeId: string | null, frames: Map<string, Frame>) {
  const frame = startNodeId ? frames.get(startNodeId) : undefined
  return frame ? [frame] : []
}

function FilePicker({ file, startNodeId, onClose, onQueued }: { file: FileStructure; startNodeId: string | null; onClose: () => void; onQueued: (id: string) => void }) {
  const allFrames = useMemo(() => new Map(file.pages.flatMap((p) => p.frames.map((f) => [f.id, f] as const))), [file])
  const initialPage = file.pages.find((p) => p.frames.some((f) => f.id === startNodeId)) ?? file.pages.find((p) => p.frames.length) ?? file.pages[0]
  const [pageId, setPageId] = useState(initialPage?.id)
  const [selected, setSelected] = useState<string[]>(() => selected0(startNodeId, allFrames).map((f) => f.id))
  const [plan, setPlan] = useState<PlanPage[]>(() => pairFrames(selected0(startNodeId, allFrames), startNodeId))
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const page = file.pages.find((p) => p.id === pageId)

  // Thumbnails for the visible page, 50 frames per request.
  useEffect(() => {
    const missing = (page?.frames ?? []).map((f) => f.id).filter((id) => !(id in thumbs))
    for (let i = 0; i < missing.length; i += 50) {
      const ids = missing.slice(i, i + 50)
      adminApi.get<{ images: Record<string, string | null> }>(fileUrl(file.fileKey, file.branchKey, '/thumbnails', `ids=${ids.join(',')}`))
        .then(({ images }) => setThumbs((t) => ({ ...t, ...Object.fromEntries(ids.map((id) => [id, images[id] ?? null])) })))
        .catch(() => setThumbs((t) => ({ ...t, ...Object.fromEntries(ids.map((id) => [id, null])) })))
    }
  }, [page?.id])

  // Changing the selection re-runs the automatic pairing; edits below adjust the result.
  const select = (next: string[]) => {
    setSelected(next)
    setPlan(pairFrames(next.map((id) => allFrames.get(id)).filter((f): f is Frame => !!f), startNodeId))
  }
  const toggle = (id: string) => select(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const selectFlow = (start: string) => {
    setBusy(`flow:${start}`)
    adminApi.get<{ nodeIds: string[] }>(fileUrl(file.fileKey, file.branchKey, '/flow', `start=${start}`))
      .then(({ nodeIds }) => { select([...new Set([...selected, ...nodeIds])]); toast.success(`Selected ${nodeIds.length} frame${nodeIds.length === 1 ? '' : 's'} in the flow`) })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusy(null))
  }

  const updatePage = (i: number, patch: Partial<PlanPage>) => setPlan((p) => p.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const assignFrame = (i: number, device: Device, frameId: string) => setPlan((p) => p.map((row, j) => {
    const frames = { ...row.frames }
    for (const d of DEVICES) if (frames[d] === frameId) delete frames[d] // a frame belongs to one slot
    if (j === i) { if (frameId) frames[device] = frameId; else delete frames[device] }
    return { ...row, frames }
  }))
  const setType = (i: number, type: PageType) => updatePage(i, { type, layout: defaultLayout(type), slug: type === 'PAGE' ? plan[i].slug ?? (slugify(plan[i].title) || 'page') : undefined })

  const submit = () => {
    const body = { fileKey: file.fileKey, branchKey: file.branchKey, pages: plan.filter((p) => Object.keys(p.frames).length) }
    const parsed = importPlanSchema.safeParse(body)
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Check the page list'); return }
    setBusy('submit')
    adminApi.post<{ id: string }>('/api/design/imports', parsed.data)
      .then(({ id }) => { toast.success('Import queued'); select([]); onQueued(id) })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusy(null))
  }

  const flows = file.pages.flatMap((p) => p.flows)
  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{file.name}</CardTitle>
            <CardDescription>Version {file.version} · edited {new Date(file.lastModified).toLocaleString()}{file.branchKey ? ' · branch' : ''}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!!busy || !page?.frames.length} onClick={() => select([...new Set([...selected, ...(page?.frames ?? []).map((f) => f.id)])])}>Select this page</Button>
            <Button size="sm" variant="ghost" disabled={!!busy || !selected.length} onClick={() => select([])}>Clear selection</Button>
            <span className="text-xs text-muted-foreground">Choose the frames you want to turn into pages.</span>
          </div>
          {(flows.length > 0 || startNodeId) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Prototype flows:</span>
              {flows.map((f) => (
                <Button key={f.nodeId} size="sm" variant="outline" onClick={() => selectFlow(f.nodeId)} disabled={!!busy}>
                  {busy === `flow:${f.nodeId}` ? <Loader2 className="size-4 animate-spin" /> : <Workflow className="size-4" />} Import entire flow “{f.name}”
                </Button>
              ))}
              {startNodeId && allFrames.has(startNodeId) && !flows.some((f) => f.nodeId === startNodeId) && (
                <Button size="sm" variant="outline" onClick={() => selectFlow(startNodeId)} disabled={!!busy}><Workflow className="size-4" /> Import flow from linked frame</Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-1 border-b pb-2">
            {file.pages.map((p) => (
              <button key={p.id} onClick={() => setPageId(p.id)} className={`rounded-md px-3 py-1.5 text-sm ${p.id === pageId ? 'bg-brand-teal text-white' : 'hover:bg-muted'}`}>
                {p.name} <span className="opacity-60">({p.frames.length})</span>
              </button>
            ))}
          </div>
          {page && page.frames.length === 0 && <p className="text-sm text-muted-foreground">This page has no top-level frames.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {page?.frames.map((f) => {
              const on = selected.includes(f.id)
              return (
                <button key={f.id} onClick={() => toggle(f.id)} aria-pressed={on} className={`overflow-hidden rounded-lg border-2 text-left transition ${on ? 'border-brand-teal' : 'border-transparent ring-1 ring-border hover:ring-brand-teal/50'}`}>
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
                    {thumbs[f.id] ? <img src={thumbs[f.id]!} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                      : f.id in thumbs ? <FileImage className="size-6 text-muted-foreground" /> : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="flex items-start gap-2 p-2.5">
                    {on ? <CheckSquare className="mt-0.5 size-4 shrink-0 text-brand-teal" /> : <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{f.width}×{f.height} · {frameDevice(f).device}{f.section ? ` · ${f.section}` : ''}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {plan.length > 0 && (
        <Card>
          <CardHeader>
          <CardTitle className="text-base">Pages to create ({plan.length})</CardTitle>
            <CardDescription>Matching desktop, tablet and mobile frames are grouped as one page. Repeated frames without device labels become separate pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <span className="min-w-36 flex-1 font-medium">{row.title}</span>
                <select aria-label={`Page type for ${row.title}`} value={row.type} onChange={(e) => setType(i, e.target.value as PageType)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  {PAGE_TYPES.map((t) => <option key={t} value={t}>{PAGE_TYPE_LABELS[t]}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{DEVICES.filter((d) => row.frames[d]).map((d) => d).join(', ')}</span>
                <Button size="sm" variant="ghost" aria-label={`Remove ${row.title}`} onClick={() => setPlan((p) => p.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Hide page settings' : 'Edit page names and types'}</Button>
            {showAdvanced && <>
            {plan.map((row, i) => (
              <div key={i} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_2fr_auto] lg:items-end">
                <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={row.title} onChange={(e) => updatePage(i, { title: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Page type</Label>
                  <select value={row.type} onChange={(e) => setType(i, e.target.value as PageType)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {PAGE_TYPES.map((t) => <option key={t} value={t}>{PAGE_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" title="Exact keeps every position, scrolling area, fixed layer and prototype animation from Figma. Editable sections convert the frame into template sections.">Layout</Label>
                  <select aria-label="Layout" value={row.layout ?? defaultLayout(row.type)} onChange={(e) => updatePage(i, { layout: e.target.value as PageLayout })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {PAGE_LAYOUTS.map((l) => <option key={l} value={l}>{PAGE_LAYOUT_LABELS[l]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL slug</Label>
                  <Input value={row.slug ?? ''} disabled={row.type !== 'PAGE'} placeholder={row.type === 'PAGE' ? 'about-us' : 'set by type'} onChange={(e) => updatePage(i, { slug: e.target.value.toLowerCase() })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICES.map((d) => (
                    <div key={d} className="space-y-1">
                      <Label className="text-xs capitalize">{d}</Label>
                      <select value={row.frames[d] ?? ''} onChange={(e) => assignFrame(i, d, e.target.value)} className="h-9 w-full rounded-md border bg-background px-1 text-xs">
                        <option value="">—</option>
                        {selected.map((id) => <option key={id} value={id}>{allFrames.get(id)?.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove page" onClick={() => setPlan((p) => p.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            </>}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">To add a page, select its frame above.</span>
              <Badge variant="outline">{selected.length} frame{selected.length === 1 ? '' : 's'} selected</Badge>
              <Button onClick={submit} disabled={!!busy} className="ml-auto bg-brand-teal hover:bg-brand-teal-dark">
                {busy === 'submit' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Import {plan.length} page{plan.length === 1 ? '' : 's'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
