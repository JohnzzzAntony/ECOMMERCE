// Figma account connection for the request's store: status, OAuth connect, personal access token, disconnect.
// OWNER/ADMIN connect and disconnect; every member can see the status.
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { failure, HttpError, sessionToken, text } from '@/backend/lib/auth'
import { readJson } from '@/backend/lib/admin-resource'
import { log } from '@/backend/lib/log'
import { rateLimit } from '@/backend/lib/rate-limit'
import { audit, clientIp, requireStoreRole } from '@/backend/lib/tenancy'
import { FigmaApiError, figmaMe } from '@/backend/lib/figma/client'
import { figmaAuth, publicConnection, saveConnection } from '@/backend/lib/figma/connection'
import { deleteWebhooks } from '@/backend/lib/figma/resync'
import { authorizeUrl, exchangeCode, FIGMA_SCOPES, oauthConfig, randomToken, sha256 } from '@/backend/lib/figma/oauth'

const noStore = { 'Cache-Control': 'no-store' }
const STATE_TTL_MS = 10 * 60_000
const REVOKE_HELP = 'To also remove NexEcoms from your Figma account, open Figma → Settings → Security and remove the app under connected apps (or revoke the personal access token there).'

export async function getConnection(request: Request) {
  try {
    const { db, role } = await requireStoreRole(request, 'VIEWER')
    const conn = await db.figmaConnection.findFirst({})
    return NextResponse.json({ connection: publicConnection(conn), oauthAvailable: !!oauthConfig(), canManage: role === 'OWNER' || role === 'ADMIN' }, { headers: noStore })
  } catch (error) { return failure(error) }
}

export async function startOAuth(request: Request) {
  try {
    const { user, store, db } = await requireStoreRole(request, 'ADMIN')
    rateLimit(`figma-oauth:${store.id}:${user.id}`, 10, 10 * 60_000)
    const config = oauthConfig()
    if (!config) throw new HttpError(501, 'Figma sign-in is not configured on this server. Use a personal access token instead.')
    const state = randomToken(), codeVerifier = randomToken()
    await db.figmaOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    await db.figmaOAuthState.create({
      data: { id: sha256(state), storeId: store.id, userId: user.id, sessionHash: sha256(sessionToken(request) ?? ''), codeVerifier, expiresAt: new Date(Date.now() + STATE_TTL_MS) },
    })
    return NextResponse.json({ url: authorizeUrl(config, state, codeVerifier) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

const backToAdmin = (result: string) => new Response(null, { status: 303, headers: { Location: `/admin?section=figma&figma=${result}`, ...noStore } })

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** Figma redirects here with ?code&state. Errors go back to the admin page; details only reach the log. */
export async function oauthCallback(request: Request) {
  try {
    rateLimit(`figma-callback:${clientIp(request) ?? 'unknown'}`, 20, 10 * 60_000)
    const params = new URL(request.url).searchParams
    if (params.get('error')) return backToAdmin('denied')
    const code = text(params.get('code') ?? '', 'code', 512, true)
    const state = text(params.get('state') ?? '', 'state', 128, true)
    const ctx = await requireStoreRole(request, 'ADMIN')
    const config = oauthConfig()
    if (!config) throw new HttpError(501, 'Figma OAuth is not configured')

    // Single use: whoever deletes the row owns the flow; a replayed state finds nothing.
    const id = sha256(state)
    const pending = await ctx.db.figmaOAuthState.findFirst({ where: { id } })
    const consumed = pending ? (await ctx.db.figmaOAuthState.deleteMany({ where: { id } })).count === 1 : false
    if (!pending || !consumed) throw new HttpError(400, 'Unknown or already used OAuth state')
    if (pending.expiresAt.getTime() < Date.now()) throw new HttpError(400, 'OAuth state expired')
    if (pending.userId !== ctx.user.id || !sameHash(pending.sessionHash, sha256(sessionToken(request) ?? ''))) throw new HttpError(400, 'OAuth state belongs to another session')

    const tokens = await exchangeCode(config, code, pending.codeVerifier)
    const me = await figmaMe({ type: 'OAUTH', token: tokens.access_token })
    const conn = await saveConnection(ctx, {
      authType: 'OAUTH', me, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000), scopes: FIGMA_SCOPES.join(' '), userId: ctx.user.id,
    })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'figma.connect', entityType: 'FigmaConnection', entityId: conn.id, diff: { authType: 'OAUTH', handle: me.handle } })
    return backToAdmin('connected')
  } catch (error) {
    log('warn', 'figma oauth callback failed', { error })
    return backToAdmin(error instanceof HttpError && error.status === 429 ? 'rate_limited' : 'error')
  }
}

/** Personal access token fallback: validated with GET /v1/me before it is stored. */
export async function savePersonalToken(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'ADMIN')
    rateLimit(`figma-pat:${ctx.store.id}:${ctx.user.id}`, 10, 10 * 60_000)
    const body = await readJson(request)
    const token = text(body.token, 'token', 256, true)
    if (token.length < 20 || /\s/.test(token)) throw new HttpError(400, 'That does not look like a Figma personal access token')
    const me = await figmaMe({ type: 'PAT', token }).catch((error) => {
      if (error instanceof FigmaApiError && (error.status === 401 || error.status === 403)) throw new HttpError(400, 'Figma rejected this token. Check it has the current_user:read and file_content:read scopes and has not expired.')
      throw new HttpError(502, 'Could not reach Figma. Please try again.')
    })
    const conn = await saveConnection(ctx, { authType: 'PAT', me, accessToken: token, expiresAt: null, scopes: '', userId: ctx.user.id })
    await audit(ctx, request, { actorId: ctx.user.id, action: 'figma.connect', entityType: 'FigmaConnection', entityId: conn.id, diff: { authType: 'PAT', handle: me.handle } })
    return NextResponse.json({ connection: publicConnection(conn) }, { headers: noStore })
  } catch (error) { return failure(error) }
}

/** Deletes the stored tokens and the store's Figma webhooks. Imported designs and pages are kept. */
export async function disconnect(request: Request) {
  try {
    const ctx = await requireStoreRole(request, 'ADMIN')
    const conn = await ctx.db.figmaConnection.findFirst({})
    if (conn) {
      // Cancel the store's file webhooks in Figma while the token still works (best effort), then drop the tokens.
      const auth = await figmaAuth(ctx).catch(() => null)
      const webhooks = await deleteWebhooks(ctx, auth)
      await ctx.db.figmaConnection.deleteMany({ where: { id: conn.id } })
      await audit(ctx, request, { actorId: ctx.user.id, action: 'figma.disconnect', entityType: 'FigmaConnection', entityId: conn.id, diff: { authType: conn.authType, handle: conn.handle, webhooks } })
    }
    return NextResponse.json({ ok: true, revokeHelp: REVOKE_HELP }, { headers: noStore })
  } catch (error) { return failure(error) }
}
