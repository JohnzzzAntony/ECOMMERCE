// Reading/writing themes and menus. The JSON columns are parsed defensively: a malformed row
// falls back to defaults instead of taking the storefront down.
import type { Theme } from '@prisma/client'
import { db } from './db'
import { HttpError } from './auth'
import { invalidateAll, memo } from './memo'
import { adapterFor, buildReport } from './theme-adapters'
import {
  DEFAULT_MENUS, DEFAULT_SECTIONS, DEFAULT_THEME, MENU_HANDLES, mergeSchema, resolveSettings, SECTION_TYPES, sectionSchema,
  type MenuHandle, type MenuItem, type StorefrontTheme, type ThemeDoc, type ThemeReport, type ThemeSection, type ThemeSettingDef,
  type ThemeSettings, type ThemeSettingType,
} from '@/shared/theme'

function parse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T } catch { return fallback }
}

// ---------- validation (shared by package install and admin edits) ----------

const SETTING_TYPES: ThemeSettingType[] = ['color', 'text', 'textarea', 'image', 'select', 'checkbox', 'range', 'link', 'page', 'html']
const ID = /^[a-z][a-z0-9_]{0,63}$/
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function cleanSchema(input: unknown): ThemeSettingDef[] {
  if (!Array.isArray(input)) return []
  const out: ThemeSettingDef[] = []
  for (const raw of input.slice(0, 300)) {
    if (!isRecord(raw)) continue
    const id = str(raw.id, 64), type = raw.type as ThemeSettingType, label = str(raw.label, 120)
    if (!id || !ID.test(id) || !SETTING_TYPES.includes(type) || !label) continue
    const def: ThemeSettingDef = { id, type, label }
    const group = str(raw.group, 60); if (group) def.group = group
    const help = str(raw.help, 300); if (help) def.help = help
    if (['string', 'number', 'boolean'].includes(typeof raw.default)) def.default = typeof raw.default === 'string' ? raw.default.slice(0, 2000) : raw.default as number | boolean
    const vars = (Array.isArray(raw.var) ? raw.var : [raw.var]).filter((v): v is string => typeof v === 'string' && /^--[a-zA-Z0-9-]{1,64}$/.test(v))
    if (vars.length) def.var = vars.length === 1 ? vars[0] : vars.slice(0, 10)
    const unit = str(raw.unit, 8); if (unit && /^[a-z%]+$/.test(unit)) def.unit = unit
    for (const k of ['min', 'max', 'step'] as const) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) def[k] = raw[k] as number
    if (Array.isArray(raw.options)) {
      def.options = raw.options.filter(isRecord).slice(0, 50)
        .map((o) => ({ value: str(o.value, 500) ?? '', label: str(o.label, 120) ?? String(o.value ?? '') }))
    }
    out.push(def)
  }
  return out
}

export function cleanSettings(input: unknown, schema: ThemeSettingDef[]): ThemeSettings {
  if (!isRecord(input)) return {}
  const defs = new Map(schema.map((d) => [d.id, d]))
  const out: ThemeSettings = {}
  for (const [key, value] of Object.entries(input)) {
    const def = defs.get(key)
    if (!def) continue
    switch (def.type) {
      case 'checkbox':
        if (typeof value === 'boolean') out[key] = value
        break
      case 'range': {
        const n = Number(value)
        if (Number.isFinite(n)) out[key] = Math.min(def.max ?? n, Math.max(def.min ?? n, n))
        break
      }
      case 'color':
        if (typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/.test(value.trim())) out[key] = value.trim()
        break
      case 'select':
        if (typeof value === 'string' && (!def.options?.length || def.options.some((o) => o.value === value))) out[key] = value
        break
      case 'link':
        if (typeof value === 'string' && !/^\s*(javascript|data|vbscript):/i.test(value)) out[key] = value.trim().slice(0, 500)
        break
      case 'html':
        if (typeof value === 'string') out[key] = value.slice(0, 100_000)
        break
      default:
        if (typeof value === 'string') out[key] = value.slice(0, def.type === 'textarea' ? 5000 : 1000)
    }
  }
  return out
}

export function cleanSections(input: unknown): ThemeSection[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: ThemeSection[] = []
  for (const [i, raw] of input.slice(0, 60).entries()) {
    if (!isRecord(raw) || typeof raw.type !== 'string' || !(raw.type in SECTION_TYPES)) continue
    const type = raw.type as keyof typeof SECTION_TYPES
    let id = str(raw.id, 40) || `s-${type}-${i}`
    if (seen.has(id)) id = `${id}-${i}`
    seen.add(id)
    out.push({ id, type, enabled: raw.enabled !== false, settings: cleanSettings(raw.settings, sectionSchema(type)) })
  }
  return out
}

export function cleanMenu(input: unknown, depth = 0): MenuItem[] {
  if (!Array.isArray(input)) throw new HttpError(400, 'Menu items must be a list')
  return input.slice(0, 60).map((raw, i) => {
    if (!isRecord(raw)) throw new HttpError(400, 'Invalid menu item')
    const label = str(raw.label, 80)?.trim()
    if (!label) throw new HttpError(400, 'Every menu item needs a label')
    const link = (str(raw.link, 500) ?? '').trim()
    if (/^\s*(javascript|data|vbscript):/i.test(link)) throw new HttpError(400, `Unsupported link for "${label}"`)
    const item: MenuItem = { id: str(raw.id, 40) || `m-${depth}-${i}-${Date.now().toString(36)}`, label, link }
    if (depth === 0 && Array.isArray(raw.children) && raw.children.length) item.children = cleanMenu(raw.children, 1)
    return item
  })
}

// ---------- reads ----------

export function themeSchema(theme: Pick<Theme, 'settingsSchema'>) {
  return mergeSchema(cleanSchema(parse(theme.settingsSchema, [])))
}

/** The active theme; installs the built-in default the first time the store runs. */
export async function activeTheme(): Promise<Theme> {
  const active = await db.theme.findFirst({ where: { isActive: true } })
  if (active) return active
  const any = await db.theme.findFirst({ orderBy: { createdAt: 'asc' } })
  if (any) return db.theme.update({ where: { id: any.id }, data: { isActive: true } })
  return db.theme.upsert({
    where: { slug: DEFAULT_THEME.slug },
    update: { isActive: true },
    create: { ...DEFAULT_THEME, kind: 'native', isActive: true, sections: JSON.stringify(DEFAULT_SECTIONS) },
  })
}

export async function menus(): Promise<Record<MenuHandle, MenuItem[]>> {
  const rows = await db.menu.findMany()
  const out = { ...DEFAULT_MENUS }
  for (const row of rows) {
    if (row.handle in MENU_HANDLES) out[row.handle as MenuHandle] = parse(row.itemsJson, DEFAULT_MENUS[row.handle as MenuHandle])
  }
  return out
}

export function storefrontTheme(): Promise<StorefrontTheme> {
  return memo('theme', loadStorefrontTheme)
}

async function loadStorefrontTheme(): Promise<StorefrontTheme> {
  const [theme, menuMap] = await Promise.all([activeTheme(), menus()])
  const schema = themeSchema(theme)
  return {
    id: theme.id,
    name: theme.name,
    kind: theme.kind === 'html' ? 'html' : 'native',
    schema,
    settings: resolveSettings(schema, parse(theme.settings, {})),
    sections: cleanSections(parse(theme.sections, [])),
    // HTML-template CSS only applies inside that template's isolated pages, never to the store itself.
    css: theme.kind === 'html' ? '' : theme.css,
    menus: menuMap,
  }
}

/** The theme's unpublished draft, or null. Validated against the theme schema like any edit. */
export function themeDraft(theme: Pick<Theme, 'draft' | 'settingsSchema'>): ThemeDoc | null {
  if (!theme.draft) return null
  const raw = parse<Record<string, unknown> | null>(theme.draft, null)
  if (!isRecord(raw)) return null
  return cleanDoc(raw, themeSchema(theme))
}

/** Validate an editable document (draft save, publish, rollback). */
export function cleanDoc(input: Record<string, unknown>, schema: ThemeSettingDef[]): ThemeDoc {
  if (input.sections !== undefined && !Array.isArray(input.sections)) throw new HttpError(400, 'sections must be a list')
  if (input.css !== undefined && typeof input.css !== 'string') throw new HttpError(400, 'css must be text')
  const css = (input.css as string | undefined) ?? ''
  if (css.length > 3_000_000) throw new HttpError(400, 'CSS is too large (max 3 MB)')
  return { settings: cleanSettings(input.settings, schema), sections: cleanSections(input.sections), css }
}

function storedReport(theme: Pick<Theme, 'report' | 'kind'>, counts: ThemeReport['counts']): ThemeReport {
  const saved = parse<Partial<ThemeReport>>(theme.report, {})
  if (saved.adapter && saved.level) return { ...saved, counts: saved.counts ?? counts } as ThemeReport
  // Themes installed before reports existed (and the built-in theme).
  const adapter = adapterFor(theme.kind === 'html' ? 'html' : 'native')
  return buildReport(adapter, { confidence: 1, detected: theme.kind === 'html' ? 'Static HTML/CSS/JS' : 'theme.json manifest' }, counts, [])
}

/** Admin view of a theme with parsed JSON columns. Editable values come from the draft when there is one. */
export function adminTheme(theme: Theme & { _count?: { pages: number } }) {
  const schema = themeSchema(theme)
  const draft = themeDraft(theme)
  const published: ThemeDoc = {
    settings: resolveSettings(schema, parse(theme.settings, {})),
    sections: cleanSections(parse(theme.sections, [])),
    css: theme.css,
  }
  const doc = draft ? { ...draft, settings: resolveSettings(schema, draft.settings) } : published
  const pageCount = theme._count?.pages ?? 0
  return {
    id: theme.id, slug: theme.slug, name: theme.name, version: theme.version, author: theme.author,
    description: theme.description, kind: theme.kind, isActive: theme.isActive,
    createdAt: theme.createdAt, updatedAt: theme.updatedAt, pageCount,
    revision: theme.revision, hasDraft: !!draft, sourceUrl: theme.sourceUrl,
    report: storedReport(theme, { pages: pageCount, sections: published.sections.length, settings: schema.length, menus: 0 }),
    schema,
    ...doc,
    published,
  }
}

/** Reject writes based on an older revision than the stored one (another tab or admin saved meanwhile). */
export function checkRevision(theme: Pick<Theme, 'revision'>, base: unknown) {
  if (base === undefined) return
  if (typeof base !== 'number' || base !== theme.revision) {
    throw new HttpError(409, 'This theme was changed in another window. Reload to get the latest version.')
  }
}

/**
 * Make a document live: write it to the theme's live columns, record a revision and clear the draft,
 * in one transaction (visitors see the old theme or the new one, never a mix).
 */
export async function publishDoc(themeId: string, doc: ThemeDoc, opts: { note: string; author?: string; activate?: boolean }) {
  const updated = await db.$transaction(async (tx) => {
    if (opts.activate) await tx.theme.updateMany({ where: { isActive: true, NOT: { id: themeId } }, data: { isActive: false } })
    const last = await tx.themeRevision.findFirst({ where: { themeId }, orderBy: { number: 'desc' }, select: { number: true } })
    const settings = JSON.stringify(doc.settings), sections = JSON.stringify(doc.sections)
    await tx.themeRevision.create({ data: { themeId, number: (last?.number ?? 0) + 1, note: opts.note.slice(0, 200), author: opts.author, settings, sections, css: doc.css } })
    return tx.theme.update({
      where: { id: themeId },
      data: { settings, sections, css: doc.css, draft: null, revision: { increment: 1 }, ...(opts.activate ? { isActive: true } : {}) },
      include: { _count: { select: { pages: true } } },
    })
  }, { timeout: 30_000 })
  if (opts.activate) await applyThemeMenus(themeId)
  invalidateAll()
  return updated
}

// Each theme keeps its own copy of the menus (rows with handle "<handle>@<themeId>"), so menus that come
// with a theme survive until it is published, and switching themes brings their menus back.
const themeHandle = (handle: MenuHandle, themeId: string) => `${handle}@${themeId}`

export async function themeMenus(themeId: string): Promise<Record<MenuHandle, MenuItem[]>> {
  const theme = await db.theme.findUnique({ where: { id: themeId }, select: { isActive: true } })
  if (!theme) throw new HttpError(404, 'Theme not found')
  if (theme.isActive) return menus()
  const live = await menus()
  const rows = await db.menu.findMany({ where: { handle: { in: (Object.keys(MENU_HANDLES) as MenuHandle[]).map((h) => themeHandle(h, themeId)) } } })
  const out = { ...live }
  for (const row of rows) {
    const handle = row.handle.split('@')[0] as MenuHandle
    out[handle] = parse(row.itemsJson, live[handle])
  }
  return out
}

/** Save a menu. Without a theme (or for the live theme) the store menu changes; the theme's copy always does. */
export async function saveMenu(handle: string, items: unknown, themeId?: string) {
  if (!(handle in MENU_HANDLES)) throw new HttpError(400, 'Unknown menu')
  const clean = cleanMenu(items)
  const itemsJson = JSON.stringify(clean)
  const name = MENU_HANDLES[handle as MenuHandle]
  const target = themeId
    ? await db.theme.findUnique({ where: { id: themeId }, select: { id: true, isActive: true } })
    : await activeTheme()
  if (!target) throw new HttpError(404, 'Theme not found')
  const handles = [themeHandle(handle as MenuHandle, target.id), ...(target.isActive ? [handle] : [])]
  for (const h of handles) {
    await db.menu.upsert({ where: { handle: h }, create: { handle: h, name, itemsJson }, update: { itemsJson } })
  }
  invalidateAll()
  return clean
}

/** Publishing a theme makes its saved menus the store menus. */
export async function applyThemeMenus(themeId: string) {
  for (const handle of Object.keys(MENU_HANDLES) as MenuHandle[]) {
    const row = await db.menu.findUnique({ where: { handle: themeHandle(handle, themeId) } })
    if (row) await db.menu.upsert({ where: { handle }, create: { handle, name: row.name, itemsJson: row.itemsJson }, update: { itemsJson: row.itemsJson } })
  }
  invalidateAll()
}

export async function deleteThemeMenus(themeId: string) {
  await db.menu.deleteMany({ where: { handle: { endsWith: `@${themeId}` } } })
}
