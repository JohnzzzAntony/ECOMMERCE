// Import review (Phase 8) and re-sync (Phase 11): progress, mapped pages, section remapping, install, retry,
// "updates available", re-sync diff and apply. EDITOR and above make changes; VIEWER can read.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { background } from '@/backend/lib/background'
import { rateLimit } from '@/backend/lib/rate-limit'
import { audit, requireStoreRole } from '@/backend/lib/tenancy'
import { figmaAuth } from '@/backend/lib/figma/connection'
import { pollForUpdates, registerWebhook, startResync, updateAvailable } from '@/backend/lib/figma/resync'
import { framePages, kickWorker, progressOf, resolveRefs, savedMappings, type ImportResult } from '@/backend/lib/design-import/pipeline'
import { enforceHeadings, extract } from '@/backend/lib/design-import/mapping'
import { getSnapshot } from '@/backend/lib/design-import/storage'
import { applyResync, installImport, resyncDiff } from '@/backend/lib/design-import/install'
import { signPreviewToken } from '@/backend/lib/preview-token'
import { plainText, walkIR, type IRDocument, type IRNode } from '@/shared/design-ir'
import { SECTION_TYPES, type SectionType } from '@/shared/sections/registry'
import { importPlanSchema, planFrameIds, type ImportPlan } from '@/shared/design-plan'

const noStore = { 'Cache-Control': 'no-store' }
type Params = { params: Promise<{ id: string }> }
const ID = /^[a-z0-9]{10,40}$/

async function loadImport(ctx: Awaited<ReturnType<typeof requireStoreRole>>, id: string) {
  if (!ID.test(id)) throw new HttpError(400, 'Invalid import id')
  const job = await ctx.db.designImport.findFirst({ where: { id }, include: { file: true } })
  if (!job) throw new HttpError(404, 'Import not found')
  return job
}

export async function getImport(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const job = await loadImport(ctx, (await params).id)
    if (['QUEUED', 'FETCHING', 'NORMALIZING', 'TOKENS', 'MAPPING', 'ASSETS'].includes(job.status)) background(kickWorker)
    const result = (job.result ?? {}) as ImportResult
    return NextResponse.json({
      id: job.id, kind: job.kind, status: job.status, progress: progressOf(job.status), error: job.error, attempts: job.attempts,
      createdAt: job.createdAt, installedAt: job.installedAt, figmaVersion: job.figmaVersion, warnings: job.warnings, stats: job.stats,
      file: { id: job.file.id, fileKey: job.file.fileKey, branchKey: job.file.branchKey || null, name: job.file.name },
      plan: job.pageAssignments, tokens: result.tokens ?? null, pages: result.pages ?? [], frameRenders: result.frameRenders ?? {},
    }, { headers: noStore })
  } catch (error) { return failure(error) }
}

function findNode(root: IRNode, id: string) {
  let found: IRNode | undefined
  walkIR(root, (n) => { if (!found && n.id === id) found = n })
  return found
}

async function irFor(ctx: { store: { id: string } }, irKey: string | null) {
  if (!irKey) throw new HttpError(409, 'This import has not been normalized yet')
  return getSnapshot<IRDocument>(ctx.store.id, irKey)
}

/** Text and image layers of a section's Figma frame, for remapping layers to fields in review. */
export async function getLayers(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const job = await loadImport(ctx, (await params).id)
    const url = new URL(request.url)
    const pageIndex = Number(url.searchParams.get('page'))
    const nodeId = url.searchParams.get('node') ?? ''
    const ir = await irFor(ctx, job.irSnapshotKey)
    const page = ir.pages.filter((p) => p.frames.length)[pageIndex]
    const frame = page?.frames.find((f) => f.device === 'desktop') ?? page?.frames[0]
    const node = frame && findNode(frame.root, nodeId)
    if (!node) throw new HttpError(404, 'Layer not found')
    const layers: { id: string; name: string; kind: string; text?: string }[] = []
    walkIR(node, (n) => { if (n.kind === 'text' || n.kind === 'image' || n.kind === 'vector' || n.component?.primitive) layers.push({ id: n.id, name: n.name, kind: n.component?.primitive ? 'button' : n.kind, ...(n.kind === 'text' ? { text: plainText(n).slice(0, 80) } : {}) }) })
    return NextResponse.json({ layers: layers.slice(0, 300) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

const remapSchema = z.object({
  pageIndex: z.number().int().min(0).max(100),
  sectionId: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES).optional(),
  fieldMap: z.record(z.string().max(40), z.string().regex(/^[\w:;-]{1,100}$/)).optional(),
  hidden: z.boolean().optional(),
})

/** Change a section's type and/or which layers feed which fields; the choice is remembered for later imports. */
export async function remapSection(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const job = await loadImport(ctx, (await params).id)
    if (job.status !== 'REVIEW') throw new HttpError(409, 'Sections can only be changed while the import is in review')
    const body = remapSchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid change')
    const { pageIndex, sectionId, type, fieldMap, hidden } = body.data
    const result = (job.result ?? {}) as ImportResult
    const page = result.pages?.[pageIndex]
    const section = page?.sections.find((s) => s.id === sectionId)
    if (!page || !section) throw new HttpError(404, 'Section not found')

    if (type || fieldMap) {
      if (!section.figmaNodeId) throw new HttpError(400, 'This section was added automatically and has no Figma layer')
      const ir = await irFor(ctx, job.irSnapshotKey)
      const irPage = ir.pages.filter((p) => p.frames.length)[pageIndex]
      const frame = irPage.frames.find((f) => f.device === 'desktop') ?? irPage.frames[0]
      const node = findNode(frame.root, section.figmaNodeId)
      if (!node) throw new HttpError(404, 'Figma layer not found')
      const nextType = (type ?? section.type) as SectionType
      const mctx = { saved: await savedMappings(ctx, job.file.fileKey), framePages: framePages(job.pageAssignments as unknown as ImportPlan['pages']) }
      const { settings, blocks } = extract(nextType, node, mctx, fieldMap ?? {}, frame.root.width)
      const [resolved] = resolveRefs([{ ...page, sections: [{ ...section, type: nextType, settings, blocks }] }], result.assets ?? {})
      Object.assign(section, resolved.sections[0], { mappingConfidence: 1 })
      enforceHeadings(page.sections)
      const existing = await ctx.db.sectionMapping.findFirst({ where: { fileKey: job.file.fileKey, nodeId: section.figmaNodeId } })
      const data = { sectionType: nextType, fieldMap: fieldMap ?? (existing?.fieldMap as Record<string, string> | undefined) ?? {} }
      if (existing) await ctx.db.sectionMapping.update({ where: { id: existing.id }, data })
      else await ctx.db.sectionMapping.create({ data: { storeId: ctx.store.id, fileKey: job.file.fileKey, nodeId: section.figmaNodeId, ...data } })
    }
    if (hidden !== undefined) section.hidden = hidden
    await ctx.db.designImport.update({ where: { id: job.id }, data: { result: result as object } })
    return NextResponse.json({ section }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function installRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    rateLimit(`design-install:${ctx.store.id}`, 20, 60 * 60_000)
    const job = await loadImport(ctx, (await params).id)
    const out = await installImport(ctx, job.id, ctx.user.id)
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.import.install', entityType: 'DesignImport', entityId: job.id, diff: out })
    // Watch the file for new versions (best effort; polling covers plans without webhooks).
    background(async () => { const auth = await figmaAuth(ctx); await registerWebhook(ctx, auth, job.file) })
    return NextResponse.json(out, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function retryRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const job = await loadImport(ctx, (await params).id)
    if (job.status !== 'FAILED') throw new HttpError(409, 'Only failed imports can be retried')
    await ctx.db.designImport.update({ where: { id: job.id }, data: { status: job.rawSnapshotKey ? 'FETCHING' : 'QUEUED', attempts: 0, error: null, lockedAt: null, runAfter: new Date() } })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.import.retry', entityType: 'DesignImport', entityId: job.id })
    background(kickWorker)
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/**
 * Change how the imported frames become pages (pairing per device, page types, exact layout vs editable sections).
 * Re-runs normalize → mapping → assets from the stored Figma snapshot (no new file download; images already
 * copied are reused). Section changes made in review are re-derived.
 */
export async function planRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const job = await loadImport(ctx, (await params).id)
    if (job.status !== 'REVIEW') throw new HttpError(409, 'Pages can only be changed while the import is in review')
    const input = await readJson(request) as { pages?: unknown }
    const parsed = importPlanSchema.safeParse({ fileKey: job.file.fileKey, branchKey: job.file.branchKey || null, pages: input?.pages })
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid pages')
    const unknown = planFrameIds(parsed.data).filter((id) => !job.selectedNodeIds.includes(id))
    if (unknown.length) throw new HttpError(400, 'Only frames selected for this import can be used; start a new import to add frames')
    const { assets, frameRenders } = (job.result ?? {}) as ImportResult
    await ctx.db.designImport.update({
      where: { id: job.id },
      data: { pageAssignments: parsed.data.pages as object[], status: 'NORMALIZING', irSnapshotKey: null, result: { assets, frameRenders } as object, warnings: [], attempts: 0, error: null, lockedAt: null, runAfter: new Date() },
    })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.import.plan', entityType: 'DesignImport', entityId: job.id, diff: { pages: parsed.data.pages } })
    background(kickWorker)
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Imported files with "updates available"; polls Figma in the background for files without webhooks. */
export async function listFiles(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const files = await ctx.db.figmaFile.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 })
    background(async () => { const auth = await figmaAuth(ctx); await pollForUpdates(ctx, auth) })
    return NextResponse.json(files.map((f) => ({
      id: f.id, fileKey: f.fileKey, branchKey: f.branchKey || null, name: f.name, version: f.version, latestVersion: f.latestVersion,
      lastModified: f.lastModified, updateAvailable: updateAvailable(f), watching: f.webhookId ? 'webhook' : 'polling', lastCheckedAt: f.lastCheckedAt,
    })), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function resyncRoute(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    rateLimit(`design-import:${ctx.store.id}`, 30, 60 * 60_000)
    const { fileId } = await params
    if (!ID.test(fileId)) throw new HttpError(400, 'Invalid file id')
    const job = await startResync(ctx, fileId, ctx.user.id)
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.resync.start', entityType: 'DesignImport', entityId: job.id })
    background(kickWorker)
    return NextResponse.json({ id: job.id, status: job.status }, { status: 201, headers: noStore })
  } catch (error) { return failure(error) }
}

export async function diffRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const job = await loadImport(ctx, (await params).id)
    if (job.status !== 'REVIEW' && job.status !== 'INSTALLED') throw new HttpError(409, 'The re-sync is still running')
    return NextResponse.json(await resyncDiff(ctx, job.id), { headers: noStore })
  } catch (error) { return failure(error) }
}

const applySchema = z.object({
  decisions: z.record(z.string().max(100), z.record(z.string().max(120), z.object({ accept: z.boolean(), acceptOverridden: z.array(z.string().max(120)).max(200).optional() }))),
  acceptTokens: z.boolean().default(false),
})

export async function applyRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const job = await loadImport(ctx, (await params).id)
    const body = applySchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid decisions')
    const out = await applyResync(ctx, job.id, ctx.user.id, body.data.decisions, body.data.acceptTokens)
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.resync.apply', entityType: 'DesignImport', entityId: job.id, diff: out })
    return NextResponse.json(out, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Token for the review screen's preview iframe of this import. */
export async function importPreviewToken(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const job = await loadImport(ctx, (await params).id)
    return NextResponse.json({ token: signPreviewToken({ storeId: ctx.store.id, kind: 'import', id: job.id }) }, { headers: noStore })
  } catch (error) { return failure(error) }
}
