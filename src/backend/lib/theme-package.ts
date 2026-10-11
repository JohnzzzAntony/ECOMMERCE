// Turns an uploaded theme .zip into an install plan.
//
// Two package kinds are accepted:
//  - native: a theme.json manifest (public/docs/theme-format.md) — settings schema, homepage sections, menus,
//    CSS and optional pages. Everything becomes editable in the admin Theme customizer.
//  - html:   a static HTML template (the usual ThemeForest/Envato "HTML" download). Each .html file
//    becomes an editable page rendered in an isolated frame (its own origin: the template's scripts run
//    but cannot reach the store, cookies or admin session); its CSS becomes the theme CSS.
// WordPress and Shopify themes need their own server runtimes (PHP / Liquid) and are rejected.
//
// Only files that are actually referenced by CSS/HTML (including <script src>) are uploaded.
import { strFromU8, unzipSync } from 'fflate'
import { HttpError } from './auth'
import { slugify } from './slug'
import { cleanMenu, cleanSchema, cleanSections, cleanSettings } from './theme-store'
import {
  MENU_HANDLES, mergeSchema,
  type MenuHandle, type MenuItem, type ThemeSection, type ThemeSettingDef, type ThemeSettings,
} from '@/shared/theme'

export const MAX_ZIP_BYTES = 60 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 250 * 1024 * 1024
const MAX_FILES = 5000
const MAX_ASSETS = 600
const MAX_ASSET_BYTES = 25 * 1024 * 1024
const MAX_PAGES = 80

export type Uploader = (path: string, data: Uint8Array) => Promise<string>

export interface PlannedPage {
  slug: string
  title: string
  content: string
  css: string
  bodyClass: string
  layout: 'standard' | 'isolated'
  hideHeaderFooter: boolean
  metaTitle?: string
  metaDescription?: string
}

export interface ThemePlan {
  kind: 'native' | 'html'
  name: string
  version: string
  author?: string
  description?: string
  schema: ThemeSettingDef[]
  settings: ThemeSettings
  sections: ThemeSection[]
  css: string
  menus: Partial<Record<MenuHandle, MenuItem[]>>
  pages: PlannedPage[]
  warnings: string[]
}

interface Options {
  upload: Uploader
  /** True when a page slug is already used by another page. */
  slugTaken: (slug: string) => Promise<boolean>
  /** File name of the upload, used to name HTML templates. */
  fileName?: string
}

// ---------- zip ----------

type Files = Map<string, Uint8Array>

export function unzipPackage(zip: Uint8Array): Files {
  let total = 0
  let count = 0
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip, {
      filter: (f) => {
        if (f.name.endsWith('/') || /(^|\/)(__MACOSX|\.git|node_modules)\//.test(f.name) || /(^|\/)\.[^/]*$/.test(f.name)) return false
        count += 1
        total += f.originalSize
        if (count > MAX_FILES) throw new HttpError(413, `Theme has more than ${MAX_FILES} files`)
        if (total > MAX_EXTRACTED_BYTES) throw new HttpError(413, 'Theme is too large once extracted (max 250 MB)')
        return true
      },
    })
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Could not read the file. Upload a .zip theme package.')
  }
  const files: Files = new Map()
  for (const [name, data] of Object.entries(entries)) files.set(name.replace(/\\/g, '/').replace(/^\/+/, ''), data)
  return files
}

const ext = (path: string) => path.split('.').pop()?.toLowerCase() ?? ''
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')
const depth = (path: string) => path.split('/').length
const DOC_DIR = /(^|\/)(documentation|docs?|help|psd|source|sources|licen[cs]e)\//i

/** Resolve `ref` (as written in `from`) to a path inside the package; null for URLs/anchors. */
export function resolveRef(from: string, ref: string, root: string): string | null {
  const value = ref.trim()
  if (!value || /^([a-z][a-z0-9+.-]*:|\/\/|#|\{|\$)/i.test(value)) return null
  let clean = value.split(/[?#]/)[0]
  try { clean = decodeURI(clean) } catch { /* keep as written */ }
  const parts = (clean.startsWith('/') ? root : dirOf(from)).split('/').filter(Boolean)
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

export function detectPlatform(files: Files): { kind: 'native'; manifest: string } | { kind: 'html'; root: string } {
  const paths = [...files.keys()]
  const manifest = paths.filter((p) => p.endsWith('theme.json') && p.split('/').pop() === 'theme.json').sort((a, b) => depth(a) - depth(b))[0]
  if (manifest) return { kind: 'native', manifest }
  if (paths.some((p) => /(^|\/)layout\/theme\.liquid$/.test(p)) || paths.filter((p) => ext(p) === 'liquid').length > 3) {
    throw new HttpError(422, 'This is a Shopify (Liquid) theme. It needs Shopify’s servers to run. Use the theme’s HTML version, or a native theme package (theme.json).')
  }
  const wpStyle = paths.find((p) => p.split('/').pop() === 'style.css' && /Theme Name\s*:/i.test(strFromU8(files.get(p)!.slice(0, 4000))))
  if (wpStyle || paths.some((p) => p.split('/').pop() === 'functions.php')) {
    throw new HttpError(422, 'This is a WordPress theme. It needs PHP and WordPress to run. Use the theme’s HTML version, or a native theme package (theme.json).')
  }
  const html = paths.filter((p) => /^html?$/.test(ext(p)) && !DOC_DIR.test(p))
  if (html.length) {
    const index = html.filter((p) => /^index\.html?$/i.test(p.split('/').pop()!)).sort((a, b) => depth(a) - depth(b))[0]
    const first = index ?? [...html].sort((a, b) => depth(a) - depth(b))[0]
    return { kind: 'html', root: dirOf(first) }
  }
  const nested = paths.filter((p) => ext(p) === 'zip')
  if (nested.length) throw new HttpError(422, `This download contains another zip (${nested.slice(0, 3).map((p) => p.split('/').pop()).join(', ')}). Extract it and upload the theme zip inside.`)
  throw new HttpError(422, 'No theme found. The zip needs a theme.json manifest or .html pages.')
}

// ---------- CSS / HTML reference rewriting ----------

/** Maps a package path to its uploaded URL (or records it during the collect pass). */
type Mapper = (path: string) => string | undefined

const CSS_URL = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi
// @import url("…") / url(…) / "…" — quoted URLs may contain ';' (Google Fonts: wght@0,100..800;1,100..800).
const CSS_IMPORT = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]*))\s*\)|"([^"]*)"|'([^']*)')([^;]*);/gi

function mapCssUrls(css: string, from: string, root: string, map: Mapper) {
  return css.replace(CSS_URL, (match, _q, ref: string) => {
    const path = resolveRef(from, ref, root)
    const url = path ? map(path) : undefined
    return url ? `url("${url}")` : match
  })
}

/** Inline local @imports, hoist remote ones, rewrite url() references. */
function processCss(files: Files, path: string, root: string, map: Mapper, seen = new Set<string>()): { imports: string[]; body: string } {
  const data = files.get(path)
  if (!data || seen.has(path) || seen.size > 50) return { imports: [], body: '' }
  seen.add(path)
  const imports: string[] = []
  const withImports = strFromU8(data).replace(CSS_IMPORT, (...m: string[]) => {
    const ref = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? ''
    const media = m[6] ?? ''
    const local = resolveRef(path, ref, root)
    if (!local) {
      imports.push(`@import url("${ref}")${media.trimEnd()};`)
      return ''
    }
    const inner = processCss(files, local, root, map, seen)
    imports.push(...inner.imports)
    return inner.body
  })
  return { imports, body: mapCssUrls(withImports, path, root, map) }
}

const ASSET_ATTR = /(\s(?:src|href|poster|data-(?:src|bg|background|image|image-src|lazy|original|setbg|bg-image|thumb))\s*=\s*)(["'])([^"']*)\2/gi
const SRCSET_ATTR = /(\s(?:srcset|data-srcset)\s*=\s*)(["'])([^"']*)\2/gi

interface HtmlDoc {
  title: string
  description?: string
  bodyClass: string
  body: string
  inlineCss: string
  stylesheets: string[] // local package paths
  remoteStyles: string[]
}

export function parseHtml(source: string, path: string, root: string): HtmlDoc {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(source)?.[1] ?? ''
  const bodyMatch = /<body\b([^>]*)>([\s\S]*?)(?:<\/body>|$)/i.exec(source)
  let body = bodyMatch ? bodyMatch[2] : source.replace(/<head\b[\s\S]*?<\/head>/i, '').replace(/<\/?(html|!doctype)[^>]*>/gi, '')
  const bodyClass = /\sclass\s*=\s*(["'])(.*?)\1/i.exec(bodyMatch?.[1] ?? '')?.[2] ?? ''

  const stylesheets: string[] = []
  const remoteStyles: string[] = []
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue
    const href = /href\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2]
    if (!href) continue
    const local = resolveRef(path, href, root)
    if (local) stylesheets.push(local)
    else if (/^(https?:)?\/\//i.test(href)) remoteStyles.push(href.startsWith('//') ? `https:${href}` : href)
  }
  const inline: string[] = []
  const collectStyle = (_m: string, css: string) => { inline.push(css); return '' }
  head.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, collectStyle)
  // Scripts stay in document order: <head> scripts (usually libraries) first, then the body's.
  // Analytics/tracking snippets are dropped; they belong to the template's demo site.
  const tracking = /googletagmanager|google-analytics|gtag\(|fbq\(/i
  const headScripts = (head.match(/<script\b[\s\S]*?<\/script\s*>/gi) ?? []).filter((tag) => !tracking.test(tag))
  body = headScripts.join('\n') + '\n' + body
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, collectStyle)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, (tag) => (tracking.test(tag) ? '' : tag))
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')

  return {
    title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '').replace(/\s+/g, ' ').trim(),
    description: /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i.exec(head)?.[1],
    bodyClass: bodyClass.slice(0, 500),
    body: body.trim(),
    inlineCss: inline.join('\n'),
    stylesheets,
    remoteStyles,
  }
}

/** Rewrite asset references and links in page HTML. `pageLink` maps a package .html path to a page slug. */
function rewriteHtml(html: string, from: string, root: string, map: Mapper, pageLink: (path: string) => string | undefined) {
  const one = (ref: string) => {
    const path = resolveRef(from, ref, root)
    if (!path) return undefined
    if (/^html?$/.test(ext(path))) {
      const slug = pageLink(path)
      if (!slug) return undefined
      const hash = ref.includes('#') ? ref.slice(ref.indexOf('#')) : ''
      return `/?page=${encodeURIComponent(slug)}${hash}`
    }
    return map(path)
  }
  return mapCssUrls(
    html
      .replace(ASSET_ATTR, (m, attr: string, q: string, ref: string) => { const url = one(ref); return url ? `${attr}${q}${url}${q}` : m })
      .replace(SRCSET_ATTR, (m, attr: string, q: string, value: string) => {
        const rewritten = value.split(',').map((part) => {
          const [ref, ...size] = part.trim().split(/\s+/)
          const url = ref ? one(ref) : undefined
          return [url ?? ref, ...size].join(' ')
        }).join(', ')
        return `${attr}${q}${rewritten}${q}`
      }),
    from, root, map,
  )
}

// ---------- assets ----------

const UPLOADABLE = /^(png|jpe?g|gif|webp|svg|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|ogv|pdf|js|mjs)$/

/** Two passes over the content: collect referenced files, upload them, then rewrite with real URLs. */
async function withAssets<T>(files: Files, upload: Uploader, warnings: string[], build: (map: Mapper) => T): Promise<T> {
  const wanted = new Set<string>()
  // Multi-MB .svg files are legacy SVG fonts (only used by very old browsers); leave those links alone.
  const skip = (path: string) => ext(path) === 'svg' && files.get(path)!.byteLength > 1024 * 1024
  build((path) => { if (UPLOADABLE.test(ext(path)) && files.has(path) && !skip(path)) wanted.add(path); return undefined })

  const list = [...wanted]
  if (list.length > MAX_ASSETS) warnings.push(`${list.length - MAX_ASSETS} referenced files were skipped (limit ${MAX_ASSETS}).`)
  const urls = new Map<string, string>()
  const queue = list.slice(0, MAX_ASSETS)
  const failed: string[] = []
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const data = files.get(path)!
      if (data.byteLength > MAX_ASSET_BYTES) { warnings.push(`${path} skipped (over 25 MB).`); continue }
      try { urls.set(path, await upload(path, data)) } catch (error) {
        failed.push(path)
        console.error('Theme asset upload failed', path, error instanceof Error ? error.message : (error as { message?: string })?.message)
      }
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker))
  if (failed.length) warnings.push(`${failed.length} file(s) failed to upload and keep their original links: ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? '…' : ''}`)
  return build((path) => urls.get(path))
}

// Full-screen preloaders only delay the first paint inside the store; hide them. Editable in the theme CSS.
const HTML_TEMPLATE_FIXES = `
/* ---- Added on import: skip full-screen preloaders ---- */
#preloader, .preloader, #loader, .loader-wrapper, .page-loader, #page-preloader { display: none !important; }
`

// ---------- plans ----------

async function pageSlugs(paths: string[], root: string, slugTaken: Options['slugTaken']) {
  const slugs = new Map<string, string>()
  const used = new Set<string>()
  for (const path of paths) {
    const rel = path.slice(root.length).replace(/\.html?$/i, '')
    const base = (/(^|\/)index$/i.test(rel) && depth(rel) === 1 ? 'home' : slugify(rel.replace(/\//g, '-'))) || 'page'
    let slug = base
    for (let i = 2; used.has(slug) || await slugTaken(slug); i++) slug = `${base}-${i}`
    used.add(slug)
    slugs.set(path, slug)
  }
  return slugs
}

/**
 * Readable page titles. Templates often title every page "Brand | Page" or just "Brand"; drop the
 * part shared by all pages and fall back to the file name when titles still collide.
 */
export function pageTitles(pages: { title: string; slug: string }[]): string[] {
  const parts = pages.map((p) => p.title.split(/\s[|–—:-]\s/).map((x) => x.trim()).filter(Boolean))
  const shared = new Set(parts[0]?.filter((seg) => pages.length > 1 && parts.every((pp) => pp.includes(seg))) ?? [])
  const fromSlug = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const titles = parts.map((pp, i) => pp.filter((seg) => !shared.has(seg)).join(' – ') || fromSlug(pages[i].slug))
  const count = new Map<string, number>()
  for (const t of titles) count.set(t, (count.get(t) ?? 0) + 1)
  return titles.map((t, i) => ((count.get(t) ?? 0) > 1 ? fromSlug(pages[i].slug) : t).slice(0, 200))
}

async function planHtml(files: Files, root: string, opts: Options): Promise<ThemePlan> {
  const warnings: string[] = []
  const htmlPaths = [...files.keys()]
    .filter((p) => p.startsWith(root) && /^html?$/.test(ext(p)) && !DOC_DIR.test(p.slice(root.length)))
    .sort((a, b) => (/\/?index\.html?$/i.test(a.slice(root.length)) ? -1 : 0) - (/\/?index\.html?$/i.test(b.slice(root.length)) ? -1 : 0) || a.localeCompare(b))
  if (htmlPaths.length > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} of ${htmlPaths.length} HTML pages were imported.`)
  const pagePaths = htmlPaths.slice(0, MAX_PAGES)
  const slugs = await pageSlugs(pagePaths, root, opts.slugTaken)
  const docs = pagePaths.map((path) => ({ path, doc: parseHtml(strFromU8(files.get(path)!), path, root) }))

  const cssOrder: string[] = []
  const remote = new Set<string>()
  for (const { doc } of docs) {
    for (const s of doc.stylesheets) if (!cssOrder.includes(s)) cssOrder.push(s)
    for (const r of doc.remoteStyles) remote.add(r)
  }
  const missing = cssOrder.filter((p) => !files.has(p))
  if (missing.length) warnings.push(`Stylesheets not found in the zip: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`)

  const built = await withAssets(files, opts.upload, warnings, (map) => {
    const imports = [...remote].map((href) => `@import url("${href}");`)
    const bodies: string[] = []
    for (const path of cssOrder) {
      const { imports: inner, body } = processCss(files, path, root, map)
      imports.push(...inner)
      bodies.push(`/* ${path.slice(root.length)} */\n${body}`)
    }
    const pages = docs.map(({ path, doc }) => ({
      path,
      content: rewriteHtml(doc.body, path, root, map, (p) => slugs.get(p)),
      css: mapCssUrls(doc.inlineCss, path, root, map),
    }))
    return { css: [...new Set(imports)].join('\n') + '\n' + bodies.join('\n\n') + HTML_TEMPLATE_FIXES, pages }
  })

  const titles = pageTitles(docs.map(({ path, doc }) => ({ title: doc.title, slug: slugs.get(path)! })))
  const pages: PlannedPage[] = built.pages.map(({ path, content, css }, i) => {
    const { doc } = docs[i]
    const slug = slugs.get(path)!
    return {
      slug,
      title: titles[i],
      content, css, bodyClass: doc.bodyClass,
      layout: 'isolated', hideHeaderFooter: true,
      metaTitle: doc.title.slice(0, 200) || undefined,
      metaDescription: doc.description?.slice(0, 500),
    }
  })
  warnings.push('Template scripts run in an isolated frame. Features that need the template’s own server (PHP contact forms, newsletter signup) won’t submit.')

  const fileName = opts.fileName?.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim()
  return {
    kind: 'html',
    name: (fileName || docs[0]?.doc.title || 'HTML Template').slice(0, 120),
    version: '1.0.0',
    description: `Imported HTML template (${pages.length} page${pages.length === 1 ? '' : 's'}).`,
    schema: [],
    settings: { hide_chrome_on_home: true },
    sections: pages.length ? [{ id: 's-page-home', type: 'page', enabled: true, settings: { page: pages[0].slug } }] : [],
    css: built.css,
    menus: {},
    pages,
    warnings,
  }
}

async function planNative(files: Files, manifestPath: string, opts: Options): Promise<ThemePlan> {
  const warnings: string[] = []
  const root = dirOf(manifestPath)
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(strFromU8(files.get(manifestPath)!))
  } catch {
    throw new HttpError(422, 'theme.json is not valid JSON')
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new HttpError(422, 'theme.json must be an object')
  const name = typeof manifest.name === 'string' ? manifest.name.trim().slice(0, 120) : ''
  if (!name) throw new HttpError(422, 'theme.json needs a "name"')

  const ownSchema = cleanSchema(manifest.settings_schema)
  const schema = mergeSchema(ownSchema)
  const cssPaths = Array.isArray(manifest.css)
    ? manifest.css.filter((p): p is string => typeof p === 'string').map((p) => resolveRef(manifestPath, p, root)).filter((p): p is string => !!p)
    : [...files.keys()].filter((p) => p.startsWith(root) && ext(p) === 'css').sort()
  for (const p of cssPaths) if (!files.has(p)) warnings.push(`CSS file not found: ${p.slice(root.length)}`)

  type RawPage = { slug?: unknown; title?: unknown; file?: unknown; content?: unknown; layout?: unknown; hide_header_footer?: unknown }
  const rawPages = (Array.isArray(manifest.pages) ? manifest.pages : []).slice(0, MAX_PAGES) as RawPage[]
  const pageFiles = rawPages.map((p) => (typeof p.file === 'string' ? resolveRef(manifestPath, p.file, root) : null))
  const slugByFile = new Map<string, string>()
  const renamed = new Map<string, string>() // slug in theme.json → slug used (when already taken in this store)
  const slugs: string[] = []
  for (const [i, p] of rawPages.entries()) {
    const base = slugify(typeof p.slug === 'string' ? p.slug : typeof p.title === 'string' ? p.title : '') || `page-${i + 1}`
    let slug = base
    for (let n = 2; slugs.includes(slug) || await opts.slugTaken(slug); n++) slug = `${base}-${n}`
    slugs.push(slug)
    if (!renamed.has(base)) renamed.set(base, slug)
    if (pageFiles[i]) slugByFile.set(pageFiles[i]!, slug)
  }
  const pageSlug = (slug: string) => renamed.get(slug) ?? slug
  const relinkMenu = (items: MenuItem[]): MenuItem[] => items.map((m) => ({
    ...m,
    link: m.link.startsWith('page:') ? `page:${pageSlug(m.link.slice(5))}` : m.link,
    ...(m.children ? { children: relinkMenu(m.children) } : {}),
  }))

  const rawSettings = (manifest.settings && typeof manifest.settings === 'object' ? manifest.settings : {}) as Record<string, unknown>
  const imageIds = schema.filter((d) => d.type === 'image').map((d) => d.id)
  const rawSections = Array.isArray(manifest.sections) ? manifest.sections : []

  const built = await withAssets(files, opts.upload, warnings, (map) => {
    const asset = (ref: unknown) => {
      if (typeof ref !== 'string') return ref
      const path = resolveRef(manifestPath, ref, root)
      return (path && map(path)) || ref
    }
    const imports: string[] = []
    const bodies = cssPaths.map((p) => {
      const { imports: inner, body } = processCss(files, p, root, map)
      imports.push(...inner)
      return body
    })
    // Image settings may point at files in the package, both as defaults and as values.
    const schemaWithAssets = ownSchema.map((d) => (d.type === 'image' && d.default ? { ...d, default: asset(d.default) as string } : d))
    const settings = Object.fromEntries(Object.entries(rawSettings).map(([k, v]) => [k, imageIds.includes(k) ? asset(v) : v]))
    const sections = rawSections.map((s) => {
      if (!s || typeof s !== 'object') return s
      const sec = s as { settings?: Record<string, unknown> }
      const settings = { ...sec.settings }
      if (typeof settings.html === 'string') settings.html = rewriteHtml(settings.html, manifestPath, root, map, (p) => slugByFile.get(p))
      if (typeof settings.page === 'string') settings.page = pageSlug(settings.page)
      if (typeof settings.link === 'string' && settings.link.startsWith('page:')) settings.link = `page:${pageSlug(settings.link.slice(5))}`
      return { ...sec, settings }
    })
    const pages = rawPages.map((p, i) => {
      const file = pageFiles[i]
      if (file && files.has(file)) {
        const doc = parseHtml(strFromU8(files.get(file)!), file, root)
        return { content: rewriteHtml(doc.body, file, root, map, (x) => slugByFile.get(x)), css: mapCssUrls(doc.inlineCss, file, root, map), bodyClass: doc.bodyClass }
      }
      const content = typeof p.content === 'string' ? rewriteHtml(p.content, manifestPath, root, map, (x) => slugByFile.get(x)) : ''
      return { content, css: '', bodyClass: '' }
    })
    return { css: [...new Set(imports)].join('\n') + '\n' + bodies.join('\n\n'), schema: schemaWithAssets, settings, sections, pages }
  })

  const menus: ThemePlan['menus'] = {}
  if (manifest.menus && typeof manifest.menus === 'object') {
    for (const [handle, items] of Object.entries(manifest.menus as Record<string, unknown>)) {
      if (!(handle in MENU_HANDLES)) continue
      try { menus[handle as MenuHandle] = relinkMenu(cleanMenu(items)) } catch (e) { warnings.push(`Menu "${handle}" ignored: ${(e as Error).message}`) }
    }
  }

  const finalSchema = built.schema
  return {
    kind: 'native',
    name,
    version: typeof manifest.version === 'string' ? manifest.version.slice(0, 20) : '1.0.0',
    author: typeof manifest.author === 'string' ? manifest.author.slice(0, 120) : undefined,
    description: typeof manifest.description === 'string' ? manifest.description.slice(0, 1000) : undefined,
    schema: finalSchema,
    settings: cleanSettings(built.settings, mergeSchema(finalSchema)),
    sections: cleanSections(built.sections),
    css: built.css,
    menus,
    pages: rawPages.map((p, i) => ({
      slug: slugs[i],
      title: (typeof p.title === 'string' && p.title.trim() ? p.title.trim() : slugs[i]).slice(0, 200),
      ...built.pages[i],
      layout: p.layout === 'isolated' ? 'isolated' : 'standard',
      hideHeaderFooter: p.hide_header_footer === true,
    })),
    warnings,
  }
}

export async function readThemePackage(zip: Uint8Array, opts: Options): Promise<ThemePlan> {
  const files = unzipPackage(zip)
  const platform = detectPlatform(files)
  return platform.kind === 'native' ? planNative(files, platform.manifest, opts) : planHtml(files, platform.root, opts)
}
