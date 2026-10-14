// Store pages and their versions: one editable DRAFT per page (optimistic concurrency via `revision`), immutable
// PUBLISHED/ARCHIVED versions, publish with a blocking checklist, rollback to any version.
import type { StorePage, StorePageVersion } from '@prisma/client'
import { HttpError } from '@/backend/lib/auth'
import { invalidateAll } from '@/backend/lib/memo'
import type { StoreDb } from '@/backend/lib/tenancy'
import { pageSectionsSchema, validateSection, type SectionInstance } from '@/shared/sections/registry'
import { contrastIssues, designTokensSchema } from '@/shared/design-tokens'
import { prePublishChecklist, type ChecklistItem } from '@/shared/store-pages'

type Ctx = { db: StoreDb; store: { id: string } }

/** Validates every section against the registry and returns the normalized list (defaults applied). */
export function cleanSections(input: unknown): SectionInstance[] {
  const list = pageSectionsSchema.safeParse(input)
  if (!list.success) throw new HttpError(400, `Invalid page sections: ${list.error.issues[0]?.message}`)
  return list.data.map((raw, i) => {
    const v = validateSection(raw)
    if (!v.ok) throw new HttpError(400, `Section ${i + 1} (${raw.type}): ${v.issues[0]?.path} ${v.issues[0]?.message}`)
    return v.section
  })
}

export async function nextVersionNumber(ctx: Ctx, pageId: string) {
  const last = await ctx.db.storePageVersion.findFirst({ where: { pageId }, orderBy: { version: 'desc' } })
  return (last?.version ?? 0) + 1
}

/** The page's draft, created from the published version when there is none. */
export async function ensureDraft(ctx: Ctx, page: StorePage, userId: string): Promise<StorePageVersion> {
  const draft = await ctx.db.storePageVersion.findFirst({ where: { pageId: page.id, status: 'DRAFT' } })
  if (draft) return draft
  const published = page.publishedVersionId ? await ctx.db.storePageVersion.findFirst({ where: { id: page.publishedVersionId } }) : null
  return ctx.db.storePageVersion.create({
    data: { storeId: ctx.store.id, pageId: page.id, version: await nextVersionNumber(ctx, page.id), sections: (published?.sections ?? []) as object[], status: 'DRAFT', createdBy: userId },
  })
}

/** Autosave: only succeeds when the client edited the latest revision (409 otherwise). */
export async function saveDraft(ctx: Ctx, page: StorePage, sections: unknown, revision: number, userId: string) {
  const clean = cleanSections(sections)
  const draft = await ensureDraft(ctx, page, userId)
  const res = await ctx.db.storePageVersion.updateMany({ where: { id: draft.id, status: 'DRAFT', revision }, data: { sections: clean as object[], revision: { increment: 1 } } })
  if (res.count !== 1) throw new HttpError(409, 'This page was changed elsewhere. Reload to get the latest version before saving.')
  return { versionId: draft.id, version: draft.version, revision: revision + 1, sections: clean }
}

export async function publishedSlugs(ctx: Ctx) {
  const pages = await ctx.db.storePage.findMany({ where: { publishedVersionId: { not: null } } })
  return new Set(pages.map((p) => p.slug))
}

export async function checklistFor(ctx: Ctx, page: StorePage, sections: unknown[]): Promise<ChecklistItem[]> {
  const slugs = await publishedSlugs(ctx)
  slugs.add(page.slug) // the page being published counts as existing
  const ds = await ctx.db.designSystem.findFirst({ where: { status: 'ACTIVE' } })
  const tokens = ds ? designTokensSchema.safeParse(ds.tokens) : null
  const contrast = tokens?.success ? contrastIssues(tokens.data).map((c) => `Text colour “${c.text}” on “${c.background}” has contrast ${c.ratio}:1 (AA needs 4.5:1).`) : []
  return prePublishChecklist(sections, slugs, contrast)
}

/** Publishes the draft (or the given version, for rollback) as a new immutable version. */
export async function publish(ctx: Ctx, page: StorePage, userId: string, options: { revision?: number; fromVersionId?: string } = {}) {
  let sections: SectionInstance[]
  let source: StorePageVersion | null
  if (options.fromVersionId) {
    source = await ctx.db.storePageVersion.findFirst({ where: { id: options.fromVersionId, pageId: page.id } })
    if (!source) throw new HttpError(404, 'Version not found')
  } else {
    source = await ctx.db.storePageVersion.findFirst({ where: { pageId: page.id, status: 'DRAFT' } })
    if (!source) throw new HttpError(409, 'There are no unpublished changes')
    if (options.revision !== undefined && source.revision !== options.revision) throw new HttpError(409, 'This page was changed elsewhere. Reload before publishing.')
  }
  sections = cleanSections(source.sections)
  const blocking = (await checklistFor(ctx, page, sections)).filter((i) => i.level === 'error')
  if (blocking.length) throw Object.assign(new HttpError(422, `Fix ${blocking.length} issue${blocking.length === 1 ? '' : 's'} before publishing: ${blocking[0].message}`), { checklist: blocking })

  const now = new Date()
  let published: StorePageVersion
  if (!options.fromVersionId) {
    const res = await ctx.db.storePageVersion.updateMany({ where: { id: source.id, status: 'DRAFT', revision: source.revision }, data: { status: 'PUBLISHED', publishedAt: now, sections: sections as object[] } })
    if (res.count !== 1) throw new HttpError(409, 'This page was changed elsewhere. Reload before publishing.')
    published = { ...source, status: 'PUBLISHED', publishedAt: now }
  } else {
    // Rollback: a new version with the old content, so history stays linear; any open draft is archived.
    await ctx.db.storePageVersion.updateMany({ where: { pageId: page.id, status: 'DRAFT' }, data: { status: 'ARCHIVED' } })
    published = await ctx.db.storePageVersion.create({
      data: { storeId: ctx.store.id, pageId: page.id, version: await nextVersionNumber(ctx, page.id), sections: sections as object[], status: 'PUBLISHED', publishedAt: now, createdBy: userId, sourceImportId: source.sourceImportId },
    })
  }
  await ctx.db.storePageVersion.updateMany({ where: { pageId: page.id, status: 'PUBLISHED', id: { not: published.id } }, data: { status: 'ARCHIVED' } })
  await ctx.db.storePage.update({ where: { id: page.id }, data: { publishedVersionId: published.id } })
  invalidateAll()
  return published
}
