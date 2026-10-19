// Import pipeline: QUEUED → FETCHING → NORMALIZING → TOKENS → MAPPING → ASSETS → REVIEW (→ INSTALLED by an admin) | FAILED.
// Jobs live in the DesignImport table (Postgres queue, SKIP LOCKED; AUDIT.md C4). Every stage stores its output
// before the status advances, and skips itself when that output already exists, so a crashed or retried job
// resumes where it stopped.
import type { DesignImport, DesignImportStatus } from '@prisma/client'
import { db } from '@/backend/lib/db'
import { HttpError } from '@/backend/lib/auth'
import { log } from '@/backend/lib/log'
import { storeDb, systemDb, type StoreDb } from '@/backend/lib/tenancy'
import { figmaAuth } from '@/backend/lib/figma/connection'
import { FigmaApiError, figmaRequest, type FigmaAuth } from '@/backend/lib/figma/client'
import { apiKey } from '@/backend/lib/figma/files'
import { IR_KEYS, walkIR, type IRDocument, type IRNode, type IRWarning } from '@/shared/design-ir'
import type { ImportPlan } from '@/shared/design-plan'
import type { DesignTokens } from '@/shared/design-tokens'
import { changeTargets, newContext, normalizeNode, type FigmaNode } from './normalize'
import { extractTokens } from './tokens'
import { mapPage, type MappedPage, type SavedMapping } from './mapping'
import { AssetError, FIGMA_ASSET_HOSTS, processImage, safeFetch, storeAsset, type StoredAsset } from './assets'
import { selfHostGoogleFont } from './fonts'
import { getSnapshot, putSnapshot, snapshotKey } from './storage'

export type ImportResult = {
  tokens?: DesignTokens
  pages?: MappedPage[]
  frameRenders?: Record<string, string>
  assets?: Record<string, StoredAsset> // "img:<imageRef>" | "svg:<nodeId>" → stored asset
  assetsDone?: boolean
}
type RawNode = { document: FigmaNode; components?: Record<string, { name: string; componentSetId?: string }>; componentSets?: Record<string, { name: string }>; styles?: Record<string, { name: string; styleType?: string }> } | null
export type RawSnapshot = {
  file: { name: string; version: string; lastModified: string }
  nodes: Record<string, RawNode>
  /** Component variants that "Change to" interactions point at (fetched separately; not part of the frames). */
  variants?: Record<string, RawNode>
}

export const STAGES: DesignImportStatus[] = ['QUEUED', 'FETCHING', 'NORMALIZING', 'TOKENS', 'MAPPING', 'ASSETS', 'REVIEW']
export const progressOf = (status: DesignImportStatus) => (status === 'INSTALLED' ? 100 : status === 'FAILED' ? 0 : Math.round((STAGES.indexOf(status) / (STAGES.length - 1)) * 100))
const ACTIVE: DesignImportStatus[] = ['QUEUED', 'FETCHING', 'NORMALIZING', 'TOKENS', 'MAPPING', 'ASSETS']
const MAX_ATTEMPTS = 5
const LOCK_MS = 10 * 60_000
const NODES_BATCH = 5
const MAX_VARIANTS = 200
const LONG_RATE_LIMIT_MS = 15 * 60_000

type Ctx = { db: StoreDb; store: { id: string } }
type Job = DesignImport & { file: { fileKey: string; branchKey: string } }

const plan = (job: Job) => job.pageAssignments as unknown as ImportPlan['pages']
const resultOf = (job: Job) => (job.result ?? {}) as ImportResult

async function advance(ctx: Ctx, job: Job, data: Partial<Pick<DesignImport, 'status' | 'rawSnapshotKey' | 'irSnapshotKey' | 'figmaVersion'>> & { result?: ImportResult; warnings?: IRWarning[]; stats?: object }) {
  const updated = await ctx.db.designImport.update({
    where: { id: job.id },
    data: { ...data, ...(data.result ? { result: data.result as object } : {}), ...(data.warnings ? { warnings: data.warnings as object[] } : {}), lockedAt: new Date() },
  })
  Object.assign(job, updated)
}

// ---------------------------------------------------------------- stages
async function fetchStage(ctx: Ctx, job: Job, auth: FigmaAuth) {
  if (job.rawSnapshotKey) return
  await advance(ctx, job, { status: 'FETCHING' })
  const key = apiKey(job.file.fileKey, job.file.branchKey || null)
  const meta = await figmaRequest<{ name: string; version: string; lastModified: string }>(`/v1/files/${key}?depth=1`, auth)
  const nodes: RawSnapshot['nodes'] = {}
  for (let i = 0; i < job.selectedNodeIds.length; i += NODES_BATCH) {
    const ids = job.selectedNodeIds.slice(i, i + NODES_BATCH)
    const res = await figmaRequest<{ nodes: RawSnapshot['nodes'] }>(`/v1/files/${key}/nodes?ids=${encodeURIComponent(ids.join(','))}&version=${encodeURIComponent(meta.version)}`, auth)
    Object.assign(nodes, res.nodes)
  }
  const missing = job.selectedNodeIds.filter((id) => !nodes[id]?.document)
  if (missing.length) throw new HttpError(400, `Frames no longer exist in the Figma file: ${missing.join(', ')}`)
  const variants = await fetchVariants(key, auth, nodes, meta.version)
  const raw: RawSnapshot = { file: { name: meta.name, version: meta.version, lastModified: meta.lastModified }, nodes, variants }
  const rawKey = await putSnapshot(ctx.store.id, snapshotKey(ctx.store.id, job.file.fileKey, job.id, 'raw'), raw)
  await ctx.db.figmaFile.update({ where: { id: job.fileId }, data: { name: meta.name, version: meta.version, lastModified: new Date(meta.lastModified), latestVersion: meta.version, lastCheckedAt: new Date() } })
  await advance(ctx, job, { rawSnapshotKey: rawKey, figmaVersion: meta.version, stats: { frames: job.selectedNodeIds.length } })
}

/** Variants that interactions in the frames (and in those variants, for loops) change to, outside the frames. */
async function fetchVariants(key: string, auth: FigmaAuth, nodes: RawSnapshot['nodes'], version: string) {
  const variants: NonNullable<RawSnapshot['variants']> = {}
  const known = new Set<string>()
  const collect = (n: FigmaNode) => { known.add(n.id); n.children?.forEach(collect) }
  Object.values(nodes).forEach((n) => n && collect(n.document))
  let pending = new Set<string>()
  Object.values(nodes).forEach((n) => n && changeTargets(n.document, pending))
  while (pending.size) {
    const ids = [...pending].filter((id) => !known.has(id) && /^\d+:\d+$/.test(id)).slice(0, MAX_VARIANTS - Object.keys(variants).length)
    if (!ids.length) break
    const next = new Set<string>()
    for (let i = 0; i < ids.length; i += 50) {
      const res = await figmaRequest<{ nodes: RawSnapshot['nodes'] }>(`/v1/files/${key}/nodes?ids=${encodeURIComponent(ids.slice(i, i + 50).join(','))}&version=${encodeURIComponent(version)}`, auth)
      for (const id of ids.slice(i, i + 50)) {
        known.add(id)
        const n = res.nodes?.[id]
        if (!n?.document) continue
        variants[id] = n
        collect(n.document); changeTargets(n.document, next)
      }
    }
    pending = next
  }
  return variants
}

export function buildIR(raw: RawSnapshot, pages: ImportPlan['pages'], fileKey: string): IRDocument {
  const styles = {}, components = {}, componentSets = {}
  const all = [...Object.values(raw.nodes), ...Object.values(raw.variants ?? {})]
  for (const n of all) { Object.assign(styles, n?.styles); Object.assign(components, n?.components); Object.assign(componentSets, n?.componentSets) }
  const ctx = newContext(styles, components, componentSets)
  // Variants may also live inside the selected frames (e.g. a component placed on the page).
  const byId = new Map<string, FigmaNode>()
  const index = (n: FigmaNode) => { byId.set(n.id, n); n.children?.forEach(index) }
  for (const n of all) if (n) index(n.document)
  const variants: Record<string, IRNode> = {}
  const targets = new Set<string>()
  for (const n of all) if (n) changeTargets(n.document, targets)
  const vctx = newContext(styles, components, componentSets) // variant layout warnings aren't actionable; fonts are kept
  for (const id of targets) {
    const node = byId.get(id)
    const ir = node && normalizeNode(node, vctx, null, 1)
    if (ir) variants[id] = ir
  }
  for (const [family, f] of vctx.fonts) {
    const cur = ctx.fonts.get(family) ?? { weights: new Set<number>(), italic: false }
    f.weights.forEach((w) => cur.weights.add(w)); cur.italic ||= f.italic
    ctx.fonts.set(family, cur)
  }
  const irPages = pages.map((p) => ({
    title: p.title, type: p.type, ...(p.slug ? { slug: p.slug } : {}), ...(p.layout ? { layout: p.layout } : {}),
    frames: (['desktop', 'tablet', 'mobile'] as const).flatMap((device) => {
      const id = p.frames[device]
      const doc = id ? raw.nodes[id]?.document : undefined
      // A frame selected for import is imported even if it is hidden in Figma.
      const root = doc ? normalizeNode({ ...doc, visible: true }, ctx) : null
      return root ? [{ nodeId: id!, name: doc!.name, device, root }] : []
    }),
  }))
  for (const w of ctx.warnings) {
    const page = irPages.find((p) => p.frames.some((f) => { let hit = false; walkIR(f.root, (n) => { hit ||= n.id === w.nodeId }); return hit }))
    if (page) w.pageTitle = page.title
  }
  return {
    fileKey, version: raw.file.version, pages: irPages, warnings: ctx.warnings, ...(Object.keys(variants).length ? { variants } : {}),
    fonts: [...ctx.fonts.entries()].map(([family, f]) => ({ family, weights: [...f.weights].sort((a, b) => a - b), italic: f.italic })),
  }
}

async function normalizeStage(ctx: Ctx, job: Job) {
  if (job.irSnapshotKey) return
  await advance(ctx, job, { status: 'NORMALIZING' })
  const raw = await getSnapshot<RawSnapshot>(ctx.store.id, job.rawSnapshotKey!)
  const ir = buildIR(raw, plan(job), job.file.fileKey)
  const irKey = await putSnapshot(ctx.store.id, snapshotKey(ctx.store.id, job.file.fileKey, job.id, 'ir'), ir)
  await advance(ctx, job, { irSnapshotKey: irKey, warnings: ir.warnings })
}

async function tokensStage(ctx: Ctx, job: Job, ir: () => Promise<IRDocument>) {
  if (resultOf(job).tokens) return
  await advance(ctx, job, { status: 'TOKENS' })
  const { tokens, warnings } = extractTokens(await ir())
  await advance(ctx, job, { result: { ...resultOf(job), tokens }, warnings: [...(job.warnings as IRWarning[]), ...warnings] })
}

export async function savedMappings(ctx: Ctx, fileKey: string) {
  const rows = await ctx.db.sectionMapping.findMany({ where: { fileKey } })
  return new Map<string, SavedMapping>(rows.map((r) => [r.nodeId, { sectionType: r.sectionType, fieldMap: r.fieldMap as Record<string, string> }]))
}

/** Frame id → slug the page will have, for prototype links between imported frames. */
export function framePages(pages: ImportPlan['pages']) {
  const map = new Map<string, string>()
  for (const p of pages) {
    const slug = p.type === 'HOME' ? '' : p.type === 'PAGE' ? p.slug ?? '' : p.type === 'CART' ? '_cart' : null
    if (slug === null) continue
    for (const id of Object.values(p.frames)) if (id) map.set(id, slug)
  }
  return map
}

async function mappingStage(ctx: Ctx, job: Job, ir: () => Promise<IRDocument>) {
  if (resultOf(job).pages) return
  await advance(ctx, job, { status: 'MAPPING' })
  const doc = await ir()
  const mctx = { saved: await savedMappings(ctx, job.file.fileKey), framePages: framePages(plan(job)), variants: doc.variants }
  const pages = doc.pages.filter((p) => p.frames.length).map((p) => mapPage(p, job.file.fileKey, mctx))
  const warnings = [...(job.warnings as IRWarning[]), ...pages.flatMap((p) => p.warnings)]
  await advance(ctx, job, { result: { ...resultOf(job), pages }, warnings, stats: { ...(job.stats as object), sections: pages.reduce((n, p) => n + p.sections.length, 0) } })
}

// ---- assets ----
/** Every pending image reference in the mapped pages: "img:<imageRef>" or "svg:<nodeId>". */
export function pendingRefs(pages: MappedPage[]) {
  const refs = new Set<string>()
  const visit = (v: unknown, inTree = false) => {
    if (Array.isArray(v)) { v.forEach((x) => visit(x, inTree)); return }
    if (!v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string' && o.url.startsWith('pending:')) refs.add(o.url.slice('pending:'.length))
    if (inTree && o.kind && Array.isArray(o.children)) {
      const n = o as unknown as IRNode
      if (n.image?.imageRef) refs.add(`img:${n.image.imageRef}`)
      if (n.kind === 'vector') refs.add(`svg:${n.id}`)
      for (const p of n.fills) if (p.type === 'image') refs.add(`img:${p.imageRef}`)
    }
    for (const [k, x] of Object.entries(o)) visit(x, inTree || IR_KEYS.has(k))
  }
  for (const p of pages) visit(p.sections)
  return [...refs]
}

/** Replaces pending references with stored URLs (or null when the asset failed). */
export function resolveRefs(pages: MappedPage[], assets: Record<string, StoredAsset>) {
  const visit = (v: unknown, inTree = false): unknown => {
    if (Array.isArray(v)) return v.map((x) => visit(x, inTree))
    if (!v || typeof v !== 'object') return v
    const o = { ...(v as Record<string, unknown>) }
    if (typeof o.url === 'string' && o.url.startsWith('pending:')) {
      const a = assets[o.url.slice('pending:'.length)]
      return a ? { ...o, url: a.url, width: a.width, height: a.height, assetId: a.id, ...(a.blurhash ? { blurhash: a.blurhash } : {}) } : null
    }
    const irNode = inTree && !!o.kind && Array.isArray(o.children)
    if (irNode) {
      const n = o as unknown as IRNode
      if (n.image?.imageRef) o.image = { ...n.image, assetUrl: assets[`img:${n.image.imageRef}`]?.url }
      if (n.kind === 'vector') o.vector = { assetUrl: assets[`svg:${n.id}`]?.url }
      o.fills = n.fills.map((p) => (p.type === 'image' ? { ...p, assetUrl: assets[`img:${p.imageRef}`]?.url } : p))
    }
    for (const [k, x] of Object.entries(o)) if (!irNode || (k !== 'fills' && k !== 'image' && k !== 'vector')) o[k] = visit(x, inTree || IR_KEYS.has(k))
    return o
  }
  return pages.map((p) => ({ ...p, sections: visit(p.sections) as MappedPage['sections'] }))
}

async function assetsStage(ctx: Ctx, job: Job, auth: FigmaAuth, ir: () => Promise<IRDocument>) {
  const result = resultOf(job)
  if (result.assetsDone) return
  await advance(ctx, job, { status: 'ASSETS' })
  const key = apiKey(job.file.fileKey, job.file.branchKey || null)
  const pages = result.pages ?? []
  const refs = pendingRefs(pages)
  const assets: Record<string, StoredAsset> = { ...(result.assets ?? {}) }
  const warnings: IRWarning[] = [...(job.warnings as IRWarning[])]
  const altFor = new Map<string, { alt: string; nodeId?: string }>()
  const collectAlt = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(collectAlt)
    if (!v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string' && o.url.startsWith('pending:')) altFor.set(o.url.slice(8), { alt: String(o.alt ?? '') })
    Object.values(o).forEach(collectAlt)
  }
  pages.forEach((p) => collectAlt(p.sections))

  // Fresh, short-lived download URLs: image fills (one call) and SVG renders (batched).
  const imageRefs = refs.filter((r) => r.startsWith('img:') && !assets[r]).map((r) => r.slice(4))
  const svgIds = refs.filter((r) => r.startsWith('svg:') && !assets[r]).map((r) => r.slice(4))
  const urls: Record<string, string> = {}
  // A rate limit lasting hours or days (low-limit Figma seats) doesn't hold the whole import: the affected images
  // are reported, and rebuilding the pages in review later copies only what is still missing.
  let limited: FigmaApiError | null = null
  const unlessLimited = async <T,>(request: () => Promise<T>) => {
    if (limited) return null
    try { return await request() } catch (error) {
      if (error instanceof FigmaApiError && error.status === 429 && (error.retryAfterMs ?? 0) > LONG_RATE_LIMIT_MS) { limited = error; return null }
      throw error
    }
  }
  if (imageRefs.length) {
    const fills = await unlessLimited(() => figmaRequest<{ meta?: { images?: Record<string, string> } }>(`/v1/files/${key}/images`, auth))
    for (const ref of imageRefs) if (fills?.meta?.images?.[ref]) urls[`img:${ref}`] = fills.meta.images[ref]
  }
  for (let i = 0; i < svgIds.length; i += 50) {
    const ids = svgIds.slice(i, i + 50)
    const res = await unlessLimited(() => figmaRequest<{ images: Record<string, string | null> }>(`/v1/images/${key}?ids=${encodeURIComponent(ids.join(','))}&format=svg&svg_outline_text=true&version=${encodeURIComponent(job.figmaVersion)}`, auth))
    for (const id of ids) if (res?.images?.[id]) urls[`svg:${id}`] = res.images[id]!
  }
  if (limited) {
    const missing = [...imageRefs.map((r) => `img:${r}`), ...svgIds.map((r) => `svg:${r}`)].filter((r) => !urls[r]).length
    warnings.push({ code: 'ASSET_FAILED', message: `${missing} image${missing === 1 ? '' : 's'} could not be copied: ${(limited as FigmaApiError).message}. Choose “Rebuild pages” later to copy them, or connect a Figma account with a Full or Dev seat.` })
  }
  let lastCheckpoint = 0
  const checkpoint = async (frameRenders = result.frameRenders) => {
    await advance(ctx, job, { result: { ...result, assets: { ...assets }, ...(frameRenders ? { frameRenders: { ...frameRenders } } : {}) }, warnings: [...warnings], stats: { ...(job.stats as object), assets: Object.keys(assets).length } })
    lastCheckpoint = Date.now()
  }
  for (const ref of [...imageRefs.map((r) => `img:${r}`), ...svgIds.map((r) => `svg:${r}`)]) {
    if (limited && !urls[ref]) continue
    try {
      if (!urls[ref]) throw new AssetError('Figma returned no download URL')
      const { data } = await safeFetch(urls[ref], FIGMA_ASSET_HOSTS)
      assets[ref] = await storeAsset(ctx, await processImage(data), { sourceNodeId: ref.startsWith('svg:') ? ref.slice(4) : undefined, alt: altFor.get(ref)?.alt })
    } catch (error) {
      log('warn', 'design asset failed', { importId: job.id, ref, error })
      warnings.push({ code: 'ASSET_FAILED', message: `An image (${ref}) could not be copied from Figma: ${error instanceof Error ? error.message : 'unknown error'}. Choose a replacement in review.` })
    }
    // Persist partial work and renew the lease during long imports, not only after all assets finish.
    if (Date.now() - lastCheckpoint >= 30_000) await checkpoint()
  }
  await checkpoint()

  // Frame renders: shown next to the live preview in review and used as default social images.
  const frameRenders: Record<string, string> = { ...(result.frameRenders ?? {}) }
  const frames = job.selectedNodeIds.filter((id) => !frameRenders[id])
  for (let i = 0; i < frames.length; i += 10) {
    const ids = frames.slice(i, i + 10)
    const res = await figmaRequest<{ images: Record<string, string | null> }>(`/v1/images/${key}?ids=${encodeURIComponent(ids.join(','))}&format=png&scale=1&version=${encodeURIComponent(job.figmaVersion)}`, auth).catch(() => ({ images: {} as Record<string, string | null> }))
    for (const id of ids) {
      if (!res.images?.[id]) continue
      try {
        const { data } = await safeFetch(res.images[id]!, FIGMA_ASSET_HOSTS)
        frameRenders[id] = (await storeAsset(ctx, await processImage(data), { sourceNodeId: id, alt: '' })).url
      } catch (error) { log('warn', 'frame render failed', { importId: job.id, id, error }) }
      if (Date.now() - lastCheckpoint >= 30_000) await checkpoint(frameRenders)
    }
  }

  await checkpoint(frameRenders)

  // Google fonts are self-hosted; others were flagged MISSING_FONT by the tokens stage.
  for (const font of (await ir()).fonts) {
    try { await selfHostGoogleFont(ctx, font.family, font.weights, font.italic) } catch (error) {
      log('warn', 'font self-hosting failed', { importId: job.id, family: font.family, error })
      warnings.push({ code: 'MISSING_FONT', message: `Font “${font.family}” could not be downloaded from Google Fonts; the fallback stack is used until it is uploaded.` })
    }
  }

  const resolved = resolveRefs(pages, assets)
  for (const page of resolved) {
    const visit = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(visit)
      if (!v || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      if (typeof o.url === 'string' && typeof o.alt === 'string' && 'decorative' in o && !o.alt && !o.decorative) warnings.push({ code: 'MISSING_ALT', pageTitle: page.title, message: `An image on “${page.title}” has no alt text.` })
      Object.entries(o).forEach(([k, x]) => !IR_KEYS.has(k) && visit(x))
    }
    visit(page.sections)
  }
  await advance(ctx, job, { result: { ...result, pages: resolved, assets, frameRenders, assetsDone: true }, warnings, stats: { ...(job.stats as object), assets: Object.keys(assets).length } })
}

// ---------------------------------------------------------------- runner
/** Runs (or resumes) every remaining stage of one claimed job. */
export async function runImport(storeId: string, importId: string) {
  const ctx: Ctx = { db: storeDb(storeId), store: { id: storeId } }
  const job = await ctx.db.designImport.findFirst({ where: { id: importId }, include: { file: true } }) as Job | null
  if (!job || !ACTIVE.includes(job.status)) return
  try {
    const auth = await figmaAuth(ctx)
    let irCache: IRDocument | null = null
    const ir = async () => (irCache ??= await getSnapshot<IRDocument>(storeId, job.irSnapshotKey!))
    await fetchStage(ctx, job, auth)
    await normalizeStage(ctx, job)
    await tokensStage(ctx, job, ir)
    await mappingStage(ctx, job, ir)
    await assetsStage(ctx, job, auth, ir)
    await ctx.db.designImport.update({ where: { id: job.id }, data: { status: 'REVIEW', lockedAt: null, error: null } })
    log('info', 'design import ready for review', { storeId, importId })
  } catch (error) {
    // Figma asked for a long pause: reschedule without using up an attempt.
    if (error instanceof FigmaApiError && error.status === 429 && error.retryAfterMs) {
      log('warn', 'design import paused by Figma rate limit', { storeId, importId, retryAfterMs: error.retryAfterMs })
      await ctx.db.designImport.update({ where: { id: job.id }, data: { lockedAt: null, runAfter: new Date(Date.now() + error.retryAfterMs), error: `Waiting: ${error.message}` } })
      return
    }
    const attempts = job.attempts + 1
    const permanent = (error instanceof HttpError && error.status < 500 && error.status !== 429) || (error instanceof FigmaApiError && [400, 403, 404].includes(error.status))
    const message = error instanceof Error ? error.message : 'Import failed'
    log('error', 'design import stage failed', { storeId, importId, status: job.status, attempts, error })
    await ctx.db.designImport.update({
      where: { id: job.id },
      data: permanent || attempts >= MAX_ATTEMPTS
        ? { status: 'FAILED', error: message.slice(0, 500), attempts, lockedAt: null }
        : { attempts, lockedAt: null, runAfter: new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** attempts)), error: `Retrying: ${message}`.slice(0, 500) },
    })
  }
}

/** Claims the oldest runnable job across stores (row lock, SKIP LOCKED) and runs it. Returns false when idle. */
export async function runNextJob(): Promise<boolean> {
  // Times are passed from the app (as Prisma stores them) rather than compared with the database clock.
  const now = new Date(), staleLock = new Date(Date.now() - LOCK_MS)
  const [, rows] = await db.$transaction([
    db.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`,
    db.$queryRaw<{ id: string; storeId: string }[]>`
      UPDATE "DesignImport" SET "lockedAt" = ${now}
      WHERE id = (
        SELECT id FROM "DesignImport"
        WHERE status IN ('QUEUED','FETCHING','NORMALIZING','TOKENS','MAPPING','ASSETS')
          AND "runAfter" <= ${now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${staleLock})
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, "storeId"`,
  ])
  const job = rows[0]
  if (!job) return false
  await runImport(job.storeId, job.id)
  return true
}

const g = globalThis as unknown as { __designWorker?: Promise<void> | null }

/** Processes jobs in this server process until the queue is empty. Safe to call often (one loop at a time). */
export function kickWorker() {
  if (g.__designWorker) return g.__designWorker
  g.__designWorker = (async () => {
    try { while (await runNextJob()); } catch (error) { log('error', 'design worker loop failed', { error }) } finally { g.__designWorker = null }
  })()
  return g.__designWorker
}

/** True when a job is waiting (used to resume after restarts when admins poll the imports list). */
export async function hasRunnableJobs() {
  return (await systemDb().designImport.count({ where: { status: { in: ACTIVE }, runAfter: { lte: new Date() }, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] } })) > 0
}
