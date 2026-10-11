# Production cleanup report — 2026-10-10

> **Note:** Written before the frontend/backend restructure. File paths below use the old layout (`src/lib/*`, `src/app/api/**`, `src/components/*`); see the root `README.md` for the current map. Since then, admin APIs require a server session and passwords use scrypt, so the first two Critical findings are resolved. The other findings still apply.

## Outcome

Behavior-preserving cleanup completed for verified unused scaffolding and safe refactor targets. This is **not a production security sign-off**. Authentication, authorization, payment validation, deployment, and dependency vulnerabilities remain release blockers. Existing user changes were preserved; no database migrations, seeds, customer writes, emails, payments, commits, or deployments were performed.

## Application map

- Next.js App Router hosts `/`, `/admin`, and API route handlers. The storefront switches views through a persisted Zustand store rather than URL routes.
- Client views call `src/lib/api.ts` and direct fetches. The cart submits enquiries; order and Stripe routes exist separately and were retained.
- Prisma targets PostgreSQL. The repository also contains a legacy SQLite database and shell deployment scripts that still expect SQLite.
- Authentication currently compares plaintext passwords and returns a user object persisted in browser storage. There is no server session enforcing access to protected handlers.
- Stripe handles checkout and signed webhooks; Cloudinary handles uploads; Resend handles notifications.
- Tailwind v4 uses `globals.css` and PostCSS. The older Tailwind config was retained after automated review rejected its deletion.
- No pre-existing test script, test suite, or CI workflow was found. Nine focused regression tests were added.

## 1. Files removed

28 files: 25 unreachable UI/hook files, the orphaned scroll-area wrapper, and two disconnected websocket examples. Exact paths are in `removed-files.json`. TypeScript import reachability and repository reference scans verified removal candidates; there were no computed module loaders. Recoverable copies were saved outside the repository in this chat's visualization directory. Pre-existing user deletions of QA screenshots and an older spreadsheet are not counted.

## 2. Dead code removed

21 unused import bindings, the unused CartState interface, unused ESLint path variables, unused header/admin state selections, an unused contact-result binding (the database write remains), and an unused catch binding. The final source import graph has no unreachable source modules. This does not prove every exported member is used; uncertain API/service exports were retained.

## 3. Dependencies

39 unused direct dependencies removed; exact names are in `removed-dependencies.json`. Bun lockfile regenerated. Declared `exceljs` in devDependencies because the retained Excel importer already imports it. Lockfile package entries decreased from 955 to 760. Retained direct dependency versions were not upgraded. Some transitive packages changed hoisting locations/versions as the dependency tree shrank.

## 4. Refactoring

- Identical admin product/blog slug generators share `src/lib/slug.ts`.
- Corrected response types for category parents, order shipping addresses, and nullable order phone numbers.
- Corrected search button event wiring and string query limit.
- Preserved Stripe's `2025-05-28.basil` request version using its typed per-request option.
- Added portable standalone asset copying in `scripts/copy-standalone.mjs`.
- Removed `ignoreBuildErrors`; production builds now run TypeScript checks.
- Set explicit Next.js build/tracing roots after discovery selected an unrelated parent lockfile.
- Added repeatable `typecheck` and `test` scripts.

## 5. Performance

- Review rating updates retrieve sum/count aggregates instead of loading all approved review records. Existing rounding and response behavior are tested.
- Reused Intl number formatters rather than allocating one for each formatted price/count.
- Production Prisma clients no longer emit every SQL query; error logging remains.
- Removed unused UI modules, imports, and dependency trees. No claim is made about measured bundle-size or latency improvements.

## 6. Security findings requiring remediation before release

| Priority | Finding | Location / required work |
| --- | --- | --- |
| Critical | Admin APIs lack server-side authentication and role checks. Browser-local role checks can be bypassed. | `src/app/api/admin/**`, gallery/slider write handlers. Implement server sessions and authorization consistently. |
| Critical | Passwords are stored and compared as plaintext; seed/import scripts include default credentials. | `api/auth/login`, `api/auth/register`, Prisma scripts. Plan password migration/reset and remove defaults. |
| Critical | `.env` is already tracked by Git. | Remove from version control while preserving required local configuration, rotate exposed credentials, and review repository history/access. Values were never included in this report. |
| High | Customer information and mutations lack ownership checks. | Orders/enquiries listings, orders by email, tracking with optional email, profile update by caller-supplied ID. |
| High | Order values trust caller-supplied unit prices and quantities. | `api/orders`; recompute against the catalog and validate quantities server-side. |
| High | Payment completion lacks replay/idempotency protections and sufficient payment-state/amount checks. | Stripe webhook/checkout. Test retries, asynchronous payments, ownership, and totals before rollout. Signature verification exists and was retained. |
| High | Uploads have no authorization, size/type limits, or folder allowlist. | `api/admin/upload`. |
| High | User strings are interpolated into email HTML without escaping. | `src/lib/resend.ts`. |
| High | Reverse proxy forwards a caller-selected port on localhost. | Caddyfile `XTransformPort` rule; confirm intended deployment exposure and constrain it. |
| Review | Pagination is unbounded, request bodies have limited validation, admin updates accept arbitrary fields, and public settings return every stored key. | Validate contracts and apply explicit allowlists/rate limits. |
| Review | Dependency audit reports vulnerabilities across 21 package names. | See `dependency-audit.json`: 93 advisory entries (2 critical, 53 high, 33 moderate, 5 low). Entries can repeat advisories across version ranges; these are not 93 demonstrated application exploits. Critical entries affect Next.js. Upgrade and retest in a dedicated security remediation pass. |

No raw SQL construction was found in application handlers. Prisma use alone does not establish that the application is secure. Broad authentication/payment changes were not folded into a cleanup intended to preserve existing business logic.

## 7. Validation

- Baseline: nine TypeScript errors; configured lint passed. Existing lint disables many checks, so a clean result is limited evidence.
- Added regression tests: five slug cases, formatting compatibility, sale-price compatibility, review aggregate/response behavior, and invalid-review rejection. Database operations are mocked.
- Public HTTP smoke checks: storefront, admin login page, products, categories, brands, collections, settings, slider, blog, gallery, testimonials, and clients returned 200. No protected/customer records were fetched.
- Prisma schema validation passed without changing the database.
- Final typecheck and lint exited 0; nine tests passed. The scan of 104 source files found no broken local imports or circular dependencies and no unreachable source modules. Review of removed dependencies found no remaining source/config/script references. Whitespace diff checks passed.
- Local desktop screenshot captured. Embedded browser automation timed out; headless Chrome provided the visual check. No complete interactive end-to-end checkout/admin workflow was run.
- External payment, email, upload, authentication migration, and deployment integration checks remain manual.

## 8. Production build

The final production build passed compilation, TypeScript checks (including the new tests), generation of 36 pages, and standalone asset packaging. The final built server is the local preview.

## 9. Remaining technical debt

- Admin view is about 3,000 lines; homepage and product detail exceed 1,000 lines. Splitting them safely needs UI coverage.
- Broad Zustand subscriptions, repeated taxonomy requests, full-catalog fetches for wishlist/compare/recently viewed, and search request races remain.
- Existing lint suppressions, broad `any` types, and absent comprehensive integration/UI tests remain.
- Category-plus-search filters overwrite the same OR field; multi-brand filtering fetches only the first selected brand. These business-behavior issues were not silently changed.
- Product/post share URLs and the SPA navigation model need review.
- Legacy deployment scripts assume SQLite and can print the database URL. They were retained because deployment intent is unclear; do not use them for PostgreSQL production unchanged.
- Legacy database, import scripts, agent notes, tool-result archives, screenshot assets, and import spreadsheets were retained where operational/historical usage could not be ruled out.
- Mounted legacy toast infrastructure and uncalled payment/service helpers were retained rather than assuming planned integrations are obsolete.

## 10. Preview and manual review

Preview: `http://127.0.0.1:3000` (local machine only). Public APIs confirm catalog data exists. Settings, slider, blog, gallery, testimonials, and client-logo collections are empty; the homepage hero consequently renders its existing placeholder. Populate these through the intended content workflow; no seed data was invented.

Review security blockers and dependency advisories before deployment. Automatic approval review rejected deletion of `tailwind.config.ts` because tooling could auto-discover it; that file and `tailwindcss-animate` remain. An earlier bulk cleanup was rejected; the work was subsequently narrowed and independently verified. Removing the retained config requires additional evidence or explicit manual approval.
