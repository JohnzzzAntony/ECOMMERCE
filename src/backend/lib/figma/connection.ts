// The store's Figma connection: save (encrypted), read the access token (refreshing OAuth tokens before they
// expire), and mark it NEEDS_REAUTH when Figma rejects the refresh.
import type { FigmaConnection } from '@prisma/client'
import { HttpError } from '@/backend/lib/auth'
import { log } from '@/backend/lib/log'
import { audit, type StoreDb } from '@/backend/lib/tenancy'
import { sendFigmaReauthNotice } from '@/backend/integrations/resend'
import type { FigmaAuth, FigmaMe } from './client'
import { decryptSecret, encryptSecret } from './crypto'
import { OAuthError, oauthConfig, refreshAccessToken } from './oauth'

export type StoreCtx = { db: StoreDb; store: { id: string } }

const REFRESH_MARGIN_MS = 5 * 60_000
const context = (storeId: string, field: 'access' | 'refresh') => `figma:${storeId}:${field}`

/** What the admin UI may see about a connection. Tokens never leave the server. */
export function publicConnection(c: FigmaConnection | null) {
  if (!c) return null
  return { handle: c.handle, email: c.email, figmaUserId: c.figmaUserId, authType: c.authType, status: c.status, scopes: c.scopes ? c.scopes.split(' ') : [], expiresAt: c.expiresAt, connectedAt: c.updatedAt }
}

export async function saveConnection(ctx: StoreCtx, input: {
  authType: 'OAUTH' | 'PAT'; me: FigmaMe; accessToken: string; refreshToken?: string | null; expiresAt: Date | null; scopes: string; userId: string
}) {
  const access = encryptSecret(input.accessToken, context(ctx.store.id, 'access'))
  const refresh = input.refreshToken ? encryptSecret(input.refreshToken, context(ctx.store.id, 'refresh')) : null
  if (refresh && refresh.keyVersion !== access.keyVersion) throw new Error('Key version changed mid-encryption')
  const data = {
    figmaUserId: input.me.id, handle: input.me.handle, email: input.me.email ?? null, authType: input.authType,
    accessTokenEnc: access.ciphertext, refreshTokenEnc: refresh?.ciphertext ?? null, keyVersion: access.keyVersion,
    expiresAt: input.expiresAt, scopes: input.scopes, status: 'ACTIVE' as const, createdBy: input.userId,
  }
  return ctx.db.figmaConnection.upsert({ where: { storeId: ctx.store.id }, create: { storeId: ctx.store.id, ...data }, update: data })
}

// One refresh per store at a time: Figma keeps a single access token per app and user, so a second concurrent
// refresh would invalidate the token the first one just obtained.
const g = globalThis as unknown as { __figmaRefreshing?: Map<string, Promise<string>> }
const refreshing = (g.__figmaRefreshing ??= new Map())

/** Credentials for calling Figma on behalf of the store. */
export async function figmaAuth(ctx: StoreCtx, now = Date.now()): Promise<FigmaAuth> {
  const conn = await ctx.db.figmaConnection.findFirst({})
  if (!conn) throw new HttpError(409, 'Connect a Figma account first')
  if (conn.status === 'NEEDS_REAUTH') throw new HttpError(409, 'Figma access expired. Reconnect your Figma account.')
  const token = decryptSecret(conn.accessTokenEnc, conn.keyVersion, context(ctx.store.id, 'access'))
  if (conn.authType === 'PAT') return { type: 'PAT', token, key: ctx.store.id }
  if (!conn.expiresAt || conn.expiresAt.getTime() - now > REFRESH_MARGIN_MS) return { type: 'OAUTH', token, key: ctx.store.id }

  let pending = refreshing.get(ctx.store.id)
  if (!pending) {
    pending = refresh(ctx, conn, now).finally(() => refreshing.delete(ctx.store.id))
    refreshing.set(ctx.store.id, pending)
  }
  return { type: 'OAUTH', token: await pending, key: ctx.store.id }
}

async function refresh(ctx: StoreCtx, conn: FigmaConnection, now: number) {
  const config = oauthConfig()
  if (!config || !conn.refreshTokenEnc) return markNeedsReauth(ctx, conn, 'OAuth app not configured or no refresh token')
  const refreshToken = decryptSecret(conn.refreshTokenEnc, conn.keyVersion, context(ctx.store.id, 'refresh'))
  try {
    const tokens = await refreshAccessToken(config, refreshToken)
    // Refresh responses carry no new refresh token; the old one stays valid (re-encrypted with the current key).
    const access = encryptSecret(tokens.access_token, context(ctx.store.id, 'access'))
    const refreshed = encryptSecret(refreshToken, context(ctx.store.id, 'refresh'))
    await ctx.db.figmaConnection.update({
      where: { id: conn.id },
      data: { accessTokenEnc: access.ciphertext, refreshTokenEnc: refreshed.ciphertext, keyVersion: access.keyVersion, expiresAt: new Date(now + tokens.expires_in * 1000) },
    })
    log('info', 'figma token refreshed', { storeId: ctx.store.id })
    return tokens.access_token
  } catch (error) {
    // 400/401/403: the grant is gone (revoked app, rotated secret). Anything else is transient: retry later.
    if (error instanceof OAuthError && error.status >= 400 && error.status < 500) return markNeedsReauth(ctx, conn, error.message)
    log('warn', 'figma token refresh failed', { storeId: ctx.store.id, error })
    throw new HttpError(502, 'Could not refresh Figma access. Please try again.')
  }
}

async function markNeedsReauth(ctx: StoreCtx, conn: FigmaConnection, reason: string): Promise<never> {
  await ctx.db.figmaConnection.update({ where: { id: conn.id }, data: { status: 'NEEDS_REAUTH' } })
  log('warn', 'figma connection needs re-authorization', { storeId: ctx.store.id, reason })
  await audit(ctx, null, { actorId: null, action: 'figma.reauth_required', entityType: 'FigmaConnection', entityId: conn.id, diff: { reason } })
  const owners = await ctx.db.storeMember.findMany({ where: { role: { in: ['OWNER', 'ADMIN'] } }, include: { user: { select: { email: true } } } })
  await sendFigmaReauthNotice(owners.map((m) => m.user.email))
  throw new HttpError(409, 'Figma access expired. Reconnect your Figma account.')
}
