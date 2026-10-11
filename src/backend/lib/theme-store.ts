// Reading/writing themes and menus. The JSON columns are parsed defensively: a malformed row
// falls back to defaults instead of taking the storefront down.
import type { Theme } from '@prisma/client'
import { db } from './db'
import { HttpError } from './auth'
import { invalidateAll, memo } from './memo'
import {
  DEFAULT_MENUS, DEFAULT_SECTIONS, DEFAULT_THEME, MENU_HANDLES, mergeSchema, resolveSettings, SECTION_TYPES,
  type MenuHandle, type MenuItem, type SectionField, type StorefrontTheme, type ThemeSection, type ThemeSettingDef,
  type ThemeSettings, type ThemeSettingType,
} from '@/shared/theme'

function parse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T } catch { return fallback }
}

// ---------- validation (shared by package install and admin edits) ----------

const SETTING_TYPES: ThemeSettingType[] = ['color', 'text', 'textarea', 'image', 'select', 'checkbox', 'range']
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
      default:
        if (typeof value === 'string') out[key] = value.slice(0, def.type === 'textarea' ? 5000 : 1000)
    }
  }
  return out
}

const SECTION_FIELD_MAX: Record<SectionField, number> = { eyebrow: 120, title: 200, text: 1000, button_label: 60, link: 500, html: 100_000, page: 120 }

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
    const settings: ThemeSection['settings'] = {}
    const given = isRecord(raw.settings) ? raw.settings : {}
    for (const field of SECTION_TYPES[type].fields as readonly SectionField[]) {
      const v = str(given[field], SECTION_FIELD_MAX[field])
      if (v !== undefined) settings[field] = v
    }
    out.push({ id, type, enabled: raw.enabled !== false, settings })
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

/** Admin view of a theme with parsed JSON columns. */
export function adminTheme(theme: Theme & { _count?: { pages: number } }) {
  const schema = themeSchema(theme)
  return {
    id: theme.id, slug: theme.slug, name: theme.name, version: theme.version, author: theme.author,
    description: theme.description, kind: theme.kind, isActive: theme.isActive, css: theme.css,
    createdAt: theme.createdAt, updatedAt: theme.updatedAt, pageCount: theme._count?.pages ?? 0,
    schema,
    settings: resolveSettings(schema, parse(theme.settings, {})),
    sections: cleanSections(parse(theme.sections, [])),
  }
}

export async function saveMenu(handle: string, items: unknown) {
  if (!(handle in MENU_HANDLES)) throw new HttpError(400, 'Unknown menu')
  const clean = cleanMenu(items)
  const name = MENU_HANDLES[handle as MenuHandle]
  await db.menu.upsert({
    where: { handle },
    create: { handle, name, itemsJson: JSON.stringify(clean) },
    update: { itemsJson: JSON.stringify(clean) },
  })
  invalidateAll()
  return clean
}
