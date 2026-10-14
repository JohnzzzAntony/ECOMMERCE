# Rollout: theme feature flag + stores (Phase 1)

## What changes
- New table `Store` and enum `DesignSource` (`FIGMA | THEME`). Migration `1_store` creates them and inserts the
  `legacy` store (`designSource = THEME`, `themesEnabled = null`) that owns all existing data.
- `FEATURE_THEMES` (env, default **off**) controls the theme system. `Store.themesEnabled` overrides it per store
  (`true`/`false`; `null` follows the env flag).
- When off for a store:
  - the admin sidebar hides **Themes**; the section renders a 404 state if reached;
  - `/api/admin/themes`, `/api/admin/themes/duplicate`, `/api/admin/themes/export`, `/api/admin/themes/revisions`
    answer `403 {"error":"Themes are disabled for this store"}`.
- Unchanged: all theme tables and code; the public storefront reads (`/api/theme`, `/api/theme-css/[id]`, the
  server-rendered theme on `/`). The storefront keeps rendering the active theme until a Figma design is published
  (Phase 10), so turning the flag off does not change what shoppers see.

## Migrations (first use of `prisma migrate` in this repo)
Until now the schema was applied with `prisma db push`. `0_init` is a **baseline** generated offline from
`prisma/schema.prisma` as of this phase (including the theme draft/revision columns from the in-progress theme work).

On each existing database (Neon branch first, production last):

```bash
# 1. Read-only drift check. Expected output: only the DesignSource/Store statements of 1_store.
bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
# 2. Mark the baseline as already applied (does not run its SQL).
bunx prisma migrate resolve --applied 0_init
# 3. Apply 1_store.
bun run db:deploy
```

If step 1 shows drift (e.g. the theme `draft`/`revision`/`report`/`sourceUrl` columns or `ThemeRevision` were never
pushed), run `bun run db:push` against that database **before** step 2, or apply the missing statements by hand.

New databases: `bun run db:deploy` runs both migrations.

From now on: change `schema.prisma`, then `bun run db:migrate` (dev branch) and commit the migration folder.
Don't use `db:push` against shared databases.

## Deploy order
1. Apply migrations (above). The new code throws if the `Store` table or the legacy row is missing.
2. Set `FEATURE_THEMES` in the deployment environment:
   - `true` to keep the theme admin available everywhere for now, or
   - leave unset to hide it (spec default), and enable per store with
     `UPDATE "Store" SET "themesEnabled" = true WHERE id = 'legacy';` where needed.
3. Deploy the app. Store lookups are cached in-process for up to 60 s; a restart applies flag changes immediately.

## Rollback
- Code: redeploy the previous build; the extra `Store` table is ignored by it.
- Data: `DROP TABLE "Store"; DROP TYPE "DesignSource";` and delete the `1_store` row from `_prisma_migrations`
  (only if nothing else references `Store` yet — later phases add foreign keys to it).

## Later migrations (Figma integration)

| Migration | Adds |
|---|---|
| `2_figma_connection` | `StoreMember` (backfilled from global roles), `FigmaConnection`, `FigmaOAuthState`, `AuditLog`; row level security |
| `3_design_imports` | `FigmaFile`, `DesignImport` |
| `4_design_pipeline` | pipeline/queue columns, `SectionMapping`, `DesignSystem`, `Font`, `Asset`, `StorePage`, `StorePageVersion`; RLS policies on every store table recreated with the system bypass |

All are additive. Apply with `bun run db:deploy`. The app must connect as a role **without** BYPASSRLS/SUPERUSER
for row level security to apply (the migrations themselves run fine as the owner).
