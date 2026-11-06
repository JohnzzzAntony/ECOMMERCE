// Fonts: licensed font files uploaded by the store (licensing is the store's responsibility).
import type { StoreDb } from '@/backend/lib/tenancy'
import { AssetError } from './assets'
import { putFontFile } from './storage'

export type FontFile = { weight: number; style: 'normal' | 'italic'; url: string; format: 'woff2' | 'woff' | 'truetype' | 'opentype'; unicodeRange?: string }

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
