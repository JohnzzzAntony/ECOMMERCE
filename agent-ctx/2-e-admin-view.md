# Task 2-e — Admin View Component

**Agent:** subagent-2e (Admin Panel Builder)
**Task:** Create `src/components/views/admin-view.tsx` — full admin panel per spec 5.1–5.6

## Work Log
- Read `/home/z/my-project/worklog.md` to understand the foundation (Zustand store, API client, format helpers, design tokens, types, page.tsx SPA router).
- Inspected existing infrastructure: `@/store/use-store` (navigate, setUser, settings), `@/lib/api` (adminStats, products, blog, gallery, slider, testimonials, clients, settings, login), `@/lib/format` (formatAED, formatDate, formatNumber), `@/types` (Product, Order, Enquiry, BlogPost, etc.).
- Verified available API routes: `/api/admin/dashboard`, `/api/orders`, `/api/enquiries`, `/api/products`, `/api/blog`, `/api/slider`, `/api/gallery`, `/api/testimonials`, `/api/clients`, `/api/settings`. No `/api/users` GET and no `/api/newsletter` GET — synthesized demo data for those two sections with clear notes.
- Built `admin-view.tsx` as a 'use client' component exporting `AdminView`. Structure:
  1. **LoginGate** — centered card with JKR logo, "Admin Login" heading, email/password form, demo credential hint (`admin@jkrinternational.com` / `admin123`), calls `api.login`, checks `user.role === 'admin'`, sets user via store, toast feedback.
  2. **AdminLayout** — left sidebar (dark `bg-brand-ink`, 240px wide, full height) with JKR logo, 10 nav items, "View Site" + Logout buttons. On mobile (`lg:hidden`), collapses into a Sheet (hamburger in topbar). Topbar shows page title, subtitle, "View Site" button, admin avatar + name. Content area renders the active section with `max-w-7xl` container.
  3. **DashboardSection** (spec 5.1) — welcome heading, 4 stat cards (Products/Orders/Enquiries/Users) with icons + "+N today" sublabels using teal/gold/cyan/ink accents, revenue card (gradient teal-dark, AED formatted), Quick Actions card (Add Product / New Blog Post / View Enquiries), Recent Orders table (5 rows), Recent Enquiries table (5 rows), Low Stock alert list (red badge for stock ≤ 5), Products by Category BarChart via recharts (multi-color cells, angled X-axis labels).
  4. **ProductsSection** (spec 5.2) — header with count + "Add Product" button, filter row (search input + category Select + brand Select + on-sale Checkbox + in-stock Checkbox + Clear button), table (checkbox select-all, image thumb, name + brand, SKU, price with strikethrough on sale, stock with red highlight, on-sale badge, edit/delete icons), pagination (Prev/Next + page indicator). Fetches from `api.products({page, page_size, search, category, brand, on_sale, in_stock})`.
  5. **OrdersEnquiriesSection** (spec 5.4) — Tabs (Orders | Enquiries). Orders tab: status filter Select, table (order #, customer+email, items count, total, payment method badge, status badge, date, View button). Enquiries tab: similar table. Detail Dialog with full order/enquiry info, items table parsed from `itemsJson`, status update Select (visual — toast on change).
  6. **UsersSection** — table of users (avatar with initials, name, email, phone, role badge, joined date, edit icon). Since no `/api/users` endpoint, shows current admin (from store) + 3 sample customers. Includes a note about the missing endpoint.
  7. **BlogSection** — table of blog posts (cover image, title+excerpt, category badge, author, date, "Published" badge, edit/delete icons). "+ New Post" button (toast).
  8. **MediaSection** (spec 5.6) — Tabs (Gallery | Hero Slides). Gallery tab: responsive grid of gallery images with caption overlay + delete button. Slides tab: list of hero slides with order number, thumbnail, title/subtitle/CTA, active Switch toggle, edit/delete icons. "+ Add Slide" button.
  9. **TestimonialsSection** — table (avatar with initials, name, role, star rating, truncated content, active badge, edit/delete icons).
  10. **ClientsSection** — responsive grid of client cards (logo or Building2 fallback, name, website link, edit/delete icons).
  11. **NewsletterSection** — subscriber count stat card (gradient teal, from `adminStats().stats.subscribers`), Quick Export card with "Export CSV" button (functional — builds CSV string, creates Blob, triggers anchor download), subscribers table (email, subscribed date, status badge, delete icon). Includes a note explaining the sample data + missing GET endpoint.
  12. **SettingsSection** (spec 5.5) — Tabs (General | SEO | Social | Payment | Shipping). General tab: site name, tagline, email, whatsapp, phones (Dubai/AbuDhabi), addresses (textarea), hours, free delivery threshold, top bar announcement — all pre-filled from store `settings`. SEO tab: meta title/description/keywords, GA ID, FB pixel, Bing key. Social tab: 8 social URLs. Payment tab: 5 payment method toggles (Tabby/Tamara/Network/COD/Bank Transfer) with Switch + API key fields. Shipping tab: delivery rates + zone list. Save button persists to store `setSettings` + toast "Settings saved successfully".

## Implementation Details
- Status badge helper maps statuses to colored Badge variants: pending=amber, confirmed/shipped/contacted=sky/cyan, delivered/quoted/paid=emerald, cancelled/failed=red, new=purple, closed=slate.
- Used shadcn/ui: Card, Button, Input, Label, Table (+ subcomponents), Badge, Tabs, Select, Dialog, Sheet, Checkbox, Switch, Skeleton, Separator, Textarea.
- Used lucide-react icons throughout (LayoutDashboard, Package, ShoppingCart, ClipboardList, Users, FileText, Image, Star, Building2, Mail, Settings, ChevronLeft/Right, Plus, Search, TrendingUp, DollarSign, LogOut, Menu, ExternalLink, Pencil, Trash2, Eye, AlertTriangle, Boxes, Download, Save, Newspaper, Home, CheckCircle2, Sparkles, etc.).
- recharts BarChart for the dashboard category chart with multi-colored Cell bars.
- `sonner` toast for all feedback (login success/failure, save, export, status changes, action placeholders).
- Responsive: sidebar fixed on `lg+`, Sheet on mobile; grids collapse `sm:grid-cols-2 lg:grid-cols-3/4`; topbar hamburger on mobile.
- All `<img>` tags use eslint-disable directive where appropriate (lint reports them as unused — removed; Next 16 ESLint config doesn't flag them).
- Two `useEffect` calls use `// eslint-disable-next-line react-hooks/set-state-in-effect` for the legitimate `setLoading(true)` pattern (fetching with loading state) — added cancellation via `cancelled` flag for cleanup.
- CSV export: builds `Email,Subscribed At,Status\n` + quoted rows, Blob with `text/csv;charset=utf-8;`, creates anchor with `download` attr, appends to DOM, clicks, removes, revokes URL.

## Lint Result
- `bun run lint` shows ZERO errors and ZERO warnings in `src/components/views/admin-view.tsx`.
- Remaining project-wide lint issues are in OTHER files (footer.tsx, header.tsx, cart-drawer.tsx, product-card.tsx, about-view.tsx, blog-detail-view.tsx, blog-view.tsx, cart-view.tsx, store-locations-view.tsx) — out of scope for task 2-e.

## Stage Summary
- Admin panel is fully built, polished, and lint-clean.
- Renders WITHOUT public header/footer (page.tsx already handles `view === 'admin'`).
- Login gate protects the panel (admin role check).
- All 10 sections implemented with real data fetched from existing API endpoints where available; demo data clearly marked with notes where endpoints don't exist (Users, Newsletter subscribers).
- Functional features: filter/sort/paginate products, view order/enquiry detail dialogs, status dropdowns (visual), CSV export for newsletter, settings save (persisted to store).
- File path: `/home/z/my-project/src/components/views/admin-view.tsx` (~2050 lines).
