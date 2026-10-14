# Runbook: Figma design imports

Logs are JSON lines (`src/backend/lib/log.ts`) with tokens, codes and passcodes redacted. Useful messages:
`design import stage failed`, `design asset failed`, `figma request retry`, `figma token refresh failed`,
`figma connection needs re-authorization`, `figma webhook registration failed; using polling`,
`skipping invalid section`.

## Where things run

- Jobs are rows in `DesignImport` (status `QUEUED…ASSETS` = runnable). The web server processes them after
  requests (`after()`); `bun run design:worker` runs a dedicated worker (safe to run several — jobs are claimed
  with `FOR UPDATE SKIP LOCKED`). A claimed job is locked for 10 minutes; a crashed worker's job is picked up again
  after that.
- Snapshots: `tenants/{storeId}/figma/{fileKey}/{importId}.json.gz` (raw) and `.ir.json.gz` (IR), private in
  Cloudinary. Assets: `tenants/{storeId}/assets/{hash}`.

## An import is stuck or failed

1. Admin → Design → Import design → **Open** the import: it shows the stage, attempts and the last error.
2. Common errors:

| Error | Cause | Fix |
|---|---|---|
| `Connect a Figma account first` / `Figma access expired` | No connection, or refresh rejected | Reconnect in Admin → Figma, then **Retry** |
| `The connected Figma account cannot open this file` (403) | Account lacks access or token scopes | Share the file with the account / create a token with `file_content:read` |
| `Frames no longer exist in the Figma file` | Frames deleted/renamed in Figma after selection | Start a new import |
| `Figma is rate limiting requests` / repeated `figma request retry` | Plan's Tier‑1 limit (10–20/min) | Wait; the job retries with backoff. Large imports: select fewer frames per import |
| `Retrying: …` | Transient error | Nothing; retries up to 5 times (30 s → 15 min backoff) |

3. **Retry** a failed import from the review screen (`POST /api/design/imports/:id/retry`). Finished stages are
   skipped: it resumes from the first missing output.
4. Stuck in a running state for > 10 minutes with no worker logs: ensure the web server is receiving traffic or run
   `bun run design:worker`. To force a re-claim: `UPDATE "DesignImport" SET "lockedAt" = NULL WHERE id = '…'` (run
   with `SET app.bypass_rls = 'on'` or as the table owner).

## Assets

- `ASSET_FAILED` warnings: the image couldn't be downloaded (expired URL, blocked host, too large > 25 MB,
  unrecognised format). Choose a replacement in the editor. Allowed hosts are in `FIGMA_ASSET_HOSTS`
  (`src/backend/lib/design-import/assets.ts`); if Figma starts serving from a new host, add it there after
  verifying it belongs to Figma.
- Duplicate images are stored once per store (content hash).

## Token re-auth

- OAuth tokens refresh automatically 5 minutes before expiry. If Figma rejects the refresh, the connection becomes
  **Reconnect needed**, an audit entry `figma.reauth_required` is written and owners/admins are emailed.
- Fix: Admin → Figma → **Reconnect with Figma** (or paste a new personal access token). Installed pages keep
  working; only imports and re-syncs pause.
- `Figma token key version N is not configured`: `FIGMA_TOKEN_KEYS` lost a key that still encrypts tokens. Restore
  it (see FIGMA-APP-SETUP.md → rotation) or have the store reconnect.
- `FIGMA_TOKEN_KEYS is not configured / invalid` (503): set `FIGMA_TOKEN_KEYS=1:<base64 of 32 bytes>` and restart.

## Re-sync

- "Updates available" comes from webhooks (`FILE_VERSION_UPDATE`) or polling (`/v1/files/:key/meta`, every
  15 minutes per file, triggered by admin visits and the worker).
- No updates showing:
  - Webhooks need `NEXT_PUBLIC_SITE_URL` on HTTPS and `webhooks:write`; check logs for
    `figma webhook registration failed; using polling`. Polling still works.
  - Webhook calls rejected with 401: the passcode/hash doesn't match (file re-imported in another store, or the
    webhook was recreated). Clear `webhookId` on the `FigmaFile` row; the next install registers a new one.
- Re-sync never overwrites edits: changed fields listed in a section's `overriddenFields` are kept unless the
  admin ticks “replace with the Figma value”. The result is a new **draft**; publish it as usual.
- Disconnecting deletes the store's webhooks in Figma and the stored tokens; pages stay.

## Storefront

- A page renders only when the store's `designSource` is `FIGMA` and it has a published home page; otherwise `/`
  shows the theme storefront.
- A section that fails validation is skipped and logged (`skipping invalid section`); fix it in the editor and
  republish.
- Cache: published pages are cached in process and cleared on publish. After direct database edits restart the
  server or publish any page.

## Database tests

`bun run test-db` starts a throwaway PostgreSQL (`.test-db/`), applies migrations and keeps running; then
`TEST_DATABASE_URL=postgresql://app:app@127.0.0.1:54329/nexecoms_test bun run test:db`, and for E2E also
`TEST_DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:54329/nexecoms_test bun run test:e2e`.
