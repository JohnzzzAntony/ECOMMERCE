# Figma app setup

NexEcoms connects each store to the store's own Figma account. Two ways:

1. **Sign in with Figma (OAuth 2)** — needs a Figma OAuth app registered once for the platform (this page).
2. **Personal access token** — no app needed; the store admin pastes a token. Works even if OAuth is not configured.

Details below were checked on 2026-10-13 against Figma's developer docs:
[OAuth apps](https://developers.figma.com/docs/rest-api/oauth-apps/),
[scopes](https://developers.figma.com/docs/rest-api/scopes/),
[personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/).
Re-check them when Figma announces API changes.

## 1. Create the OAuth app

1. Sign in to Figma with the account that should own the app (a platform/team account, not a personal one).
2. Open <https://www.figma.com/developers/apps> → **Create a new app**.
3. Name: `NexEcoms`; add the logo and website.
4. **Redirect URLs** — add one per environment, exactly (scheme, host, path; no trailing slash):
   - `https://<production-host>/api/design/figma/oauth/callback`
   - `https://<staging-host>/api/design/figma/oauth/callback`
   - `http://localhost:3000/api/design/figma/oauth/callback` (development)
5. **Scopes** — enable exactly these:

   | Scope | Used for |
   |---|---|
   | `current_user:read` | `GET /v1/me` — show which Figma account is connected |
   | `file_content:read` | file structure, nodes and image renders for import |
   | `file_metadata:read` | file version / last-modified checks for re-sync |
   | `folders:read` | browse a team's projects and files (`/v2/teams/:id/folders`); replaces the deprecated `projects:read` |
   | `webhooks:write` | create and delete file-update webhooks for re-sync |

   Do not enable the deprecated `files:read`.
6. Copy the **client ID** and **client secret**.
7. If the app should be usable by accounts outside your Figma organization, submit it for publishing in the app
   settings. Until then only members of the app's organization can authorize it.

## 2. Configure the server

```bash
FIGMA_CLIENT_ID=...
FIGMA_CLIENT_SECRET=...
FIGMA_REDIRECT_URI=https://<this-host>/api/design/figma/oauth/callback   # must match step 4 exactly
FIGMA_TOKEN_KEYS=1:<base64 of 32 random bytes>
```

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store these in the deployment's secret manager, never in git. `FIGMA_TOKEN_KEYS` is required for both OAuth and
personal tokens; without `FIGMA_CLIENT_*` the admin page offers personal access tokens only.

### Rotating the token encryption key

1. Append a new version: `FIGMA_TOKEN_KEYS=1:<old>,2:<new>` and deploy. New and refreshed tokens use version 2;
   version 1 values still decrypt.
2. Tokens are re-encrypted on every refresh or reconnect. Once no `FigmaConnection.keyVersion = 1` rows remain
   (`SELECT count(*) … WHERE "keyVersion" = 1` with RLS bypassed), remove `1:<old>`.

## 3. How the flow works

1. An OWNER/ADMIN clicks **Connect with Figma** (admin → Design → Figma). `POST /api/design/figma/oauth/start`
   stores a pending state (SHA-256 of a 256-bit random value, PKCE verifier, store, user, session hash,
   10-minute expiry) and returns the authorize URL:
   `https://www.figma.com/oauth?client_id&redirect_uri&scope&state&response_type=code&code_challenge&code_challenge_method=S256`.
2. Figma redirects to `/api/design/figma/oauth/callback?code&state`. The server checks the state is unused,
   unexpired, created by the same user in the same browser session for the same store, deletes it, then exchanges
   the code (`POST https://api.figma.com/v1/oauth/token`, client credentials via HTTP Basic, `code_verifier`)
   within Figma's 30-second code lifetime.
3. Tokens are envelope-encrypted (AES-256-GCM, per-value data key, store-bound) and saved. The browser only ever
   sees the account handle/email and status.
4. Access tokens last 90 days. Five minutes before expiry the server refreshes
   (`POST https://api.figma.com/v1/oauth/refresh`). If Figma rejects the refresh, the connection is marked
   **Reconnect needed**, an audit entry is written and owners/admins get an email.

## 4. Personal access tokens

In Figma: **Settings → Security → Personal access tokens → Generate new token**, with at least
`current_user:read`, `file_content:read` and `file_metadata:read` (add `webhooks:write` for automatic re-sync).
NexEcoms validates the token with `GET /v1/me` before saving. Figma does not report a PAT's expiry; when it
expires, imports fail with "Figma rejected" and the admin pastes a new one.

## 5. Disconnecting and revoking

**Disconnect** deletes the stored tokens (installed pages stay). It cannot revoke access on Figma's side: the
user should also open Figma **Settings → Security** and remove NexEcoms from connected apps, or revoke the
personal access token there.

## 6. Webhooks (Phase 11)

Re-sync uses Figma webhooks v2 (`FILE_VERSION_UPDATE`) at `https://<host>/api/design/figma/webhooks`; the endpoint
must be publicly reachable over HTTPS. Setup details are added in Phase 11.
