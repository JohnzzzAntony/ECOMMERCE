# Task 2-c — Account, Cart & Wishlist Views Agent

## Task
Build the ENQUIRY CART, WISHLIST, and ACCOUNT (login/register/profile) view components for the JKR International medical equipment e-commerce site (UAE-based, AED currency, teal/gold design).

## Work Log
- Read worklog.md to understand the project foundation, store API, API client, and helpers.
- Created 5 view components in `src/components/views/`:
  1. `cart-view.tsx` — Enquiry cart (NOT payment checkout). Two-column layout with cart items + sticky summary. Includes quantity selectors, line totals, discount calculation, notes textarea, payment-option badges (Tabby, Tamara, COD, Network International), trust signals, and a polished enquiry-submit Dialog that pre-fills name/email/phone from logged-in user. Calls `api.enquiry(...)` and on success: clearCart + toast + navigate('home'). Empty state with "Continue Shopping" CTA.
  2. `wishlist-view.tsx` — Grid of ProductCards for wishlisted items. Fetches all products via `api.products({ limit: '200' })` then filters by wishlist IDs. "Move All to Cart" button adds all wishlist items to cart and navigates to cart. Empty state with heart icon + "Browse Products" CTA. Loading spinner.
  3. `login-view.tsx` — Centered max-w-md card with JKR logo (HeartPulse), "Welcome Back" heading. Email/password form with show/hide password toggle. Calls `api.login()`, sets user, navigates to 'admin' if user.role === 'admin' else 'home'. Forgot-password link (toast placeholder). Register link → navigate('register'). Admin demo credentials hint with click-to-fill.
  4. `register-view.tsx` — Centered card with first/last name, email, phone, password, confirm password. Inline validation (required fields, email regex, password length ≥ 6, passwords match). Calls `api.register()`, sets user, navigates to 'home'. Benefits list. Login link.
  5. `profile-view.tsx` — Requires login (redirects to login if !user). Header card with gradient banner + avatar initials + admin badge (if admin). Tabs: Profile (editable form, email readonly, save via `PUT /api/auth/profile`); My Orders (fetches `/api/orders` GET, filters by user's email, displays desktop table + mobile cards with status badges + empty state). Logout button. Quick action cards (Wishlist, Cart, Browse Catalogue). "Go to Admin Panel" button if role === 'admin'.
- All files are `'use client'` with named exports: `CartView`, `WishlistView`, `LoginView`, `RegisterView`, `ProfileView`.
- Used shadcn/ui components: Button, Input, Label, Card, CardHeader/Content/Title/Description, Dialog, DialogHeader/Title/Description/Footer/Content, Textarea, Tabs, TabsList/Trigger/Content, Table, TableHeader/Body/Head/Row/Cell, Badge, Separator.
- Used `toast` from `sonner` for all feedback.
- Used brand color tokens (bg-brand-teal, hover:bg-brand-teal-dark, text-brand-ink, text-brand-cyan, bg-brand-gold) — no indigo/blue.
- All layouts are fully responsive (mobile-first, sm/md/lg breakpoints). Touch targets ≥ 44px. Sticky summary on desktop.
- Used `// eslint-disable-next-line @next/next/no-img-element` before `<img>` tags per spec.
- Pre-fills enquiry dialog form with logged-in user data.
- Computed subtotal vs sale-total to show discount in cart summary.
- For profile orders: filters server-fetched orders by user's email (no auth on GET endpoint — admin demo only).
- Lint: removed an unused `react-hooks/exhaustive-deps` disable in profile-view. Remaining warning in cart-view.tsx (the `@next/next/no-img-element` directive) matches the project-wide pattern explicitly required by the spec — same warning appears in existing product-card.tsx, header.tsx, footer.tsx, and other views.

## Files Created
- `/home/z/my-project/src/components/views/cart-view.tsx` (510 lines)
- `/home/z/my-project/src/components/views/wishlist-view.tsx` (140 lines)
- `/home/z/my-project/src/components/views/login-view.tsx` (172 lines)
- `/home/z/my-project/src/components/views/register-view.tsx` (252 lines)
- `/home/z/my-project/src/components/views/profile-view.tsx` (478 lines)

## Stage Summary
- All 5 account/cart/wishlist view components complete and integrated with the SPA router via the existing `src/app/page.tsx`.
- Enquiry submit flow (the key conversion) is polished: pre-filled form, validation, loading state, success toast, cart clearing, and home navigation.
- Auth flow: login → setUser + navigate to home/admin based on role; register → setUser + navigate home; profile → editable info + order history + logout.
- Lint passes for all 5 new files (1 spec-required unused-directive warning matches project convention).
- Dev server: no module-not-found or compile errors for any of these 5 files (other view files like terms-view, faq-view etc. are being built by sibling agents and are not my responsibility).
