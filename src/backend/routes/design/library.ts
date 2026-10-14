// Design system (tokens), media library and fonts. Token edits and activation are audited.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, HttpError } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { invalidateAll } from '@/backend/lib/memo'
import { rateLimit } from '@/backend/lib/rate-limit'
import { audit, requireStoreRole } from '@/backend/lib/tenancy'
import { AssetError, processImage, storeAsset } from '@/backend/lib/design-import/assets'
import { uploadFont } from '@/backend/lib/design-import/fonts'
import { contrastIssues, designTokensSchema } from '@/shared/design-tokens'

const noStore = { 'Cache-Control': 'no-store' }
const ID = /^[a-z0-9]{10,40}$/
const MAX_UPLOAD = 15 * 1024 * 1024

// ---------------------------------------------------------------- design system
export async function getDesignSystem(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const rows = await ctx.db.designSystem.findMany({ orderBy: { version: 'desc' }, take: 20 })
    const active = rows.find((r) => r.status === 'ACTIVE') ?? null
    const draft = rows.find((r) => r.status === 'DRAFT') ?? null
    const current = draft ?? active
    const tokens = current ? designTokensSchema.safeParse(current.tokens) : null
    return NextResponse.json({
      active: active && { id: active.id, version: active.version }, draft: draft && { id: draft.id, version: draft.version },
      editing: current && { id: current.id, version: current.version, status: current.status, tokens: tokens?.success ? tokens.data : null },
      contrast: tokens?.success ? contrastIssues(tokens.data) : [],
      history: rows.map((r) => ({ id: r.id, version: r.version, status: r.status, createdAt: r.createdAt, importId: r.importId })),
    }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Saves edited tokens as the draft design system (a new draft version if only an active one exists). */
export async function putDesignSystem(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const body = await readJson(request)
    const parsed = designTokensSchema.safeParse(body.tokens)
    if (!parsed.success) throw new HttpError(400, `Invalid tokens: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`)
    const draft = await ctx.db.designSystem.findFirst({ where: { status: 'DRAFT' } })
    const last = await ctx.db.designSystem.findFirst({ orderBy: { version: 'desc' } })
    const saved = draft
      ? await ctx.db.designSystem.update({ where: { id: draft.id }, data: { tokens: parsed.data } })
      : await ctx.db.designSystem.create({ data: { storeId: ctx.store.id, version: (last?.version ?? 0) + 1, status: 'DRAFT', tokens: parsed.data, createdBy: ctx.user.id } })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.tokens.edit', entityType: 'DesignSystem', entityId: saved.id, diff: { version: saved.version } })
    return NextResponse.json({ id: saved.id, version: saved.version, status: saved.status, contrast: contrastIssues(parsed.data) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function activateDesignSystem(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const { id } = await readJson(request)
    if (typeof id !== 'string' || !ID.test(id)) throw new HttpError(400, 'Choose a design system version')
    const target = await ctx.db.designSystem.findFirst({ where: { id } })
    if (!target) throw new HttpError(404, 'Design system not found')
    await ctx.db.designSystem.updateMany({ where: { status: 'ACTIVE', id: { not: id } }, data: { status: 'ARCHIVED' } })
    await ctx.db.designSystem.update({ where: { id }, data: { status: 'ACTIVE' } })
    invalidateAll()
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.tokens.activate', entityType: 'DesignSystem', entityId: id, diff: { version: target.version } })
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch (error) { return failure(error) }
}

// ---------------------------------------------------------------- media library
export async function listAssets(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const assets = await ctx.db.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
    return NextResponse.json(assets.map((a) => ({ id: a.id, url: a.url, mime: a.mime, width: a.width, height: a.height, alt: a.alt, altReviewed: a.altReviewed, blurhash: a.blurhash, createdAt: a.createdAt })), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function uploadAsset(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    rateLimit(`asset-upload:${ctx.store.id}`, 60, 60 * 60_000)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, 'Choose an image')
    if (file.size > MAX_UPLOAD) throw new HttpError(413, 'Images must be 15 MB or smaller')
    const alt = String(form.get('alt') ?? '').slice(0, 300)
    let image
    try { image = await processImage(Buffer.from(await file.arrayBuffer())) } catch (error) { throw new HttpError(400, error instanceof AssetError ? error.message : 'Unsupported image') }
    const asset = await storeAsset(ctx, image, { alt })
    if (alt) await ctx.db.asset.update({ where: { id: asset.id }, data: { alt, altReviewed: true } })
    return NextResponse.json({ ...asset, alt }, { status: 201, headers: noStore })
  } catch (error) { return failure(error) }
}

export async function patchAsset(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    const { id } = await params
    if (!ID.test(id)) throw new HttpError(400, 'Invalid asset id')
    const body = z.object({ alt: z.string().max(300) }).safeParse(await readJson(request))
    if (!body.success) throw new HttpError(400, 'Alt text is limited to 300 characters')
    const existing = await ctx.db.asset.findFirst({ where: { id } })
    if (!existing) throw new HttpError(404, 'Image not found')
    const asset = await ctx.db.asset.update({ where: { id }, data: { alt: body.data.alt.trim(), altReviewed: true } })
    return NextResponse.json({ id: asset.id, alt: asset.alt, altReviewed: asset.altReviewed }, { headers: noStore })
  } catch (error) { return failure(error) }
}

// ---------------------------------------------------------------- fonts
export async function listFonts(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'VIEWER')
    const fonts = await ctx.db.font.findMany({ orderBy: { family: 'asc' } })
    return NextResponse.json(fonts.map((f) => ({ id: f.id, family: f.family, weights: f.weights, source: f.source, files: (f.files as unknown[]).length })), { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function uploadFontRoute(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'EDITOR')
    rateLimit(`font-upload:${ctx.store.id}`, 30, 60 * 60_000)
    const form = await request.formData()
    const file = form.get('file')
    const family = String(form.get('family') ?? '').trim()
    const weight = Number(form.get('weight') ?? 400)
    const style = form.get('style') === 'italic' ? 'italic' : 'normal'
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a font file')
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, 'Font files must be 5 MB or smaller')
    if (!/^[A-Za-z0-9 _-]{1,60}$/.test(family)) throw new HttpError(400, 'Enter the font family name exactly as used in Figma')
    if (!Number.isInteger(weight) || weight < 100 || weight > 950) throw new HttpError(400, 'Weight must be between 100 and 950')
    if (form.get('licensed') !== 'true') throw new HttpError(400, 'Confirm you hold a licence to use this font on the web')
    let font
    try { font = await uploadFont(ctx, family, weight, style, Buffer.from(await file.arrayBuffer())) } catch (error) { throw new HttpError(400, error instanceof AssetError ? error.message : 'Unsupported font file') }
    invalidateAll()
    await audit(ctx, request, { actorId: ctx.user.id, action: 'design.font.upload', entityType: 'Font', entityId: font.id, diff: { family, weight, style } })
    return NextResponse.json({ id: font.id, family: font.family, weights: font.weights }, { status: 201, headers: noStore })
  } catch (error) { return failure(error) }
}
