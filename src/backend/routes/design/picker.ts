// Frame picker API: browse the store's Figma files and queue imports. EDITOR and above.
import type { DesignImport, FigmaFile } from '@prisma/client'
import { NextResponse } from 'next/server'
import { failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { rateLimit } from '@/backend/lib/rate-limit'
import { background } from '@/backend/lib/background'
import { hasRunnableJobs, kickWorker, progressOf } from '@/backend/lib/design-import/pipeline'
import { audit, requireStoreRole } from '@/backend/lib/tenancy'
import { figmaAuth } from '@/backend/lib/figma/connection'
import { fileStructure, flowFrames, frameThumbnails, projectFiles, teamProjects } from '@/backend/lib/figma/files'
import { defaultLayout, importPlanSchema, planFrameIds } from '@/shared/design-plan'

const noStore = { 'Cache-Control': 'no-store' }
const FILE_KEY = /^[A-Za-z0-9]{10,64}$/
const NODE_ID = /^\d+:\d+$/
type Params<K extends string> = { params: Promise<Record<K, string>> }

/** Store member with EDITOR rights plus the store's Figma credentials; browsing is rate limited per store. */
async function editor(request: Request) {
  const ctx = await requireStoreRole(request, 'EDITOR')
  rateLimit(`figma-browse:${ctx.store.id}`, 120, 60_000)
  return { ...ctx, auth: await figmaAuth(ctx) }
}

function fileRef(request: Request, key: string) {
  const branch = new URL(request.url).searchParams.get('branch') || null
  if (!FILE_KEY.test(key) || (branch && !FILE_KEY.test(branch))) throw new HttpError(400, 'Invalid Figma file key')
  return { fileKey: key, branchKey: branch }
}

export async function getFile(request: Request, { params }: Params<'key'>) {
  try {
    const { auth } = await editor(request)
    const { fileKey, branchKey } = fileRef(request, (await params).key)
    return NextResponse.json(await fileStructure(auth, fileKey, branchKey), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function getThumbnails(request: Request, { params }: Params<'key'>) {
  try {
    const { auth } = await editor(request)
    const { fileKey, branchKey } = fileRef(request, (await params).key)
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
    if (!ids.length || ids.length > 50 || !ids.every((id) => NODE_ID.test(id))) throw new HttpError(400, 'Pass 1–50 frame ids')
    return NextResponse.json({ images: await frameThumbnails(auth, fileKey, branchKey, ids) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Frames reachable from a prototype starting point (or any frame), for "Import entire prototype flow". */
export async function getFlow(request: Request, { params }: Params<'key'>) {
  try {
    const { auth } = await editor(request)
    const { fileKey, branchKey } = fileRef(request, (await params).key)
    const start = new URL(request.url).searchParams.get('start') ?? ''
    if (!NODE_ID.test(start)) throw new HttpError(400, 'Invalid starting frame')
    const structure = await fileStructure(auth, fileKey, branchKey)
    const frameIds = new Set(structure.pages.flatMap((p) => p.frames.map((f) => f.id)))
    return NextResponse.json({ nodeIds: await flowFrames(auth, fileKey, branchKey, frameIds, start) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function getTeam(request: Request, { params }: Params<'teamId'>) {
  try {
    const { auth } = await editor(request)
    const { teamId } = await params
    if (!/^\d{5,30}$/.test(teamId)) throw new HttpError(400, 'Invalid team id')
    return NextResponse.json({ projects: await teamProjects(auth, teamId) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function getProject(request: Request, { params }: Params<'projectId'>) {
  try {
    const { auth } = await editor(request)
    const { projectId } = await params
    if (!/^\d{1,30}$/.test(projectId)) throw new HttpError(400, 'Invalid project id')
    return NextResponse.json({ files: await projectFiles(auth, projectId) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

const publicImport = (i: DesignImport & { file: FigmaFile }) => ({
  id: i.id, kind: i.kind, status: i.status, progress: progressOf(i.status), error: i.error, createdAt: i.createdAt, figmaVersion: i.figmaVersion,
  file: { fileKey: i.file.fileKey, branchKey: i.file.branchKey || null, name: i.file.name },
  pages: i.pageAssignments, frameCount: i.selectedNodeIds.length,
})

export async function listImports(request: Request) {
  try {
    const { db } = await requireStoreRole(request, 'VIEWER')
    const imports = await db.designImport.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { file: true } })
    // Resumes jobs left behind by a restart (the worker runs inside this server process).
    background(async () => { if (await hasRunnableJobs()) await kickWorker() })
    return NextResponse.json(imports.map(publicImport), { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Validates the plan against the live file (frames must be top-level frames of it) and queues the import. */
export async function createImport(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    rateLimit(`design-import:${ctx.store.id}`, 30, 60 * 60_000)
    const parsed = importPlanSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid import selection')
    const plan = parsed.data
    // New imports preserve the design unless a commerce template needs live sections.
    // Keep old saved imports unchanged when they are resumed or re-synced.
    plan.pages = plan.pages.map((page) => ({ ...page, layout: page.layout ?? defaultLayout(page.type) }))
    const branchKey = plan.branchKey ?? null

    const auth = await figmaAuth(ctx)
    const structure = await fileStructure(auth, plan.fileKey, branchKey)
    const frames = new Set(structure.pages.flatMap((p) => p.frames.map((f) => f.id)))
    const nodeIds = planFrameIds(plan)
    const missing = nodeIds.filter((id) => !frames.has(id))
    if (missing.length) throw new HttpError(400, `Frame ${missing[0]} is not a top-level frame of this file. Reload the file and select again.`)

    const conn = await ctx.db.figmaConnection.findFirst({})
    const fileData = { name: structure.name, version: structure.version, lastModified: new Date(structure.lastModified), connectionId: conn?.id ?? null }
    const existing = await ctx.db.figmaFile.findFirst({ where: { fileKey: plan.fileKey, branchKey: branchKey ?? '' } })
    const file = existing
      ? await ctx.db.figmaFile.update({ where: { id: existing.id }, data: fileData })
      : await ctx.db.figmaFile.create({ data: { storeId: ctx.store.id, fileKey: plan.fileKey, branchKey: branchKey ?? '', ...fileData } })

    const created = await ctx.db.designImport.create({
      data: { storeId: ctx.store.id, fileId: file.id, status: 'QUEUED', figmaVersion: structure.version, selectedNodeIds: nodeIds, pageAssignments: plan.pages, createdBy: ctx.user.id },
    })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.import.create', entityType: 'DesignImport', entityId: created.id, diff: { fileKey: plan.fileKey, branchKey, pages: plan.pages.length, frames: nodeIds.length } })
    background(kickWorker)
    return NextResponse.json(publicImport({ ...created, file }), { status: 201, headers: noStore })
  } catch (error) { return failure(error) }
}
