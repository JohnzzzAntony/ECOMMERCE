# Task 2-d — Content & Info Views Agent

## Task
Build the 9 content/info view components for the JKR International medical equipment e-commerce SPA: blog list, blog detail, about, contact, store locations, FAQ, shipping info, terms & conditions, privacy policy.

## Work Log
- Read `/home/z/my-project/worklog.md` to understand the foundation (Zustand store, API client, helpers, design tokens, shadcn/ui setup).
- Read `src/lib/api.ts`, `src/types/index.ts`, `src/store/use-store.ts`, `src/lib/format.ts`, `src/app/page.tsx`, `src/app/globals.css`, `eslint.config.mjs`, and existing `footer.tsx` for design language + integration patterns.
- Built the 9 views as `'use client'` named-export components in `src/components/views/`:
  1. `blog-view.tsx` — Featured post, 2-col post grid, client-side pagination (6 per page), sidebar with search, recent posts, category filter, newsletter signup; uses `api.blog()` and `api.newsletter()`.
  2. `blog-detail-view.tsx` — Breadcrumb, hero, cover image, ReactMarkdown content with custom component styling, tags, share buttons (WhatsApp/Facebook/Copy Link), related posts grid; uses `api.blogPost(slug)` with derived-state pattern (caches by slug) to avoid `react-hooks/set-state-in-effect` errors.
  3. `about-view.tsx` — Hero with bg image, story section with image, 4-stat teal band, 4 "Why Choose Us" feature cards, Mission/Vision/Values 3-col, team grid (4 members), CTA.
  4. `contact-view.tsx` — Two-col layout: left contact form (Name/Email/Phone/Subject/Message → `api.contact()` + toast), right info cards (Dubai & Abu Dhabi offices from settings with fallbacks), Google Maps iframe embed at bottom.
  5. `store-locations-view.tsx` — Hero, full-width UAE map iframe, 2 location cards (Dubai & Abu Dhabi) with image, address, phone, hours, mini map, Get Directions (Google Maps link), WhatsApp CTA, fallback informational card.
  6. `faq-view.tsx` — Hero, search input, 7 category tabs (All/Orders/Products/Payment/Shipping/Services/Account), Accordion with 12 realistic FAQs covering delivery, payment, warranty, returns, bulk orders, installation, maintenance, customization, areas served, tracking, international, account. CTA → contact.
  7. `shipping-view.tsx` — Hero with bg image, 4 quick-highlight cards, 8 info sections (Delivery Areas, Delivery Times, Free Delivery Threshold, Express, Tracking, Bulk/Commercial, International, Order Issues) each with icon + bullets, CTA.
  8. `terms-view.tsx` — Hero with last-updated date, sticky Table-of-Contents sidebar, 13 sections with realistic legal-style content, "Last Updated" callout banner, CTA → contact.
  9. `privacy-view.tsx` — Hero with last-updated date, sticky TOC sidebar, 9 sections (Info Collected, How We Use, Cookies, Info Sharing, Data Security, Your Rights, Children's Privacy, Changes, Contact), callout banner, CTA.

## Design Notes
- All views use the JKR teal/gold/cyan/ink brand palette and `bg-brand-bg` page background.
- Consistent `max-w-7xl mx-auto px-4 py-12` container pattern with `py-16` heroes.
- Hero sections use `bg-gradient-to-br from-brand-teal to-brand-teal-dark` with white text.
- Maps use `https://maps.google.com/maps?q=...&output=embed` iframe pattern.
- All `<img>` tags include the `// eslint-disable-next-line @next/next/no-img-element` directive per task spec (rule is disabled in eslint config, so these generate harmless "unused eslint-disable directive" warnings — matching the existing project convention in header/footer/product-card/cart-view).
- All `onClick` handlers use `useStore().navigate()` for SPA routing; no Next.js `Link` for in-app navigation (only one sr-only Link for typing compliance in blog-detail).
- Forms use shadcn `Button`/`Input`/`Textarea`/`Label`/`Card` and `toast` from `sonner`.
- `ReactMarkdown` (already installed) used for blog content with custom-styled `h2`/`h3`/`p`/`ul`/`ol`/`strong`/`a`/`blockquote`/`code` components for visual polish.

## Lint Status
Final `bun run lint` output: **16 problems (1 error, 15 warnings)**.
- The 1 error is in `src/components/layout/footer.tsx` (pre-existing from main orchestrator, NOT in this task's files).
- The 15 warnings are all "Unused eslint-disable directive" for `@next/next/no-img-element` — these are intentional per task instructions ("Use `// eslint-disable-next-line @next/next/no-img-element` before `<img>` tags") and match the existing project convention.
- **Zero errors and zero non-directive warnings in any of the 9 files I created.**

## Implementation Highlights
- Solved the `react-hooks/set-state-in-effect` lint error in `blog-detail-view.tsx` by switching to a derived-state pattern (cache responses by slug, derive `loading`/`notFound`/`post` from cache presence) instead of calling `setState` synchronously in the effect body. Same pattern used in `home-view.tsx` by another agent.
- Solved the same lint error in `blog-view.tsx` by moving the `setPage(1)` reset logic out of `useEffect` and into the `updateSearch`/`updateCategory` handler functions.

## Stage Summary
- 9 view components created, all `'use client'`, all named exports, all responsive (mobile-first with sm/md/lg breakpoints), all integrated with the Zustand store, API client, and shadcn/ui component library.
- Static pages (terms, privacy, shipping) have polished typography with sticky TOC sidebars, callout banners, and section anchors — not just plain text blocks.
- Blog views support markdown rendering, share buttons, related posts, and client-side pagination/filtering.
- Contact form submits to `api.contact()` and shows toast feedback.
- All geographic info (addresses, phones, hours) sourced from the persisted `settings` store with sensible fallbacks.
