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
| `Waiting: Figma rate limit reached; retry in N min` | Figma answered 429 with a long `Retry-After` (low-limit View/Collab seats get hours or days) while downloading the file | The job resumes by itself after that time. To import now, connect an account with a Full or Dev seat |
| `ASSET_FAILED … could not be copied: Figma rate limit reached` | Same, while copying images/icons: the import still reaches review | Later, *Rebuild pages* copies the missing images |

3. **Rebuild pages** (review → *Pages and layout*): re-pairs frames per device, changes page types or the layout
   (exact / editable sections). It re-runs normalize → mapping → assets from the stored snapshot (`POST
   /api/design/imports/:id/plan`) without downloading the file again; only images not yet copied are fetched.
   Section changes made in review are reset.
4. **Retry** a failed import from the review screen (`POST /api/design/imports/:id/retry`). Finished stages are
   skipped: it resumes from the first missing output.
5. Stuck in a running state for > 10 minutes with no worker logs: ensure the web server is receiving traffic or run
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

## Token and link workflow

1. Admin → Figma: save a personal access token with `current_user:read`, `file_content:read`, and `file_metadata:read`.
2. Admin → Import design: paste the file or prototype link and open it. Select individual frames, all frames on a page, all file frames, or a prototype flow.
3. Check the automatically paired device frames and page types. Home/content/global pages default to **Exact Figma design**; commerce templates default to live editable sections. Choose the home page explicitly if the frame names do not identify one.
4. Queue import opens progress and review automatically. Inspect desktop/mobile previews and warnings, then install drafts.
5. Store pages: edit text, images (including SVG/vector replacements), links, and commerce settings; resolve the publishing checklist and publish. The store must use the FIGMA design source and have a published home page to switch the storefront.

New imports through the API receive the same layout defaults as the picker. Existing saved imports retain their chosen layout. Frame data, component variants, SVG exports and review renders use the captured Figma version, so later edits cannot mix those parts of the import. Figma's image-fill endpoint supplies fresh URLs for the image references from that snapshot.

Prototype navigation between imported page frames is converted to storefront links, including links in mobile/tablet trees and component variants. A destination frame must be included in the import; product/collection destinations still need a real catalog item selected in the editor.

This imports into the existing page renderer and backend. It does not infer new business logic from a visual mockup. Missing assets, unavailable fonts, unsupported prototype behavior, and catalog bindings must be reviewed before publishing. Cloudinary, token encryption, database migrations and the worker remain deployment prerequisites described above.

Figma version parameters: https://developers.figma.com/docs/rest-api/file-endpoints/
