// Figma OAuth 2 (authorization code + PKCE S256).
// Endpoints, parameters and response fields verified 2026-10-13 against
// https://developers.figma.com/docs/rest-api/oauth-apps/ and scopes against
// https://developers.figma.com/docs/rest-api/scopes/ :
//  - authorize: GET https://www.figma.com/oauth?client_id&redirect_uri&scope&state&response_type=code&code_challenge&code_challenge_method=S256
//  - token:     POST https://api.figma.com/v1/oauth/token   (form body, client credentials via HTTP Basic)
//  - refresh:   POST https://api.figma.com/v1/oauth/refresh (same; response has no new refresh_token)
//  - access tokens last 90 days by default; codes expire after 30 s.
import { createHash, randomBytes } from 'node:crypto'
import { FIGMA_API } from './client'

// current_user:read → GET /v1/me; file_content:read → files, nodes, images; file_metadata:read → file meta /
// version polling; folders:read → team folders/files browsing (replaces deprecated projects:read);
// webhooks:write → re-sync webhooks.
export const FIGMA_SCOPES = ['current_user:read', 'file_content:read', 'file_metadata:read', 'folders:read', 'webhooks:write']

export type OAuthConfig = { clientId: string; clientSecret: string; redirectUri: string }

export function oauthConfig(): OAuthConfig | null {
  const clientId = process.env.FIGMA_CLIENT_ID, clientSecret = process.env.FIGMA_CLIENT_SECRET, redirectUri = process.env.FIGMA_REDIRECT_URI
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null
}

export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url')

export function authorizeUrl(config: OAuthConfig, state: string, codeVerifier: string) {
  const url = new URL((process.env.NODE_ENV !== 'production' && process.env.FIGMA_OAUTH_URL) || 'https://www.figma.com/oauth') // override: E2E mock only
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: FIGMA_SCOPES.join(' '),
    state,
    response_type: 'code',
    code_challenge: sha256(codeVerifier),
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

export type TokenResponse = { access_token: string; token_type: string; expires_in: number; refresh_token?: string; user_id_string?: string }

export class OAuthError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function tokenRequest(path: string, config: OAuthConfig, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => { throw new OAuthError(0, 'Could not reach Figma') })
  const data = await res.json().catch(() => null)
  if (!res.ok || typeof data?.access_token !== 'string' || !Number.isFinite(data?.expires_in)) {
    throw new OAuthError(res.status, `Figma token request failed (${res.status})`)
  }
  return data
}

export function exchangeCode(config: OAuthConfig, code: string, codeVerifier: string) {
  return tokenRequest('/v1/oauth/token', config, { redirect_uri: config.redirectUri, code, grant_type: 'authorization_code', code_verifier: codeVerifier })
}

export function refreshAccessToken(config: OAuthConfig, refreshToken: string) {
  return tokenRequest('/v1/oauth/refresh', config, { refresh_token: refreshToken })
}
