// Admin theme library: upload/install, customize (settings, homepage sections, CSS), activate, export, delete.
import { NextResponse } from 'next/server'
import { strToU8, zipSync } from 'fflate'
import { db } from '@/backend/lib/db'
import { invalidateAll } from '@/backend/lib/memo'
import { failure, HttpError, requireAdmin, text } from '@/backend/lib/auth'
import { idParam, readJson, uniqueSlug } from '@/backend/lib/admin-resource'
import { MAX_ZIP_BYTES, readThemePackage } from '@/backend/lib/theme-package'
import {
  activeTheme, adminTheme, applyThemeMenus, cleanSchema, cleanSections, cleanSettings, deleteThemeMenus, menus, saveMenu, themeMenus, themeSchema,
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
    const plan = await readThemePackage(new Uint8Array(await file.arrayBuffer()), {
      fileName: file.name,
      upload: (path, data) => uploadThemeAsset(data, folder, path.split('/').pop() ?? 'asset'),
      slugTaken: async (slug) => !!(await db.page.findUnique({ where: { slug }, select: { id: true } })),
    })

    const slug = await uniqueSlug(plan.name, async (s) => !!(await db.theme.findUnique({ where: { slug: s }, select: { id: true } })))
    const theme = await db.$transaction(async (tx) => {
      if (activate) await tx.theme.updateMany({ where: { isActive: true }, data: { isActive: false } })
      const created = await tx.theme.create({
        data: {
          slug, name: plan.name, version: plan.version, author: plan.author, description: plan.description,
          kind: plan.kind, isActive: activate,
          settingsSchema: JSON.stringify(plan.schema), settings: JSON.stringify(plan.settings),
          sections: JSON.stringify(plan.sections), css: plan.css,
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

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await readJson(request)
    const id = text(body.id, 'id', 64, true)
    const theme = await db.theme.findUnique({ where: { id } })
    if (!theme) throw new HttpError(404, 'Theme not found')

    if (body.activate === true) {
      await db.$transaction([
        db.theme.updateMany({ where: { isActive: true, NOT: { id } }, data: { isActive: false } }),
        db.theme.update({ where: { id }, data: { isActive: true } }),
      ])
      await applyThemeMenus(id)
    }
    const data: Record<string, string> = {}
    if ('name' in body) data.name = text(body.name, 'name', 120, true)
    if ('settings' in body) data.settings = JSON.stringify(cleanSettings(body.settings, themeSchema(theme)))
    if ('sections' in body) {
      if (!Array.isArray(body.sections)) throw new HttpError(400, 'sections must be a list')
      data.sections = JSON.stringify(cleanSections(body.sections))
    }
    if ('css' in body) data.css = text(body.css ?? '', 'css', 3_000_000)
    if ('settingsSchema' in body) data.settingsSchema = JSON.stringify(cleanSchema(body.settingsSchema))
    const updated = await db.theme.update({ where: { id }, data, include: { _count: { select: { pages: true } } } })
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
      'assets/theme.css': strToU8(theme.css),
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
