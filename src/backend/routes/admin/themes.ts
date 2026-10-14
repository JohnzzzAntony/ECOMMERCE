// Admin theme library: upload/install, customize (settings, homepage sections, CSS), activate, export, delete.
import { NextResponse } from 'next/server'
import { strToU8, zipSync } from 'fflate'
import { db } from '@/backend/lib/db'
import { invalidateAll } from '@/backend/lib/memo'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { idParam, readJson, uniqueSlug } from '@/backend/lib/admin-resource'
import { MAX_ZIP_BYTES, readThemePackage } from '@/backend/lib/theme-package'
import {
  activeTheme, adminTheme, checkRevision, cleanDoc, cleanSchema, deleteThemeMenus, menus, publishDoc, saveMenu, themeDraft, themeMenus, themeSchema,
} from '@/backend/lib/theme-store'
import { uploadThemeAsset } from '@/backend/integrations/cloudinary'
import { slugify } from '@/backend/lib/slug'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    await activeTheme() // make sure the built-in theme exists on a fresh store
    const themes = await db.theme.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }], include: { _count: { select: { pages: true } } } })
    return NextResponse.json(themes.map(adminTheme), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a theme .zip file')
    if (file.size > MAX_ZIP_BYTES) throw new HttpError(413, 'Theme zip must be 60 MB or smaller')
    const activate = form.get('activate') === 'true'

    const name = slugify(file.name.replace(/\.zip$/i, '')) || 'theme'
    const folder = `themes/${name}-${Date.now().toString(36)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const plan = await readThemePackage(bytes, {
      fileName: file.name,
      upload: (path, data) => uploadThemeAsset(data, folder, path.split('/').pop() ?? 'asset'),
      slugTaken: async (slug) => !!(await db.page.findUnique({ where: { slug }, select: { id: true } })),
    })

    // Keep the upload untouched so it can be downloaded, repaired or re-installed later.
    let sourceUrl: string | null = null
    try { sourceUrl = await uploadThemeAsset(bytes, folder, 'original.zip') } catch {
      plan.warnings.push('The original zip could not be stored, so "Download original" is unavailable for this theme.')
    }

    const slug = await uniqueSlug(plan.name, async (s) => !!(await db.theme.findUnique({ where: { slug: s }, select: { id: true } })))
    const theme = await db.$transaction(async (tx) => {
      if (activate) await tx.theme.updateMany({ where: { isActive: true }, data: { isActive: false } })
      const created = await tx.theme.create({
        data: {
          slug, name: plan.name, version: plan.version, author: plan.author, description: plan.description,
          kind: plan.kind, isActive: activate,
          settingsSchema: JSON.stringify(plan.schema), settings: JSON.stringify(plan.settings),
          sections: JSON.stringify(plan.sections), css: plan.css,
          report: JSON.stringify({ ...plan.report, warnings: plan.warnings }), sourceUrl,
        },
      })
      if (plan.pages.length) await tx.page.createMany({ data: plan.pages.map((p) => ({ ...p, themeId: created.id })) })
      return created
    }, { timeout: 30_000 })

    // Saved with the theme; they become the store menus when the theme goes live.
    for (const [handle, items] of Object.entries(plan.menus)) await saveMenu(handle, items, theme.id)

    const full = await db.theme.findUniqueOrThrow({ where: { id: theme.id }, include: { _count: { select: { pages: true } } } })
    invalidateAll()
    return NextResponse.json({ ok: true, theme: adminTheme(full), warnings: plan.warnings })
  } catch (error) {
    if (error instanceof HttpError) return failure(error)
    console.error('Theme install failed', error)
    return NextResponse.json({ error: 'Theme install failed. Check the file and the Cloudinary configuration.' }, { status: 500 })
  }
}

/**
 * PUT { id, ... } — any of:
 *   draft: { settings, sections, css }  save unpublished edits (autosave)
 *   discardDraft: true                   drop unpublished edits
 *   publish: true                        make the draft live (records a revision)
 *   activate: true                       publish and make this the store's theme
 *   name, settingsSchema                 metadata, applied directly
 * Document writes carry baseRevision (the revision the editor loaded) and fail with 409 when
 * someone saved in between.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    let theme = await db.theme.findUnique({ where: { id } })
    if (!theme) throw new HttpError(404, 'Theme not found')
    const writesDoc = 'draft' in body || body.discardDraft === true || body.publish === true
    if (writesDoc) checkRevision(theme, body.baseRevision)

    const data: Record<string, unknown> = {}
    if ('name' in body) data.name = text(body.name, 'name', 120, true)
    if ('settingsSchema' in body) data.settingsSchema = JSON.stringify(cleanSchema(body.settingsSchema))
    if ('draft' in body) {
      if (!body.draft || typeof body.draft !== 'object' || Array.isArray(body.draft)) throw new HttpError(400, 'draft must be an object')
      data.draft = JSON.stringify(cleanDoc(body.draft as Record<string, unknown>, themeSchema(theme)))
    }
    if (body.discardDraft === true) data.draft = null
    if ('draft' in data) data.revision = { increment: 1 }
    if (Object.keys(data).length) theme = await db.theme.update({ where: { id }, data })

    if (body.publish === true || body.activate === true) {
      const doc = themeDraft(theme) ?? cleanDoc({ settings: JSON.parse(theme.settings || '{}'), sections: JSON.parse(theme.sections || '[]'), css: theme.css }, themeSchema(theme))
      const note = body.activate === true && !theme.isActive ? 'Published as the live theme' : 'Published'
      await publishDoc(id, doc, { note, author: user.email, activate: body.activate === true })
    }
    const updated = await db.theme.findUniqueOrThrow({ where: { id }, include: { _count: { select: { pages: true } } } })
    invalidateAll()
    return NextResponse.json({ ok: true, theme: adminTheme(updated) })
  } catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    const id = idParam(request)
    const theme = await db.theme.findUnique({ where: { id }, select: { isActive: true } })
    if (!theme) throw new HttpError(404, 'Theme not found')
    if (theme.isActive) throw new HttpError(400, 'Activate another theme before deleting this one')
    await db.theme.delete({ where: { id } }) // its imported pages cascade
    await deleteThemeMenus(id)
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}

/** GET ?id= — download a theme as a native package (theme.json + CSS + pages). Also the reference sample. */
export async function exportTheme(request: Request) {
  try {
    await requireAdmin(request)
    const theme = await db.theme.findUnique({ where: { id: idParam(request) }, include: { pages: true } })
    if (!theme) throw new HttpError(404, 'Theme not found')
    const view = adminTheme(theme)
    const manifest = {
      name: theme.name,
      version: theme.version,
      author: theme.author ?? undefined,
      description: theme.description ?? undefined,
      settings_schema: cleanSchema(JSON.parse(theme.settingsSchema || '[]')),
      settings: view.settings,
      sections: view.sections,
      menus: await themeMenus(theme.id),
      css: ['assets/theme.css'],
      pages: theme.pages.map((p) => ({ slug: p.slug, title: p.title, file: `pages/${p.slug}.html`, layout: p.layout, hide_header_footer: p.hideHeaderFooter })),
    }
    const files: Record<string, Uint8Array> = {
      'theme.json': strToU8(JSON.stringify(manifest, null, 2)),
      'assets/theme.css': strToU8(view.css),
    }
    for (const p of theme.pages) {
      files[`pages/${p.slug}.html`] = strToU8(`<!doctype html>\n<html>\n<head>\n<title>${p.title.replace(/</g, '&lt;')}</title>\n${p.css ? `<style>\n${p.css}\n</style>\n` : ''}</head>\n<body${p.bodyClass ? ` class="${p.bodyClass.replace(/"/g, '&quot;')}"` : ''}>\n${p.content}\n</body>\n</html>\n`)
    }
    return new NextResponse(Buffer.from(zipSync(files, { level: 6 })), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${theme.slug}-${theme.version}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) { return failure(error) }
}

// ---------- menus ----------

export async function getMenus(request: Request) {
  try {
    await requireAdmin(request)
    const themeId = new URL(request.url).searchParams.get('theme')
    return NextResponse.json(themeId ? await themeMenus(themeId) : await menus(), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function putMenu(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const themeId = typeof body.theme === 'string' && body.theme ? body.theme : undefined
    const items = await saveMenu(text(body.handle, 'handle', 20, true), body.items, themeId)
    return NextResponse.json({ ok: true, items })
  } catch (error) { return failure(error) }
}

// ---------- duplicate ----------

/** POST { id } — copy a theme with its settings, sections, CSS, pages and menus, as an unpublished theme. */
export async function duplicateTheme(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const source = await db.theme.findUnique({ where: { id: text(body.id, 'id', 64, true) }, include: { pages: true } })
    if (!source) throw new HttpError(404, 'Theme not found')

    const slugMap = new Map<string, string>()
    for (const p of source.pages) {
      slugMap.set(p.slug, await uniqueSlug(`${p.slug}-copy`, async (s) => [...slugMap.values()].includes(s) || !!(await db.page.findUnique({ where: { slug: s }, select: { id: true } }))))
    }
    const relink = (value: string) => (value.startsWith('page:') && slugMap.has(value.slice(5)) ? `page:${slugMap.get(value.slice(5))}` : value)
    const relinkHtml = (html: string) => html.replace(/(\?page=)([a-z0-9-]+)/g, (m, q: string, slug: string) => (slugMap.has(slug) ? q + slugMap.get(slug) : m))
    const view = adminTheme(source)
    const sections = view.sections.map((s) => ({
      ...s,
      settings: Object.fromEntries(Object.entries(s.settings).map(([k, v]) => [k,
        typeof v !== 'string' ? v : k === 'page' ? slugMap.get(v) ?? v : k === 'html' ? relinkHtml(v) : relink(v)])),
    }))
    const name = `Copy of ${source.name}`.slice(0, 120)
    const slug = await uniqueSlug(name, async (s) => !!(await db.theme.findUnique({ where: { slug: s }, select: { id: true } })))

    const theme = await db.$transaction(async (tx) => {
      const created = await tx.theme.create({
        data: {
          slug, name, version: source.version, author: source.author, description: source.description, kind: source.kind, isActive: false,
          settingsSchema: source.settingsSchema, settings: JSON.stringify(view.settings), sections: JSON.stringify(sections), css: view.css,
          report: source.report,
        },
      })
      if (source.pages.length) {
        await tx.page.createMany({
          data: source.pages.map(({ id: _id, createdAt: _c, updatedAt: _u, themeId: _t, slug: old, content, ...p }) => ({
            ...p, slug: slugMap.get(old)!, content: relinkHtml(content), themeId: created.id,
          })),
        })
      }
      return created
    }, { timeout: 30_000 })

    const sourceMenus = await themeMenus(source.id)
    const relinkMenu = (items: typeof sourceMenus.main): typeof sourceMenus.main =>
      items.map((m) => ({ ...m, link: relink(m.link), ...(m.children ? { children: relinkMenu(m.children) } : {}) }))
    for (const [handle, items] of Object.entries(sourceMenus)) await saveMenu(handle, relinkMenu(items), theme.id)

    const full = await db.theme.findUniqueOrThrow({ where: { id: theme.id }, include: { _count: { select: { pages: true } } } })
    invalidateAll()
    return NextResponse.json({ ok: true, theme: adminTheme(full) })
  } catch (error) { return failure(error) }
}

// ---------- revisions ----------

/** GET ?theme= — published revisions, newest first. */
export async function listRevisions(request: Request) {
  try {
    await requireAdmin(request)
    const themeId = text(new URL(request.url).searchParams.get('theme'), 'theme', 64, true)
    const rows = await db.themeRevision.findMany({
      where: { themeId }, orderBy: { number: 'desc' }, take: 50,
      select: { id: true, number: true, note: true, author: true, createdAt: true },
    })
    return NextResponse.json(rows, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** POST { theme, revision, baseRevision } — publish an earlier revision again. Unpublished edits are dropped. */
export async function rollbackRevision(request: Request) {
  try {
    const user = await requireAdmin(request)
    const body = await readJson(request)
    const theme = await db.theme.findUnique({ where: { id: text(body.theme, 'theme', 64, true) } })
    if (!theme) throw new HttpError(404, 'Theme not found')
    checkRevision(theme, body.baseRevision)
    const rev = await db.themeRevision.findFirst({ where: { id: text(body.revision, 'revision', 64, true), themeId: theme.id } })
    if (!rev) throw new HttpError(404, 'Revision not found')
    const doc = cleanDoc({ settings: JSON.parse(rev.settings), sections: JSON.parse(rev.sections), css: rev.css }, themeSchema(theme))
    const updated = await publishDoc(theme.id, doc, { note: `Rolled back to #${rev.number}`, author: user.email })
    return NextResponse.json({ ok: true, theme: adminTheme(updated) })
  } catch (error) { return failure(error) }
}
