# NexEcoms — Medical Equipment Store

E-commerce site for medical equipment (UAE): public storefront, customer accounts, enquiries/quotes,
Stripe checkout, and an admin panel. One Next.js 16 app, with **frontend and backend code kept in
separate folders** and a lint rule that stops them importing each other.

## Quick start

```bash
bun install
bun run db:generate        # generate the Prisma client
bun run dev                # http://localhost:3000   (admin: /admin)
```

Other scripts: `bun run typecheck`, `bun run lint`, `bun test tests`, `bun run build`, `bun run start`.

### Admin accounts

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-password' bun run admin:create
```

Creates the admin, or resets the password of an existing one. Passwords are stored as scrypt hashes.
Pass the credentials on the command line. Don't commit them to `.env`.

## Folder structure

```
src/
├── app/                      ROUTING ONLY: Next.js maps URLs to files here. Keep these files tiny.
│   ├── layout.tsx            <html>, fonts, SEO metadata, toasters
│   ├── page.tsx              "/"      → <StorefrontApp/>
│   ├── admin/page.tsx        "/admin" → <AdminView/>
│   ├── globals.css           Tailwind v4 theme + brand colours
│   └── api/**/route.ts       One line each: re-exports handlers from src/backend/routes
│
├── frontend/                 Everything that runs in the BROWSER
│   ├── storefront-app.tsx    Storefront shell: header/footer + picks the view from the store
│   ├── views/                One file per storefront screen (home, products, product-detail, cart…)
│   │   └── admin/            Admin panel: index.tsx (session check, login, sidebar), one file per
│   │                         section, crud-section.tsx (config-driven list/form), admin-api.ts
│   ├── components/
│   │   ├── ui/               shadcn/ui primitives (button, dialog, table…). Don't put business logic here.
│   │   ├── layout/           header, footer, notification bell, WhatsApp button, back-to-top
│   │   ├── product/          product card, quick view, compare bar, ratings, countdown
│   │   └── cart/             cart drawer
│   ├── store/use-store.ts    Zustand global state (current view, cart, wishlist, compare, user, language)
│   ├── lib/api.ts            Typed HTTP client: the ONLY way the frontend talks to the backend
│   ├── lib/format.ts         Price/number/date formatting (AED)
│   ├── lib/utils.ts          cn() Tailwind class helper
│   └── hooks/use-toast.ts
│
├── backend/                  Everything that runs on the SERVER (DB access, secrets, payments)
│   ├── routes/               HTTP handlers grouped by domain (see API map below)
│   │   ├── catalog/          products, categories, brands, collections, reviews
│   │   ├── content/          blog, slider, gallery, testimonials, client logos, site settings
│   │   ├── orders/           orders, tracking, Stripe checkout + webhook
│   │   ├── messages/         contact form, enquiries (quotes), newsletter signup
│   │   ├── auth/             login, logout, register, session, profile
│   │   └── admin/            admin dashboard, analytics and CRUD (all require an admin session)
│   ├── lib/
│   │   ├── db.ts             Prisma client singleton
│   │   ├── auth.ts           Session cookie, requireUser/requireAdmin/adminGuard, CSRF origin check,
│   │   │                     input validators (text, emailAddress), failure() error→HTTP mapper
│   │   ├── admin-resource.ts parseFields() allowlist validation + adminResource() CRUD factory
│   │   ├── product-sheet.ts  Catalogue import/export: column map, matching (ID→SKU→Slug→Name), diff, apply
│   │   ├── spreadsheet.ts    .xlsx (exceljs) / .csv read & write
│   │   ├── password.ts       scrypt hashing, HMAC-signed session tokens
│   │   └── slug.ts           slugify()
│   └── integrations/         Third-party services: stripe.ts, cloudinary.ts (uploads), resend.ts (email)
│
└── shared/types.ts           Data shapes returned by the API (Product, Order, User…). Both sides may import.

prisma/        schema.prisma (PostgreSQL) + seed/import scripts (seed.ts, import-excel.ts…)
scripts/       create-admin.ts, copy-standalone.mjs (build step)
tests/         bun tests (backend handlers with a mocked DB, auth origin check, formatting)
public/        static files (logo, robots.txt)
docs/          cleanup/security report, dependency audit, multi-tenancy schema draft
```

### Boundary rule (enforced by `bun run lint`)

| Code in…        | may import                        | must NOT import |
| --------------- | --------------------------------- | --------------- |
| `src/frontend`  | `@/frontend/*`, `@/shared/*`      | `@/backend/*` (DB/secrets would leak into the browser bundle) |
| `src/backend`   | `@/backend/*`, `@/shared/*`       | `@/frontend/*` |
| `src/app`       | both. It only wires them together | |

## How a request flows

```
Browser view (src/frontend/views/products-view.tsx)
   └─ api.products({ category })               src/frontend/lib/api.ts
        └─ GET /api/products?category=…         HTTP
             └─ src/app/api/products/route.ts   export { GET } from '@/backend/routes/catalog/products'
                  └─ GET handler                src/backend/routes/catalog/products.ts
                       └─ db.product.findMany   Prisma → PostgreSQL (DATABASE_URL)
```

### Frontend navigation

The storefront is a single page. Instead of URL routes, `useStore().navigate('product-detail', { slug })`
sets `view` + `params` in the Zustand store. `storefront-app.tsx` switches on `view` to render the right
file from `views/`. Cart, wishlist, compare list, language (EN/AR, RTL) and the logged-in user persist in
localStorage. The admin panel is a separate page at `/admin`.

### Authentication

1. `POST /api/auth/login` checks the scrypt hash and sets an `httpOnly` cookie `commerce_session`
   (HMAC-signed with `NEXTAUTH_SECRET`/`AUTH_SECRET`, lasts 8 hours).
2. Protected handlers call `adminGuard(request)` or `requireUser(request)` from `backend/lib/auth.ts`.
   These re-read the user from the DB, so deactivating a user or changing their password ends their sessions at once.
3. Every POST/PUT/DELETE goes through `checkOrigin` (CSRF protection: the browser's `Origin` must match the `Host`).
4. The frontend stores the returned user only to decide what to show. The server never trusts that copy.

## API map

| Endpoint | Methods | Handler (`src/backend/routes/…`) | Access |
| --- | --- | --- | --- |
| `/api/products` | GET | `catalog/products.ts` | public |
| `/api/products/[slug]` | GET | `catalog/product-by-slug.ts` | public |
| `/api/categories`, `/api/brands`, `/api/collections` | GET | `catalog/*.ts` | public |
| `/api/reviews` | POST | `catalog/reviews.ts` | public |
| `/api/blog`, `/api/blog/[slug]` | GET | `content/blog.ts`, `content/blog-by-slug.ts` | public |
| `/api/slider`, `/api/gallery` | GET | `content/slider.ts`, `content/gallery.ts` | public (active items only) |
| `/api/testimonials`, `/api/clients`, `/api/settings` | GET | `content/*.ts` | public |
| `/api/contact`, `/api/newsletter` | POST | `messages/*.ts` | public |
| `/api/enquiries` | GET / POST | `messages/enquiries.ts` | GET admin, POST public |
| `/api/orders` | GET / POST | `orders/orders.ts` | GET admin, POST public |
| `/api/orders/track`, `/api/orders/by-email` | GET | `orders/track.ts`, `orders/by-email.ts` | public |
| `/api/checkout` | POST | `orders/checkout.ts` | public (creates Stripe session) |
| `/api/webhooks/stripe` | POST | `orders/stripe-webhook.ts` | Stripe (signature verified) |
| `/api/auth/login`, `/register`, `/logout` | POST | `auth/*.ts` | public |
| `/api/auth/session` | GET | `auth/session.ts` | current cookie |
| `/api/auth/profile` | PUT | `auth/profile.ts` | signed-in user |
| `/api/admin/dashboard`, `/analytics` | GET | `admin/dashboard.ts`, `admin/analytics.ts` | admin only |
| `/api/admin/products` | POST, PUT, DELETE | `admin/products.ts` | admin only |
| `/api/admin/products/export?format=xlsx\|csv[&template=1]` | GET | `admin/product-transfer.ts` | admin only |
| `/api/admin/products/import` (multipart `file`, `dryRun`) | POST | `admin/product-transfer.ts` | admin only |
| `/api/admin/categories`, `/brands` | GET, POST, PUT, DELETE | `admin/taxonomy.ts` | admin only |
| `/api/admin/testimonials`, `/clients`, `/slides`, `/gallery` | GET, POST, PUT, DELETE | `admin/content.ts` | admin only |
| `/api/admin/blog` | GET (incl. drafts), POST, PUT, DELETE | `admin/blog.ts` | admin only |
| `/api/admin/users` | GET, POST, PUT | `admin/users.ts` | admin only (cannot demote/deactivate self) |
| `/api/admin/orders`, `/enquiries`, `/enquiries/respond` | PUT | `admin/orders.ts`, `admin/enquiries.ts`, `admin/enquiry-respond.ts` | admin only (respond emails the customer) |
| `/api/admin/newsletter` | GET, PUT, DELETE | `admin/newsletter.ts` | admin only |
| `/api/admin/settings` | PUT | `admin/settings.ts` | admin only |
| `/api/admin/upload` | POST | `admin/upload.ts` | admin only (images ≤ 10 MB) |

## Product import / export (Admin → Products)

- **Export Excel / CSV** downloads every product with all fields (one row per product). The Excel file
  has an *Instructions* sheet listing each column, the existing categories, brands and collections.
- **Import** accepts `.xlsx` or `.csv` (our export, or a customer catalogue with headers like Name, SKU,
  Price, Stock, Category, Brand, Image). The file is checked first and a preview shows what will be
  added, updated, unchanged or rejected; nothing is saved until you confirm.
- **No duplicates:** each row is matched to an existing product by ID → SKU → Slug → exact Name and
  overwritten; unmatched rows become new products. A product may appear only once per file.
- Missing columns are left untouched; an empty cell clears that field (ID/SKU/Slug are kept).
  Categories use `Parent > Child`; lists (Images, Collections) are separated by `|`. New categories,
  brands and collections are created automatically. Import never deletes products.
- Column definitions live in `PRODUCT_COLUMNS` in `src/backend/lib/product-sheet.ts`: add a field there
  and both export and import pick it up.

## Database (prisma/schema.prisma)

PostgreSQL via Prisma. Main models:

- **Accounts:** `User` (role `customer`/`admin`/`staff`), `Address`
- **Catalog:** `Product`, `ProductImage`, `ProductReview`, `Category` (tree via `parentId`), `Brand`, `Collection` + `CollectionProduct`
- **Shopping:** `CartItem`, `WishlistItem`, `Order` + `OrderItem`, `Enquiry` (quote requests)
- **Content:** `BlogPost`, `HeroSlide`, `GalleryItem`, `Testimonial`, `ClientLogo`, `SiteSettings` (key/value)
- **Marketing:** `NewsletterSubscriber`, `ContactMessage`

After editing the schema, run `bun run db:push` (dev) or `bun run db:migrate`, then `bun run db:generate`.

## Environment variables (`.env`)

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | Prisma (PostgreSQL / Neon) |
| `NEXTAUTH_SECRET` (or `AUTH_SECRET`, 32+ chars) | signing session cookies |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `backend/integrations/stripe.ts`, webhook |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | image uploads |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | transactional email |
| `ADMIN_EMAIL` | address that receives order/enquiry notification emails |
| `NEXT_PUBLIC_SITE_URL`, `CURRENCY` | links in emails/checkout, currency |

`NEXT_PUBLIC_*` variables are visible in the browser. Never prefix a secret with it.

## Common edits: where to go

| I want to… | Edit |
| --- | --- |
| Add a storefront page | Create `src/frontend/views/x-view.tsx`, add `'x'` to `ViewKey` in `store/use-store.ts`, add a `case` in `storefront-app.tsx`, link to it with `navigate('x')` |
| Add an API endpoint | Write the handler in `src/backend/routes/<domain>/x.ts`, then add a one-line `src/app/api/x/route.ts` (`export { GET } from '@/backend/routes/<domain>/x'`), then add a typed method to `src/frontend/lib/api.ts` |
| Add a simple admin-managed table | Declare it with `adminResource({ model, fields, orderBy })` in `backend/routes/admin/content.ts`, wire `src/app/api/admin/<name>/route.ts`, then add a `CrudConfig` + `<CrudSection>` in `frontend/views/admin/` |
| Protect an endpoint | Start the handler with `const denied = await adminGuard(request); if (denied) return denied` (or `await requireUser(request)` inside try/`failure`) |
| Change a data shape | `prisma/schema.prisma`, then `src/shared/types.ts`, then the handlers and views that use it |
| Change header/footer/branding | `src/frontend/components/layout/`, colours in `src/app/globals.css`, SEO in `src/app/layout.tsx` |
| Change emails | `src/backend/integrations/resend.ts` |
| Add a shadcn component | `bunx shadcn add <name>` (aliases point at `src/frontend/…` via `components.json`) |

## Known gaps

See `docs/production-cleanup.md` for the full security review. Still open: order totals trust
client-sent prices, unescaped user text goes into the older email templates in `resend.ts`, `.env` is
tracked by git (untrack it and rotate the keys), and most product image URLs in the database point to
Cloudinary files that return 404 (re-upload them from Admin → Products → Edit).
