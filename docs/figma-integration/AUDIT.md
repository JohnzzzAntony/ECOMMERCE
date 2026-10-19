# Figma → NexEcoms: Codebase Audit (Step 0)

Audited 2026-10-13 against `main` @ `f2ea59f` plus the uncommitted working tree.

## 1. Current stack

| Area | Finding |
|---|---|
| Framework | Next.js `^16.1.1`, App Router, React 19, TypeScript (`strict: true`, but `noImplicitAny: false`), `output: "standalone"`, run with **Bun** (`bun .next/standalone/server.js`) behind Caddy. |
| Routing | App Router is used **only as a shell**: `src/app/page.tsx` (`/`) renders `<StorefrontApp/>`, a client-side SPA whose Zustand `view` picks the screen (home, products, product-detail, cart, page…). Custom pages are deep-linked as `/?page=<slug>`. `/admin` renders the client-side `<AdminView/>`. There are no per-URL storefront routes, no `generateMetadata`, no sitemap route. |
| API | `src/app/api/**/route.ts` are one-line re-exports of handlers in `src/backend/routes/**`. ESLint forbids `src/frontend` ↔ `src/backend` imports; shared shapes live in `src/shared`. |
| ORM / DB | Prisma, PostgreSQL on **Neon**. No `prisma/migrations` folder — schema is applied with `prisma db push`. `.env` `DATABASE_URL` points at the **production** Neon database. |
| Prisma versions | Uncommitted change moved `prisma` CLI to `^8.0.0-rc.22` (devDependency) while `@prisma/client` is `6.19.2`. CLI/client major mismatch; also a release candidate. |
| Auth / session | Custom: scrypt passwords, HMAC-signed cookie `commerce_session` (8 h), `requireUser` / `requireAdmin` / `adminGuard` in `src/backend/lib/auth.ts`. CSRF: `checkOrigin()` (Origin/Host + `Sec-Fetch-Site`) on every non-GET via `requireUser`. |
| Roles | `User.role` string: `customer | staff | admin`. Only `admin` passes `requireAdmin`. No per-store roles. |
| Tenancy | **None in the live schema.** Every table is global (`slug @unique` etc.). A draft multi-tenant schema exists at `docs/tenancy/schema.draft.prisma` (`Store`, `StoreMember`, `storeId @default("legacy")` on every table) but has not been applied; uniques are still global even in the draft. No hostname → store resolution, no middleware/proxy. |
| Job queue | None. No Redis. |
| Object storage | **Cloudinary** (`src/backend/integrations/cloudinary.ts`) for uploads and theme assets. No S3/R2. |
| Caching | In-process 60 s memo (`src/backend/lib/memo.ts`) with `invalidateAll()` on admin writes. No Redis, no Next cache tags. |
| Validation | Hand-written validators (`text()`, `parseFields()` allowlists, `cleanSections()` etc.). Zod is not a direct dependency (present transitively in `node_modules`). |
| UI | Tailwind v4, shadcn/ui (Radix), lucide, framer-motion, sonner. `@dnd-kit` present transitively only. |
| Theme system | `Theme`, `ThemeRevision`, `Page` (theme-owned or admin pages, HTML content, global `slug @unique`), `Menu`. Backend: `theme-package.ts`, `theme-store.ts`, `theme-adapters.ts`, `routes/admin/themes.ts`, `/api/admin/themes/{duplicate,export,revisions}`, public `/api/theme`, `/api/theme-css/[id]`. Admin: `views/admin/themes.tsx`, `visual-editor.tsx` (in-progress, uncommitted). The **active theme also drives storefront styling and homepage sections** — it cannot simply be switched off without a replacement renderer. |
| Tests | `bun test tests` (bun:test, Jest-style), handlers tested with a mocked `db`. Baseline: **43 pass / 0 fail**. `tsc --noEmit`: clean. No Vitest, MSW, Playwright, Lighthouse, axe. |
| CI | None (no `.github/`). |
| Secrets | `.env.example` exists (Neon, Cloudinary, Stripe, Resend, admin, `NEXTAUTH_*`). |
| Working tree | Uncommitted theme work in 11 files + new `theme-adapters.ts`, `scroll-stroke.tsx`, `themes/revisions` route, and a stray `package-lock.json` next to `bun.lock`. |

## 2. Conflicts with the spec

The spec assumes a multi-tenant platform with per-tenant RBAC, a job queue, S3 storage and a server-rendered,
route-per-page storefront. None of those exist. Each conflict below needs a decision before Phase 1.

### C1 — No tenancy model (blocking)
Spec: `Tenant`, `tenantId` on every table, RLS or a mandatory Prisma extension, hostname → tenant middleware,
cross-tenant isolation tests on every route.
Repo: single store; draft `Store` schema unapplied.

**Recommendation:** Treat the draft's `Store` as the spec's `Tenant` (keep the repo's name). Introduce the
tenancy foundation *only as far as this feature needs it*: `Store` + `StoreMember` tables, a seeded `legacy`
store owning all existing data, hostname/domain → store resolution, and `storeId` on **all new Figma/page tables**,
enforced by a Prisma client extension (`scopedDb(storeId)`) plus Postgres RLS on the new tables. Retrofitting
`storeId` onto the existing catalog/order tables is a separate migration (touches every existing route and
global unique constraint) and stays out of scope; catalog reads used by commerce sections go through the
legacy store until then. Tenant-isolation tests cover every new route.

### C2 — RBAC roles don't exist
Spec: OWNER / ADMIN / EDITOR / VIEWER per tenant. Repo: global `customer | staff | admin`.

**Recommendation:** `StoreMember.role` = `owner | admin | editor | viewer`. Backfill: each existing global
`admin` → `owner` of `legacy`, `staff` → `editor`. Existing `requireAdmin` stays unchanged for existing routes;
new routes use `requireStoreRole(request, minRole)`.

### C3 — Storefront is a client SPA, not route-per-page SSR
Spec Phase 10: server components per section, per-URL pages, `generateMetadata`, sitemap, JSON-LD, LCP-prioritized
images, Zod validation at render. Repo: `/` mounts one client app; product/cart are client views.

**Recommendation:** Add server-rendered routes under `src/app/(storefront)/` for Figma pages
(`/`, `/pages/[slug]`, `/products/[slug]`, `/collections/[slug]`, `/cart`) that are active only when the store's
`designSource = FIGMA` **and** a published HOME version exists; otherwise `/` keeps rendering today's SPA
(zero behaviour change until a design is published). Commerce sections reuse the existing catalog backend and
the Zustand cart as small client islands. Existing SPA views are untouched.

### C4 — No Redis / BullMQ
Spec: BullMQ jobs, Redis page cache. Repo: single Bun process, no Redis.

**Recommendation (pick one):**
- **(a) Add Redis + BullMQ** as specified: requires provisioning Redis (e.g. Upstash/Redis Cloud) and running a
  separate worker process (`bun scripts/design-worker.ts`) in deployment.
- **(b) Postgres-backed queue** (`DesignJob` table, `SELECT … FOR UPDATE SKIP LOCKED`, same idempotent
  stage-by-stage state machine), no new infrastructure; worker runs in-process or as the same separate script.
  Page cache stays the existing in-process memo + Next `revalidateTag`.
I recommend **(b)** for the current single-instance deployment; the pipeline code is written against a small
`enqueue/claim/complete` interface so moving to BullMQ later is a one-file change.

### C5 — Storage is Cloudinary, not S3
Spec: S3-compatible storage, sharp AVIF/WebP variants, `tenants/{tenantId}/assets/{hash}.{ext}`,
gzipped raw/IR snapshots.

**Recommendation (pick one):**
- **(a) Keep Cloudinary** (existing): assets uploaded with public_id `tenants/{storeId}/assets/{hash}`; sharp still
  sanitizes/strips metadata and computes hash, size and blurhash; Cloudinary serves AVIF/WebP at responsive widths
  via `f_auto,w_*`. Snapshots stored as Cloudinary `raw` resources (private/authenticated delivery).
- **(b) Add R2/S3** via AWS SDK v3 as specified: new bucket + credentials; sharp generates the variants.
I recommend **(a)**: it adopts the existing stack, and Cloudinary already does format/width negotiation.

### C6 — `Page` name collision
Spec `Page(…, unique(tenantId, slug))` vs existing theme `Page` (HTML content, global unique slug).

**Recommendation:** Keep the theme `Page` untouched; new models are `StorePage` / `StorePageVersion`
(mapped to `store_pages` / `store_page_versions`).

### C7 — Test tooling
Spec: Vitest, MSW, Playwright, Lighthouse CI, axe, pixelmatch. Repo: `bun test`, no CI.

**Recommendation:** Keep `bun test` for unit + integration (MSW's `setupServer` works under Bun) so there is one
runner; add Playwright (+ `@axe-core/playwright`, pixelmatch) for E2E/visual/a11y and `@lhci/cli` config,
plus a GitHub Actions workflow to run them. Vitest would duplicate the existing runner.

### C8 — Database safety (blocking for any schema work)
`.env` targets the production Neon DB and there are no migrations. The spec asks for migrations + seed.

**Recommendation:** (1) Point local `.env` at a Neon **branch** for this work. (2) Create a baseline migration
from the current schema (`prisma migrate diff --from-empty`, marked applied in prod with `migrate resolve`),
then add real migrations from here on. Nothing is pushed to production without your explicit go-ahead.

### C9 — Prisma version mismatch + uncommitted work
CLI `8.0.0-rc.22` vs client `6.19.2`; theme work and `package-lock.json` uncommitted. Phase 1 touches the
same theme files.

**Recommendation:** Revert the CLI to `^6.19.x` (match the client), delete `package-lock.json` (repo uses Bun),
and commit or stash the in-progress theme work before Phase 1 starts.

### C10 — External prerequisites you must provide
- A Figma OAuth app (client id/secret, redirect URI) — documented in `FIGMA-APP-SETUP.md` in Phase 2.
- A token-encryption key (`FIGMA_TOKEN_KEYS`, 32-byte base64, versioned).
- If C4(a)/C5(b) chosen: Redis URL / bucket credentials.
- Webhooks (Phase 11) need a publicly reachable HTTPS URL for testing.

## Decisions (confirmed 2026-10-13)

| Conflict | Decision |
|---|---|
| C1 Tenancy | `Store` + `StoreMember` + seeded `legacy` store; `storeId` + RLS + scoped Prisma extension on **new tables only**. Existing tables unchanged. |
| C2 RBAC | `StoreMember.role` = owner/admin/editor/viewer; backfill admin→owner, staff→editor. |
| C3 Storefront | New SSR routes in `src/app/(storefront)/`, active only with `designSource=FIGMA` + published HOME; SPA otherwise. |
| C4 Queue | Postgres-backed queue (`SKIP LOCKED`). |
| C5 Storage | Cloudinary. |
| C6 Page | New `StorePage` / `StorePageVersion`; theme `Page` untouched. |
| C7 Tests | `bun test` + MSW; Playwright/axe/pixelmatch/LHCI added; GitHub Actions workflow. |
| C8 DB | Local `.env` → Neon branch (owner action); baseline migration, then `prisma migrate`. |
| C9 Housekeeping | Prisma CLI back to `^6.19.x`; `package-lock.json` removed; theme WIP committed/stashed by owner before Phase 1. |

### Implementation decisions (Phases 4–11)

| Topic | Decision |
|---|---|
| Global sections | `GlobalSections` is modelled as `StorePage` rows of type HEADER / FOOTER / ANNOUNCEMENT with reserved slugs, so they share drafts, versions, publish and rollback. |
| Worker | In-process after each request (`after()`), plus optional `bun run design:worker`; both use the same `SKIP LOCKED` claim. |
| Cache | In-process memo keyed `tenant:{id}:page:{slug}:v{versionId}`, cleared on publish (no Redis per C4). |
| Middleware | No Next.js middleware: hosts resolve through the cached `storeForHost()` (custom domain → `<slug>.PLATFORM_DOMAIN` → legacy). |
| Assets | sharp strips metadata and normalises; Cloudinary `f_auto,w_*` serves AVIF/WebP widths (C5). Blurhash stored. |
| Rich text | Structured runs only (no HTML anywhere); editor uses a small markup syntax. |
| Catalog | Commerce sections read the existing (global) catalog — non-legacy stores share it until the catalog is made multi-tenant (C1). |
| CSP | Applied to Figma storefront routes and previews; `/` (shared with the theme storefront) keeps its previous headers. |
| Test runner | `bun test` (unit + MSW integration), real PostgreSQL via `embedded-postgres` for RLS/worker tests, Playwright + axe + pixelmatch for E2E, Lighthouse CI config. |
| Fidelity | Per-page layout `exact` (default for HOME/PAGE/HEADER/FOOTER) keeps the whole frame as one freeform section with device trees, scaled with `--u` (CSS px per Figma px, from container query units). Figma scrolling frames, fixed/sticky layers and "Change to" variant interactions (smart animate via FLIP + Web Animations, springs sampled to `linear()`) are rendered; variants are fetched with `/nodes` during FETCHING. `sections` keeps the template mapping. |

## 3. How the feature fits

```
src/backend/lib/figma/            client.ts (rate-limit, 429/Retry-After, backoff), url.ts, oauth.ts, crypto.ts
src/backend/lib/design-import/    pipeline.ts, queue.ts, ir.ts, tokens.ts, mapping.ts, assets.ts, diff.ts
src/backend/lib/tenancy.ts        resolveStore(host), requireStoreRole(), scopedDb(storeId)
src/backend/routes/design/**      admin API (connection, files, imports, pages, design system, assets)
src/shared/sections/              registry metadata + Zod schemas (shared by admin forms and renderer)
src/frontend/components/sections/ section React components
src/frontend/views/admin/design/  connect, picker, review, page editor (inside existing AdminView shell)
src/app/(storefront)/             server-rendered Figma pages (C3)
src/app/api/design/**             one-line route re-exports (existing convention)
```

Folder names follow the repo's `backend / frontend / shared` split rather than the spec's `lib/…` paths;
the module boundaries are the same.

Theme hiding (Phase 1) is a flag check in four places — admin nav, admin section render, theme API handlers,
public theme reads stay working (storefront styling still depends on the built-in theme until a Figma design
is published).
