// Install a reviewed import (new draft page versions + design system), or apply a re-sync. Never publishes.
import { HttpError } from '@/backend/lib/auth'
import { invalidateAll } from '@/backend/lib/memo'
import type { StoreDb } from '@/backend/lib/tenancy'
import { cleanSections, nextVersionNumber } from '@/backend/lib/store-pages'
import { designTokensSchema, type DesignTokens } from '@/shared/design-tokens'
import { slugFor, type StorePageType } from '@/shared/store-pages'
import type { SectionInstance } from '@/shared/sections/registry'
import type { ImportResult } from './pipeline'
import type { MappedPage } from './mapping'
import { applyDecisions, diffSections, diffTokens, type Decision } from './diff'

type Ctx = { db: StoreDb; store: { id: string } }

/** Unresolved image references (asset failed) become empty images, so the page validates and the editor shows them. */
function dropPending(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropPending)
  if (!value || typeof value !== 'object') return value
  const o = value as Record<string, unknown>
  if (typeof o.url === 'string' && o.url.startsWith('pending:')) return null
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'tree' ? v : dropPending(v)]))
}

export const pageSlug = (p: MappedPage) => slugFor(p.type as StorePageType, p.slug)

async function findOrCreatePage(ctx: Ctx, p: MappedPage, fileId: string, frameRender?: string) {
  const slug = pageSlug(p)
  const existing = await ctx.db.storePage.findFirst({ where: { slug } })
  if (existing) return existing
  return ctx.db.storePage.create({
    data: { storeId: ctx.store.id, type: p.type as StorePageType, slug, title: p.title.slice(0, 120), sourceFileId: fileId, seo: { title: p.title.slice(0, 70), ...(frameRender ? { ogImage: frameRender } : {}) } },
  })
}

async function saveTokens(ctx: Ctx, tokens: DesignTokens, importId: string, userId: string) {
  const parsed = designTokensSchema.safeParse(tokens)
  if (!parsed.success) throw new HttpError(400, `Extracted design tokens are invalid: ${parsed.error.issues[0]?.message}`)
  const last = await ctx.db.designSystem.findFirst({ orderBy: { version: 'desc' } })
  const active = await ctx.db.designSystem.findFirst({ where: { status: 'ACTIVE' } })
  // The first design system becomes active (nothing renders it until pages are published); later ones are drafts.
  return ctx.db.designSystem.create({ data: { storeId: ctx.store.id, importId, version: (last?.version ?? 0) + 1, status: active ? 'DRAFT' : 'ACTIVE', tokens: parsed.data, createdBy: userId } })
}

export async function installImport(ctx: Ctx, importId: string, userId: string) {
  const job = await ctx.db.designImport.findFirst({ where: { id: importId } })
  if (!job) throw new HttpError(404, 'Import not found')
  if (job.kind !== 'INSTALL') throw new HttpError(400, 'Re-sync imports are applied from the updates review')
  if (job.status !== 'REVIEW') throw new HttpError(409, `Only imports in review can be installed (this one is ${job.status.toLowerCase()})`)
  const result = (job.result ?? {}) as ImportResult
  const pages = result.pages ?? []
  const prepared = pages.map((p) => ({ page: p, sections: cleanSections(dropPending(p.sections)) }))

  const installed: { pageId: string; slug: string; version: number }[] = []
  for (const { page: p, sections } of prepared) {
    const page = await findOrCreatePage(ctx, p, job.fileId, result.frameRenders?.[p.frames.find((f) => f.device === 'desktop')?.nodeId ?? p.frames[0]?.nodeId])
    // An unpublished draft is kept in history (archived) rather than overwritten.
    await ctx.db.storePageVersion.updateMany({ where: { pageId: page.id, status: 'DRAFT' }, data: { status: 'ARCHIVED' } })
    const version = await ctx.db.storePageVersion.create({
      data: { storeId: ctx.store.id, pageId: page.id, version: await nextVersionNumber(ctx, page.id), sections: sections as object[], status: 'DRAFT', sourceImportId: job.id, createdBy: userId },
    })
    installed.push({ pageId: page.id, slug: page.slug, version: version.version })
  }
  const designSystem = result.tokens ? await saveTokens(ctx, result.tokens, job.id, userId) : null
  await ctx.db.designImport.update({ where: { id: job.id }, data: { status: 'INSTALLED', installedAt: new Date() } })
  invalidateAll()
  return { pages: installed, designSystem: designSystem ? { id: designSystem.id, version: designSystem.version, status: designSystem.status } : null }
}

/** Current sections of the page a mapped page would install into (draft first, then published). */
async function currentSections(ctx: Ctx, p: MappedPage) {
  const page = await ctx.db.storePage.findFirst({ where: { slug: pageSlug(p) } })
  if (!page) return { page: null, sections: [] as SectionInstance[] }
  const draft = await ctx.db.storePageVersion.findFirst({ where: { pageId: page.id, status: 'DRAFT' } })
  const published = page.publishedVersionId ? await ctx.db.storePageVersion.findFirst({ where: { id: page.publishedVersionId } }) : null
  return { page, sections: ((draft ?? published)?.sections ?? []) as SectionInstance[] }
}

export async function resyncDiff(ctx: Ctx, importId: string) {
  const job = await ctx.db.designImport.findFirst({ where: { id: importId } })
  if (!job || job.kind !== 'RESYNC') throw new HttpError(404, 'Re-sync not found')
  const result = (job.result ?? {}) as ImportResult
  const pages: { pageKey: string; title: string; exists: boolean; changes: ReturnType<typeof diffSections> }[] = []
  for (const p of result.pages ?? []) {
    const { page, sections } = await currentSections(ctx, p)
    pages.push({ pageKey: pageSlug(p), title: p.title, exists: !!page, changes: diffSections(sections, cleanSections(dropPending(p.sections))) })
  }
  const active = await ctx.db.designSystem.findFirst({ where: { status: 'ACTIVE' } })
  const tokens = result.tokens && active ? diffTokens(designTokensSchema.parse(active.tokens), result.tokens) : []
  return { pages, tokens }
}

/** Applies accepted changes as a NEW draft version per page. Nothing is published. */
export async function applyResync(ctx: Ctx, importId: string, userId: string, decisions: Record<string, Record<string, Decision>>, acceptTokens: boolean) {
  const job = await ctx.db.designImport.findFirst({ where: { id: importId } })
  if (!job || job.kind !== 'RESYNC') throw new HttpError(404, 'Re-sync not found')
  if (job.status !== 'REVIEW') throw new HttpError(409, 'This re-sync is not ready for review')
  const result = (job.result ?? {}) as ImportResult
  const updated: { slug: string; version: number }[] = []
  for (const p of result.pages ?? []) {
    const key = pageSlug(p)
    const pageDecisions = decisions[key] ?? {}
    if (!Object.values(pageDecisions).some((d) => d.accept)) continue
    const incoming = cleanSections(dropPending(p.sections))
    const page = (await ctx.db.storePage.findFirst({ where: { slug: key } })) ?? await findOrCreatePage(ctx, p, job.fileId)
    // Start from the open draft (kept in history as archived) or the published version.
    const { sections: current } = await currentSections(ctx, p)
    const next = cleanSections(applyDecisions(current, diffSections(current, incoming), pageDecisions))
    await ctx.db.storePageVersion.updateMany({ where: { pageId: page.id, status: 'DRAFT' }, data: { status: 'ARCHIVED' } })
    const version = await ctx.db.storePageVersion.create({ data: { storeId: ctx.store.id, pageId: page.id, version: await nextVersionNumber(ctx, page.id), sections: next as object[], status: 'DRAFT', sourceImportId: job.id, createdBy: userId } })
    updated.push({ slug: key, version: version.version })
  }
  const designSystem = acceptTokens && result.tokens ? await saveTokens(ctx, result.tokens, job.id, userId) : null
  await ctx.db.designImport.update({ where: { id: job.id }, data: { status: 'INSTALLED', installedAt: new Date() } })
  await ctx.db.figmaFile.update({ where: { id: job.fileId }, data: { version: job.figmaVersion } })
  invalidateAll()
  return { pages: updated, designSystem: designSystem ? { id: designSystem.id, version: designSystem.version, status: designSystem.status } : null }
}
