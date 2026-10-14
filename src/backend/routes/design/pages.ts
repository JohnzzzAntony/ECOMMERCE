// Page editor API (Phase 9): pages, drafts (autosave with optimistic concurrency), publish with checklist, version
// history, rollback, SEO, preview tokens and preview data. EDITOR and above edit; VIEWER reads.
import type { StorePage } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { invalidateAll } from '@/backend/lib/memo'
import { audit, requireStoreRole } from '@/backend/lib/tenancy'
import { checklistFor, ensureDraft, publish, saveDraft } from '@/backend/lib/store-pages'
import { renderPreview } from '@/backend/lib/storefront'
import { signPreviewToken } from '@/backend/lib/preview-token'
import { PAGE_SLUG, pageUrl, seoSchema, slugFor, STORE_PAGE_TYPES, type StorePageType } from '@/shared/store-pages'

const noStore = { 'Cache-Control': 'no-store' }
type Params = { params: Promise<{ id: string }> }
const ID = /^[a-z0-9]{10,40}$/

async function loadPage(ctx: Awaited<ReturnType<typeof requireStoreRole>>, id: string) {
  if (!ID.test(id)) throw new HttpError(400, 'Invalid page id')
  const page = await ctx.db.storePage.findFirst({ where: { id } })
  if (!page) throw new HttpError(404, 'Page not found')
  return page
}

const summary = (p: StorePage, hasDraft: boolean) => ({ id: p.id, type: p.type, slug: p.slug, title: p.title, published: !!p.publishedVersionId, hasDraft, url: pageUrl(p.type as StorePageType, p.slug), updatedAt: p.updatedAt })

export async function listPages(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const pages = await ctx.db.storePage.findMany({ orderBy: [{ type: 'asc' }, { title: 'asc' }] })
    const drafts = await ctx.db.storePageVersion.findMany({ where: { status: 'DRAFT' } })
    const withDraft = new Set(drafts.map((d) => d.pageId))
    return NextResponse.json(pages.map((p) => summary(p, withDraft.has(p.id))), { headers: noStore })
  } catch (error) { return failure(error) }
}

const createSchema = z.object({ type: z.enum(STORE_PAGE_TYPES), title: z.string().trim().min(1).max(120), slug: z.string().regex(PAGE_SLUG).max(80).optional() })

export async function createPage(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const body = createSchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid page')
    const { type, title } = body.data
    if (type === 'PAGE' && !body.data.slug) throw new HttpError(400, 'Content pages need a URL slug')
    const slug = slugFor(type, body.data.slug)
    if (await ctx.db.storePage.findFirst({ where: { slug } })) throw new HttpError(409, type === 'PAGE' ? 'A page with that URL already exists' : 'This store already has that page')
    const page = await ctx.db.storePage.create({ data: { storeId: ctx.store.id, type, slug, title, seo: { title: title.slice(0, 70) } } })
    await ensureDraft(ctx, page, ctx.user.id)
    await audit(ctx, request, { actorId: ctx.user.id, action: 'page.create', entityType: 'StorePage', entityId: page.id, diff: { type, slug } })
    return NextResponse.json(summary(page, true), { status: 201, headers: noStore })
  } catch (error) { return failure(error) }
}

export async function getPage(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const page = await loadPage(ctx, (await params).id)
    const versions = await ctx.db.storePageVersion.findMany({ where: { pageId: page.id }, orderBy: { version: 'desc' }, take: 100 })
    const draft = versions.find((v) => v.status === 'DRAFT')
    const published = versions.find((v) => v.id === page.publishedVersionId)
    const current = draft ?? published
    return NextResponse.json({
      page: { ...summary(page, !!draft), seo: seoSchema.catch({}).parse(page.seo) },
      draft: current ? { versionId: current.id, version: current.version, status: current.status, revision: current.revision, sections: current.sections } : null,
      versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, createdAt: v.createdAt, publishedAt: v.publishedAt, createdBy: v.createdBy, sourceImportId: v.sourceImportId })),
    }, { headers: noStore })
  } catch (error) { return failure(error) }
}

const draftSchema = z.object({ sections: z.array(z.unknown()).max(80), revision: z.number().int().min(0) })

/** Autosave. Answers 409 when someone else saved first (the client must reload). */
export async function putDraft(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const page = await loadPage(ctx, (await params).id)
    const body = draftSchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, 'Invalid draft')
    return NextResponse.json(await saveDraft(ctx, page, body.data.sections, body.data.revision, ctx.user.id), { headers: noStore })
  } catch (error) { return failure(error) }
}

const metaSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), slug: z.string().regex(PAGE_SLUG).max(80).optional(), seo: seoSchema.optional() })

export async function patchPage(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const page = await loadPage(ctx, (await params).id)
    const body = metaSchema.safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, body.error.issues[0]?.message ?? 'Invalid page settings')
    if (body.data.slug && page.type !== 'PAGE') throw new HttpError(400, 'Only content pages have their own URL')
    if (body.data.slug && body.data.slug !== page.slug && await ctx.db.storePage.findFirst({ where: { slug: body.data.slug } })) throw new HttpError(409, 'A page with that URL already exists')
    const updated = await ctx.db.storePage.update({ where: { id: page.id }, data: { ...(body.data.title ? { title: body.data.title } : {}), ...(body.data.slug ? { slug: body.data.slug } : {}), ...(body.data.seo ? { seo: body.data.seo } : {}) } })
    invalidateAll()
    await audit(ctx, request, { actorId: ctx.user.id, action: 'page.update', entityType: 'StorePage', entityId: page.id, diff: body.data })
    return NextResponse.json({ ...summary(updated, true), seo: seoSchema.catch({}).parse(updated.seo) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function deletePage(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'ADMIN')
    const page = await loadPage(ctx, (await params).id)
    await ctx.db.storePage.update({ where: { id: page.id }, data: { publishedVersionId: null } })
    await ctx.db.storePageVersion.deleteMany({ where: { pageId: page.id } })
    await ctx.db.storePage.deleteMany({ where: { id: page.id } })
    invalidateAll()
    await audit(ctx, request, { actorId: ctx.user.id, action: 'page.delete', entityType: 'StorePage', entityId: page.id, diff: { slug: page.slug, type: page.type } })
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function getChecklist(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const page = await loadPage(ctx, (await params).id)
    const draft = await ctx.db.storePageVersion.findFirst({ where: { pageId: page.id, status: 'DRAFT' } })
    const source = draft ?? (page.publishedVersionId ? await ctx.db.storePageVersion.findFirst({ where: { id: page.publishedVersionId } }) : null)
    return NextResponse.json({ items: await checklistFor(ctx, page, (source?.sections ?? []) as unknown[]) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function publishRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const page = await loadPage(ctx, (await params).id)
    const body = z.object({ revision: z.number().int().min(0).optional() }).safeParse(await readJson(request))
    const version = await publish(ctx, page, ctx.user.id, { revision: body.success ? body.data.revision : undefined })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'page.publish', entityType: 'StorePage', entityId: page.id, diff: { version: version.version } })
    return NextResponse.json({ versionId: version.id, version: version.version }, { headers: noStore })
  } catch (error) {
    const checklist = (error as { checklist?: unknown }).checklist
    if (checklist && error instanceof HttpError) return NextResponse.json({ error: error.message, checklist }, { status: error.status })
    return failure(error)
  }
}

export async function rollbackRoute(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const page = await loadPage(ctx, (await params).id)
    const body = z.object({ versionId: z.string().regex(ID) }).safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, 'Choose a version')
    const version = await publish(ctx, page, ctx.user.id, { fromVersionId: body.data.versionId })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'page.rollback', entityType: 'StorePage', entityId: page.id, diff: { fromVersionId: body.data.versionId, version: version.version } })
    return NextResponse.json({ versionId: version.id, version: version.version }, { headers: noStore })
  } catch (error) {
    const checklist = (error as { checklist?: unknown }).checklist
    if (checklist && error instanceof HttpError) return NextResponse.json({ error: error.message, checklist }, { status: error.status })
    return failure(error)
  }
}

/** Short-lived token for the preview iframe (?token=...), bound to this store and page. */
export async function previewToken(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const page = await loadPage(ctx, (await params).id)
    return NextResponse.json({ token: signPreviewToken({ storeId: ctx.store.id, kind: 'page', id: page.id }) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Rendering data (catalog products etc.) for unsaved sections in the preview. */
export async function previewData(request: Request, { params }: Params) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const page = await loadPage(ctx, (await params).id)
    const body = z.object({ sections: z.array(z.unknown()).max(80) }).safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, 'Invalid sections')
    return NextResponse.json(await renderPreview(ctx.store.id, page.type as StorePageType, body.data.sections, page.title), { headers: noStore })
  } catch (error) { return failure(error) }
}
