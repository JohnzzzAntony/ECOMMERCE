// Fonts: Google Fonts used by a design are self-hosted (WOFF2, latin + latin-ext subsets) so the storefront never
// calls Google or Figma. Other fonts must be uploaded by the store (licensing is the store's responsibility).
import type { StoreDb } from '@/backend/lib/tenancy'
import { AssetError, FONT_HOSTS, safeFetch } from './assets'
import { matchGoogleFont } from './tokens'
import { putFontFile } from './storage'

export type FontFile = { weight: number; style: 'normal' | 'italic'; url: string; format: 'woff2' | 'woff' | 'truetype' | 'opentype'; unicodeRange?: string }

// A current browser UA makes Google serve WOFF2 with unicode-range subsets.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const SUBSETS = new Set(['latin', 'latin-ext'])

/** Parses Google's css2 response into @font-face entries (subset comment, style, weight, src, unicode-range). */
export function parseGoogleCss(css: string) {
  const out: { subset: string; style: 'normal' | 'italic'; weight: number; url: string; unicodeRange?: string }[] = []
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g
  for (let m; (m = re.exec(css));) {
    const body = m[2]
    const url = body.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff2['"]\)/)?.[1]
    const weight = Number(body.match(/font-weight:\s*(\d+)/)?.[1] ?? 400)
    const style = /font-style:\s*italic/.test(body) ? 'italic' : 'normal'
    const unicodeRange = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim()
    if (url) out.push({ subset: m[1], style, weight, url, unicodeRange })
  }
  return out
}

export async function selfHostGoogleFont(ctx: { db: StoreDb; store: { id: string } }, family: string, weights: number[], italic: boolean) {
  const g = matchGoogleFont(family)
  if (!g) return null
  const wanted = [...new Set(weights.map((w) => g.weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), g.weights[0] ?? 400)))].sort((a, b) => a - b)
  const axes = italic ? `ital,wght@${[...wanted.map((w) => `0,${w}`), ...wanted.map((w) => `1,${w}`)].join(';')}` : `wght@${wanted.join(';')}`
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(g.family).replace(/%20/g, '+')}:${axes}&display=swap`
  let css: string
  try { css = (await safeFetch(cssUrl, FONT_HOSTS, 1_000_000, { headers: { 'User-Agent': UA } })).data.toString('utf8') }
  catch {
    // Some families don't offer every axis combination; fall back to the default weight.
    css = (await safeFetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(g.family).replace(/%20/g, '+')}&display=swap`, FONT_HOSTS, 1_000_000, { headers: { 'User-Agent': UA } })).data.toString('utf8')
  }
  const files: FontFile[] = []
  for (const face of parseGoogleCss(css).filter((f) => SUBSETS.has(f.subset))) {
    const { data } = await safeFetch(face.url, FONT_HOSTS, 2_000_000)
    if (data.subarray(0, 4).toString('latin1') !== 'wOF2') throw new AssetError('Google returned a non-WOFF2 font file')
    const url = await putFontFile(ctx.store.id, g.family, `${face.weight}-${face.style}-${face.subset}.woff2`, data)
    files.push({ weight: face.weight, style: face.style, url, format: 'woff2', unicodeRange: face.unicodeRange })
  }
  const data = { family: g.family, weights: [...new Set(files.map((f) => f.weight))], source: 'GOOGLE' as const, files }
  const existing = await ctx.db.font.findFirst({ where: { family: g.family } })
  return existing
    ? ctx.db.font.update({ where: { id: existing.id }, data })
    : ctx.db.font.create({ data: { storeId: ctx.store.id, ...data } })
}

const FONT_MAGIC: [string, FontFile['format']][] = [['wOF2', 'woff2'], ['wOFF', 'woff'], ['\x00\x01\x00\x00', 'truetype'], ['true', 'truetype'], ['OTTO', 'opentype']]

/** Admin upload of a licensed font file; the format comes from the file's signature. */
export async function uploadFont(ctx: { db: StoreDb; store: { id: string } }, family: string, weight: number, style: 'normal' | 'italic', data: Buffer) {
  const format = FONT_MAGIC.find(([magic]) => data.subarray(0, 4).toString('latin1') === magic)?.[1]
  if (!format) throw new AssetError('Upload a .woff2, .woff, .ttf or .otf font file')
  const ext = { woff2: 'woff2', woff: 'woff', truetype: 'ttf', opentype: 'otf' }[format]
  const url = await putFontFile(ctx.store.id, family, `${weight}-${style}-upload.${ext}`, data)
  const existing = await ctx.db.font.findFirst({ where: { family } })
  const prior = ((existing?.files ?? []) as FontFile[]).filter((f) => !(f.weight === weight && f.style === style))
  const files = [...prior, { weight, style, url, format }]
  const payload = { family, weights: [...new Set(files.map((f) => f.weight))].sort((a, b) => a - b), source: 'UPLOAD' as const, files }
  return existing ? ctx.db.font.update({ where: { id: existing.id }, data: payload }) : ctx.db.font.create({ data: { storeId: ctx.store.id, ...payload } })
}
