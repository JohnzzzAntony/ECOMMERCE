// Re-sync: learn about new Figma versions of imported files (webhooks v2, or polling file metadata when webhooks
// can't be created for the file's plan), and start re-sync imports.
// Webhooks per https://developers.figma.com/docs/rest-api/webhooks-endpoints/ and /webhooks-events/ (checked 2026-10-14):
// POST /v2/webhooks { event_type, context: 'file', context_id, endpoint, passcode, description } (webhooks:write);
// FILE_VERSION_UPDATE payload { event_type, file_key, version_id, passcode, webhook_id, timestamp, ... }; PING on create.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FigmaFile } from '@prisma/client'
import { z } from 'zod'
import { HttpError } from '@/backend/lib/auth'
import { log } from '@/backend/lib/log'
import { systemDb, type StoreDb } from '@/backend/lib/tenancy'
import { figmaRequest, type FigmaAuth } from './client'
import { apiKey } from './files'

type Ctx = { db: StoreDb; store: { id: string } }
const POLL_EVERY_MS = 15 * 60_000
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export const webhookEndpoint = () => {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return /^https:\/\//.test(site) ? `${site.replace(/\/$/, '')}/api/design/figma/webhooks` : null
}

/** Best effort: without a public HTTPS URL or on plans without file webhooks, polling covers the file. */
export async function registerWebhook(ctx: Ctx, auth: FigmaAuth, file: FigmaFile) {
  const endpoint = webhookEndpoint()
  if (file.webhookId || !endpoint) return null
  const passcode = randomBytes(32).toString('base64url')
  try {
    const hook = await figmaRequest<{ id: string | number }>('/v2/webhooks', auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'FILE_VERSION_UPDATE', context: 'file', context_id: apiKey(file.fileKey, file.branchKey || null), endpoint, passcode, description: 'NexEcoms design re-sync' }),
    })
    await ctx.db.figmaFile.update({ where: { id: file.id }, data: { webhookId: String(hook.id), webhookPasscodeHash: sha256(passcode) } })
    return String(hook.id)
  } catch (error) {
    log('warn', 'figma webhook registration failed; using polling', { storeId: ctx.store.id, fileKey: file.fileKey, error })
    return null
  }
}

/** Disconnect: delete the store's webhooks in Figma (errors are logged; the rows are cleared either way). */
export async function deleteWebhooks(ctx: Ctx, auth: FigmaAuth | null) {
  const files = await ctx.db.figmaFile.findMany({ where: { webhookId: { not: null } } })
  for (const file of files) {
    if (auth) await figmaRequest(`/v2/webhooks/${encodeURIComponent(file.webhookId!)}`, auth, { method: 'DELETE' }).catch((error) => log('warn', 'figma webhook delete failed', { storeId: ctx.store.id, webhookId: file.webhookId, error }))
    await ctx.db.figmaFile.update({ where: { id: file.id }, data: { webhookId: null, webhookPasscodeHash: null } })
  }
  return files.length
}

const webhookSchema = z.object({
  event_type: z.string().max(40),
  passcode: z.string().max(200),
  webhook_id: z.union([z.string(), z.number()]).transform(String),
  file_key: z.string().max(100).optional(),
  version_id: z.union([z.string(), z.number()]).transform(String).optional(),
  timestamp: z.string().optional(),
})

/** Verifies the passcode (constant time) for the webhook id, then records the new version. */
export async function handleWebhook(body: unknown) {
  const parsed = webhookSchema.safeParse(body)
  if (!parsed.success) throw new HttpError(400, 'Invalid webhook payload')
  const event = parsed.data
  const sys = systemDb()
  const file = await sys.figmaFile.findFirst({ where: { webhookId: event.webhook_id } })
  const expected = Buffer.from(file?.webhookPasscodeHash ?? sha256('no-such-webhook'))
  const actual = Buffer.from(sha256(event.passcode))
  if (!file || !timingSafeEqual(expected, actual)) throw new HttpError(401, 'Invalid webhook')
  if (event.event_type === 'FILE_VERSION_UPDATE' && event.version_id && event.version_id !== file.version) {
    await sys.figmaFile.update({ where: { id: file.id }, data: { latestVersion: event.version_id, lastCheckedAt: new Date() } })
    log('info', 'figma file updated', { storeId: file.storeId, fileKey: file.fileKey, version: event.version_id })
  }
  return { ok: true }
}

/** Polls GET /v1/files/:key/meta for files without a webhook (at most every 15 minutes each). */
export async function pollForUpdates(ctx: Ctx, auth: FigmaAuth, limit = 5) {
  const due = await ctx.db.figmaFile.findMany({ where: { webhookId: null, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - POLL_EVERY_MS) } }] }, take: limit })
  for (const file of due) {
    try {
      const { file: meta } = await figmaRequest<{ file: { version: string } }>(`/v1/files/${apiKey(file.fileKey, file.branchKey || null)}/meta`, auth)
      await ctx.db.figmaFile.update({ where: { id: file.id }, data: { latestVersion: String(meta.version), lastCheckedAt: new Date() } })
    } catch (error) {
      log('warn', 'figma update poll failed', { storeId: ctx.store.id, fileKey: file.fileKey, error })
      await ctx.db.figmaFile.update({ where: { id: file.id }, data: { lastCheckedAt: new Date() } })
    }
  }
  return due.length
}

export const updateAvailable = (f: Pick<FigmaFile, 'latestVersion' | 'version'>) => !!f.latestVersion && f.latestVersion !== f.version

/** Queues a re-sync import with the same frames and page assignments as the file's last installed import. */
export async function startResync(ctx: Ctx, fileId: string, userId: string) {
  const last = await ctx.db.designImport.findFirst({ where: { fileId, status: 'INSTALLED' }, orderBy: { installedAt: 'desc' } })
  if (!last) throw new HttpError(409, 'Install an import of this file before re-syncing it')
  const running = await ctx.db.designImport.findFirst({ where: { fileId, kind: 'RESYNC', status: { notIn: ['INSTALLED', 'FAILED'] } } })
  if (running) return running
  return ctx.db.designImport.create({
    data: { storeId: ctx.store.id, fileId, kind: 'RESYNC', status: 'QUEUED', figmaVersion: last.figmaVersion, selectedNodeIds: last.selectedNodeIds, pageAssignments: last.pageAssignments as object, createdBy: userId },
  })
}
