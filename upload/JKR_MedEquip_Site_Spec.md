# JKR International — Medical Equipment E-Commerce Platform
## Full Site Specification & Wireframe Blueprint for AI Build

> **Reference Site:** https://web-production-5e010.up.railway.app/
> **Business:** Premium medical equipment supplier — UAE-based (Dubai & Abu Dhabi)
> **Model:** Enquiry-cart + direct purchase hybrid (B2B/B2C)
> **Currency:** AED | **Languages:** English + Arabic (RTL support required)

---

## 1. TECH STACK RECOMMENDATION

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:    Django REST Framework (or Next.js API Routes if keeping JS-only)
Database:   PostgreSQL (products, users, orders, blog, enquiries)
Auth:       JWT + Django-allauth (or NextAuth.js)
Media:      Cloudinary (image CDN — already in use on reference site)
Search:     Algolia or Django Haystack (full-text product search)
Payments:   Tabby + Tamara + Network International + Cash on Delivery
Hosting:    Railway / Render / Vercel (frontend) + Railway (backend)
Admin:      Django Admin (customized) OR custom React admin panel
Email:      Resend / SendGrid (transactional: order confirm, newsletters)
```

---

## 2. SITE ARCHITECTURE / PAGES MAP

```
PUBLIC SITE
├── / (Home)
├── /products/                        → All categories page
│   ├── /products/category/:slug/     → Category listing (with subcats)
│   ├── /products/brand/:slug/        → Brand listing
│   ├── /products/collection/:slug/   → Curated collection
│   ├── /products/results/            → Search + filtered results
│   └── /products/:slug/              → Product detail page
├── /enquiry-cart/cart/               → Enquiry cart (not checkout)
├── /wishlist/
├── /accounts/
│   ├── /accounts/login/
│   ├── /accounts/register/
│   └── /accounts/profile/
├── /blog/
│   └── /blog/:slug/
├── /about-us/
├── /contact/
├── /store-locations/
├── /faq/
├── /shipping-info/
├── /terms-conditions/
├── /privacy-policy/
└── /offers/ (redirects to ?on_sale=1 filter)

ADMIN PANEL (separate route or subdomain)
└── /admin/
    ├── Dashboard (stats, quick actions)
    ├── Products (CRUD, bulk ops, import CSV)
    ├── Categories & Subcategories
    ├── Brands
    ├── Collections
    ├── Orders & Enquiries
    ├── Users / Customers
    ├── Blog Posts
    ├── Gallery
    ├── Slider / Hero Banners
    ├── Testimonials
    ├── Client Logos (Partners)
    ├── Settings (site info, SEO, contact details)
    └── Newsletter Subscribers
```

---

## 3. DATABASE SCHEMA

### Products
```sql
Product {
  id, slug, name, name_ar,
  description, description_ar,
  short_description,
  sku, barcode,
  regular_price (AED), sale_price (AED),
  on_sale (bool), discount_percent (auto-calc),
  stock_qty, in_stock (bool),
  category_id (FK), subcategory_id (FK),
  brand_id (FK),
  is_featured, is_exclusive,
  meta_title, meta_description, meta_keywords,
  created_at, updated_at
}

ProductImage {
  id, product_id (FK), image_url (Cloudinary),
  alt_text, sort_order, is_primary
}

ProductReview {
  id, product_id (FK), user_id (FK),
  rating (1–5), review_text, is_approved, created_at
}
```

### Taxonomy
```sql
Category {
  id, slug, name, name_ar, image_url,
  parent_id (FK, nullable → subcategory),
  sort_order, is_active
}

Brand {
  id, slug, name, logo_url, description, is_active
}

Collection {
  id, slug, name, name_ar,
  banner_image_url, is_active, sort_order
}

CollectionProduct { collection_id (FK), product_id (FK), sort_order }
```

### Users & Accounts
```sql
User {
  id, email, phone, first_name, last_name,
  role (customer | admin | staff),
  is_active, date_joined
}

Address {
  id, user_id (FK), label, line1, line2,
  city, emirate, country, is_default
}
```

### Orders & Enquiries
```sql
EnquiryCart {
  id, session_key (for guests), user_id (FK nullable),
  created_at
}

EnquiryCartItem {
  id, cart_id (FK), product_id (FK), quantity, notes
}

Order {
  id, order_number, user_id (FK),
  billing_address (JSON), shipping_address (JSON),
  items (JSON snapshot), subtotal, discount, total,
  payment_method (tabby|tamara|network|cod),
  payment_status, order_status,
  notes, created_at, updated_at
}

OrderItem {
  id, order_id (FK), product_id (FK),
  product_name, sku, unit_price, qty, subtotal
}
```

### Content
```sql
BlogPost {
  id, slug, title, title_ar,
  excerpt, content (rich text), author_id (FK),
  cover_image_url, is_published, published_at,
  meta_title, meta_description
}

Testimonial {
  id, name, role, avatar_url, content, rating,
  is_active, sort_order
}

ClientLogo { id, name, logo_url, website_url, sort_order, is_active }

HeroSlide {
  id, image_url, title, subtitle, cta_label, cta_url,
  sort_order, is_active
}

GalleryItem { id, image_url, caption, sort_order, is_active }

SiteSettings {
  key (unique), value
  -- e.g. site_name, logo_url, phone_dubai, phone_abudhabi,
  --      email, address_dubai, address_abudhabi,
  --      whatsapp_number, instagram_url, free_delivery_threshold
}

NewsletterSubscriber { id, email, subscribed_at, is_active }
```

---

## 4. PAGE-BY-PAGE WIREFRAMES

---

### 4.1 HOME PAGE `/`

```
┌─────────────────────────────────────────────────────┐
│ TOP BAR (full-width, teal/dark bg)                  │
│  📦 Free UAE Delivery on Purchases Above AED 2000   │
│                              [En] | [عر]            │
│  📷 Instagram  💬 WhatsApp  📘 Facebook             │
├─────────────────────────────────────────────────────┤
│ HEADER (white, sticky)                              │
│  [LOGO]         [Search bar 🔍]      [👤] [♡0] [🛒0]│
│  Nav: Home | Brands▾ | Collections▾ | Offers | Blog │
│       About | Contact | Store Locations             │
├─────────────────────────────────────────────────────┤
│ HERO SLIDER (full-width, 600px tall)                │
│  ┌───────────────────────────────────────────────┐  │
│  │  [Slide image — medical equipment / clinic]   │  │
│  │                                               │  │
│  │  State-of-the-art diagnostic instruments      │  │
│  │  from globally certified manufacturers.       │  │
│  │           [Shop Now]  [View Catalog]          │  │
│  └───────────────────────────────────────────────┘  │
│  ● ○ ○   (dot pagination + arrows)                  │
├─────────────────────────────────────────────────────┤
│ TRUST BAR (4 columns, icon + label + sub)           │
│  🚚 Fast Delivery │ 🔒 Secure Payment               │
│  💬 24/7 Support  │ ⭐ ISO Certified                │
├─────────────────────────────────────────────────────┤
│ SECTION: Shop by Categories                         │
│  Heading: "Our Categories"                          │
│  Sub: "Shop by Categories"                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │Icon│ │Icon│ │Icon│ │Icon│  (grid 4×2)            │
│  │Whlchr│Walk│ │Seat│ │Pros│                        │
│  └────┘ └────┘ └────┘ └────┘                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │Phys│ │Orth│ │Hosp│ │Home│                        │
│  └────┘ └────┘ └────┘ └────┘                       │
├─────────────────────────────────────────────────────┤
│ SECTION: Exclusive Products (Featured/New)          │
│  Heading: "Our premier healthcare selections"       │
│  Sub: "Exclusive Products"    [View All →]          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │[Image]  │ │[Image]  │ │[Image]  │ │[Image]  │  │
│  │10% OFF  │ │10% OFF  │ │ 8% OFF  │ │ 7% OFF  │  │
│  │Product  │ │Product  │ │Product  │ │Product  │  │
│  │Name     │ │Name     │ │Name     │ │Name     │  │
│  │⭐⭐⭐⭐⭐(50)│         │         │         │  │
│  │~~5600~~ │                                       │
│  │5000 AED │                                       │
│  │[Shop Now]                                       │
│  └─────────┘ ...                                   │
│  (horizontal scroll or 4-col grid)                 │
├─────────────────────────────────────────────────────┤
│ BANNER AD (full-width clickable promotional image)  │
├─────────────────────────────────────────────────────┤
│ SECTION: Exclusive Collections (Tabbed)             │
│  [Premium Collections] [Selected Offers] [Signature]│
│  → Tab content: grid of 4–5 products (same card UI) │
├─────────────────────────────────────────────────────┤
│ SECTION: On Sale Now                                │
│  Heading: "Limited-time offers"   [View All →]      │
│  → 4-col product card grid                         │
├─────────────────────────────────────────────────────┤
│ FEATURE GRID (2×4 icons)                            │
│  Precision Engineering │ ISO 9001 Certified         │
│  Global Logistics      │ Direct Support             │
│  Fast Delivery         │ 24/7 Tech Support          │
│  Competitive Pricing   │ Easy Financing             │
├─────────────────────────────────────────────────────┤
│ SECTION: Testimonials / Reviews                     │
│  Heading: "What our Customers have shared!"         │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  "Quote text..."     │  │  "Quote text..."     │ │
│  │  [Avatar] Name       │  │  [Avatar] Name       │ │
│  │  Title, Hospital     │  │  Title, Hospital     │ │
│  └──────────────────────┘  └──────────────────────┘ │
│  (carousel or 3-col grid)                           │
├─────────────────────────────────────────────────────┤
│ SECTION: Trusted Partners / Clients                 │
│  Heading: "Our Valued Clients"                      │
│  [Logo] [Logo] [Logo] [Logo] [Logo] [Logo] ...      │
│  (auto-scrolling marquee)                           │
├─────────────────────────────────────────────────────┤
│ SECTION: Blog                                       │
│  Heading: "From Our Blog"    [View All Posts →]     │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ [Cover Image]    │  │ [Cover Image]    │         │
│  │ Title            │  │ Title            │         │
│  │ Excerpt…         │  │ Excerpt…         │         │
│  │ Apr 11 · Read →  │  │ ...              │         │
│  └──────────────────┘  └──────────────────┘         │
├─────────────────────────────────────────────────────┤
│ SECTION: Newsletter                                 │
│  "Stay in the Loop"                                 │
│  [Email input          ] [Subscribe]                │
│  No spam. Unsubscribe anytime.                      │
├─────────────────────────────────────────────────────┤
│ SECTION: Instagram Feed                             │
│  @jkrinternational  [Follow on Instagram]           │
│  [Post][Post][Post][Post][Post][Post]  (6 grid)     │
├─────────────────────────────────────────────────────┤
│ SECTION: Gallery                                    │
│  "Latest Gallery & Updates"                         │
│  [Img][Img][Img]  (lightbox on click)               │
│  [Img][Img][Img]                                    │
├─────────────────────────────────────────────────────┤
│ FOOTER (dark bg)                                    │
│  [LOGO]                                             │
│  Tagline                                            │
│  Dubai address | Abu Dhabi address                  │
│  email | phone | socials                            │
│  ─────────────────────────────────                  │
│  Categories | Information | Newsletter              │
│  ─────────────────────────────────                  │
│  Payment: [COD][Tabby][Tamara][Network]             │
│  © 2026 JKR International. Privacy · Terms          │
│  [WhatsApp float button]                            │
└─────────────────────────────────────────────────────┘
```

---

### 4.2 PRODUCT LISTING PAGE `/products/category/:slug/`

```
┌─────────────────────────────────────────────────────┐
│ HEADER (same as above)                              │
├─────────────────────────────────────────────────────┤
│ BREADCRUMB: Home > Categories > Wheelchairs         │
├─────────────────────────────────────────────────────┤
│ CATEGORY HEADER                                     │
│  [Category Banner Image]                            │
│  H1: Wheelchairs                                    │
│  Subcategory pills: [All] [Active] [Bariatric] ...  │
├──────────────┬──────────────────────────────────────┤
│ SIDEBAR      │ PRODUCT GRID                         │
│ (Filters)    │                                      │
│              │  Sort by: [Featured ▾]  View: [■■][≡]│
│ ▼ Brands     │  Showing 1–12 of 48 products         │
│  □ Dynarex   │                                      │
│  □ Kirton    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  □ Sissel    │  │[Img] │ │[Img] │ │[Img] │ │[Img] ││
│              │  │10%OFF│ │      │ │ 8%OFF│ │      ││
│ ▼ Price      │  │Name  │ │Name  │ │Name  │ │Name  ││
│  AED [  ]–   │  │★★★★★ │ │★★★★☆ │ │★★★★★ │ │★★★★☆ ││
│      [    ]  │  │~~old~│ │      │ │~~old~│ │      ││
│              │  │Price │ │Price │ │Price │ │Price ││
│ ▼ In Stock   │  │[Enq] │ │[Enq] │ │[Enq] │ │[Enq] ││
│  ○ Yes ○ All │  │  [♡] │ │  [♡] │ │  [♡] │ │  [♡] ││
│              │  └──────┘ └──────┘ └──────┘ └──────┘│
│ ▼ On Sale    │                                      │
│  □ Sale only │  [Load More] or [1][2][3] pagination │
│              │                                      │
│ [Clear All]  │                                      │
└──────────────┴──────────────────────────────────────┘
```

---

### 4.3 PRODUCT DETAIL PAGE `/products/:slug/`

```
┌─────────────────────────────────────────────────────┐
│ BREADCRUMB: Home > Wheelchairs > Transfer Board     │
├──────────────────────┬──────────────────────────────┤
│ IMAGE GALLERY        │ PRODUCT INFO                 │
│                      │                              │
│  ┌────────────────┐  │  H1: Transfer Board          │
│  │                │  │  Brand: [Kirton Logo]         │
│  │  [Main Image]  │  │  SKU: JKR-TB-001             │
│  │                │  │                              │
│  └────────────────┘  │  ★★★★★ (50 reviews)          │
│  [Th1][Th2][Th3][+]  │                              │
│  (thumbnail strip)   │  ~~5,600 AED~~               │
│  [Zoom] [Fullscreen] │  5,000 AED  💰 Save 10%      │
│                      │                              │
│                      │  ─────────────────────       │
│                      │  Qty: [−][1][+]              │
│                      │                              │
│                      │  [Add to Enquiry Cart]  [♡]  │
│                      │  [Add to Wishlist]           │
│                      │                              │
│                      │  ─────────────────────       │
│                      │  ✓ Free Delivery over 2000   │
│                      │  ✓ Secure Payment            │
│                      │  ✓ 24/7 Support              │
│                      │                              │
│                      │  Share: [IG][WA][FB][Copy]   │
├──────────────────────┴──────────────────────────────┤
│ PRODUCT TABS                                        │
│  [Description] [Specifications] [Reviews(50)]       │
│                                                     │
│  Description tab: rich text content                 │
│  Specs tab: key-value table                         │
│  Reviews tab: star summary + list + write review    │
├─────────────────────────────────────────────────────┤
│ RELATED PRODUCTS (horizontal scroll)                │
│  You may also like:                                 │
│  [Card][Card][Card][Card]                           │
└─────────────────────────────────────────────────────┘
```

---

### 4.4 ENQUIRY CART `/enquiry-cart/cart/`

```
┌─────────────────────────────────────────────────────┐
│ H1: Your Enquiry Cart                               │
│ Note: "Submit your enquiry and our team will        │
│        contact you with pricing & availability"     │
├──────────────────────────────┬──────────────────────┤
│ CART ITEMS                   │ CART SUMMARY         │
│                              │                      │
│ ┌────────────────────────┐   │  Subtotal: 10,000 AED│
│ │[Img] Transfer Board    │   │  Discount: –500 AED  │
│ │      Qty: [−][1][+]   │   │  ─────────────────   │
│ │      5,000 AED   [✕]  │   │  Total: 9,500 AED    │
│ └────────────────────────┘   │                      │
│ ┌────────────────────────┐   │  [Submit Enquiry]    │
│ │[Img] Commode Chair     │   │  [Continue Shopping] │
│ │      Qty: [−][1][+]   │   │                      │
│ │      5,100 AED   [✕]  │   │  Payment Options:    │
│ └────────────────────────┘   │  [Tabby][Tamara]     │
│                              │  [COD][Network]      │
│ Notes/Message: [textarea]    │                      │
│                              │                      │
└──────────────────────────────┴──────────────────────┘
```

---

### 4.5 BLOG LIST `/blog/`

```
┌─────────────────────────────────────────────────────┐
│ H1: From Our Blog                                   │
├──────────────────────────────┬──────────────────────┤
│ FEATURED POST (wide)         │ SIDEBAR              │
│  [Large Cover Image]         │  Search: [      🔍]  │
│  Category Tag                │                      │
│  H2: Title                   │  Recent Posts        │
│  Excerpt…                    │  [Post][Post][Post]  │
│  Apr 11, 2026  [Read More →] │                      │
├──────────────────────────────│  Categories          │
│ POST GRID (2-col)            │  [Cat1] [Cat2] ...   │
│  [Card][Card]                │                      │
│  [Card][Card]                │  Newsletter Widget   │
│  [Card][Card]                │  [Email] [Subscribe] │
├──────────────────────────────┴──────────────────────┤
│ [Pagination: 1 2 3 … Next]                          │
└─────────────────────────────────────────────────────┘
```

---

### 4.6 CONTACT PAGE `/contact/`

```
┌─────────────────────────────────────────────────────┐
│ H1: Contact Us                                      │
├──────────────────────────────┬──────────────────────┤
│ CONTACT FORM                 │ INFO + MAP           │
│                              │                      │
│ Name: [____________]         │  📍 Dubai Office     │
│ Email: [____________]        │  Office No.2, Lootah │
│ Phone: [____________]        │  Building, Dubai     │
│                              │                      │
│ Subject: [____________]      │  📍 Abu Dhabi Office │
│                              │  Al Fardan Holdings  │
│ Message: [                ]  │                      │
│          [                ]  │  📞 +971 4 123 4567  │
│          [                ]  │  📧 info@jkrintl.com │
│                              │  💬 WhatsApp         │
│ [Send Message]               │                      │
│                              │  [Google Map Embed]  │
└──────────────────────────────┴──────────────────────┘
```

---

### 4.7 STORE LOCATIONS `/store-locations/`

```
┌─────────────────────────────────────────────────────┐
│ H1: Our Locations                                   │
├─────────────────────────────────────────────────────┤
│ [Full-width Google Map with pins]                   │
├──────────────────────┬──────────────────────────────┤
│ Dubai                │ Abu Dhabi                    │
│ [Map pin icon]       │ [Map pin icon]               │
│ Address              │ Address                      │
│ Phone                │ Phone                        │
│ Hours                │ Hours                        │
│ [Get Directions]     │ [Get Directions]             │
└──────────────────────┴──────────────────────────────┘
```

---

## 5. ADMIN PANEL WIREFRAMES

### 5.1 ADMIN DASHBOARD `/admin/`

```
┌─────────────────────────────────────────────────────┐
│ ADMIN SIDEBAR                                       │
│  [Logo]                                             │
│  ─────────────                                      │
│  📊 Dashboard        ← active                       │
│  📦 Products                                        │
│     └ Categories                                    │
│     └ Brands                                        │
│     └ Collections                                   │
│  🛒 Orders                                          │
│  📋 Enquiries                                       │
│  👥 Users                                           │
│  ✍️  Blog                                           │
│  🖼️  Media (Gallery, Sliders)                       │
│  ⭐ Testimonials                                    │
│  🏢 Clients / Partners                              │
│  📧 Newsletter                                      │
│  ⚙️  Settings                                       │
├─────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                   │
│                                                     │
│  Welcome back, Admin 👋                             │
│  ─────────────────────────────────────────          │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Products │ │  Orders  │ │Enquiries │ │  Users │ │
│  │   142    │ │    28    │ │    15    │ │   320  │ │
│  │ +5 today │ │ +3 today │ │ +2 today │ │+1 today│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  RECENT ORDERS (table)                              │
│  #  | Customer | Products | Total | Status | Date  │
│  001│ Ahmed M. │ 2 items  │4500AED│Pending │Today  │
│  002│ Sarah J. │ 1 item   │8700AED│Confirm.│Today  │
│  ...                                                │
│                                                     │
│  RECENT ENQUIRIES                                   │
│  Similar table layout                               │
│                                                     │
│  QUICK ACTIONS                                      │
│  [+ Add Product] [+ New Blog Post] [View Enquiries] │
└─────────────────────────────────────────────────────┘
```

---

### 5.2 ADMIN: PRODUCTS LIST `/admin/products/`

```
┌─────────────────────────────────────────────────────┐
│ Products                         [+ Add Product]    │
│                                                     │
│ Search: [______________]  Filter: [Category▾][Brand▾]│
│         [On Sale: □]  [In Stock: □]  [Clear]        │
│                                                     │
│ [Import CSV] [Export CSV]    Selected: 0  [Bulk ▾]  │
│                                                     │
│ ┌─┬──────────┬────────────┬───────┬──────┬─────┬──┐ │
│ │□│ Image    │ Name       │ Price │Stock │Sale │  │ │
│ ├─┼──────────┼────────────┼───────┼──────┼─────┼──┤ │
│ │□│[Thumb]   │Transfer Bd │5000AED│  12  │ ✓  │✏️🗑│ │
│ │□│[Thumb]   │Commode Chr │5100AED│   8  │ ✓  │✏️🗑│ │
│ │□│[Thumb]   │Gynecol Chr │8700AED│   5  │ ○  │✏️🗑│ │
│ └─┴──────────┴────────────┴───────┴──────┴─────┴──┘ │
│                                                     │
│ Showing 1–20 of 142   [< 1 2 3 … 8 >]              │
└─────────────────────────────────────────────────────┘
```

---

### 5.3 ADMIN: ADD/EDIT PRODUCT `/admin/products/edit/:id/`

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Products                                  │
│ Edit Product: Transfer Board                        │
├────────────────────────────┬────────────────────────┤
│ MAIN INFO                  │ PUBLISH PANEL          │
│                            │                        │
│ Name (EN): [___________]   │ Status: [Published▾]   │
│ Name (AR): [___________]   │ [Save Draft] [Publish] │
│                            │                        │
│ Slug: [transfer-board]     │ Category: [_______▾]   │
│ SKU: [JKR-001]             │ Subcategory: [____▾]   │
│                            │ Brand: [__________▾]   │
│ Description (EN):          │                        │
│ [Rich Text Editor          │ Collections:           │
│  — Bold/Italic/H2/Lists    │ [Premium] [x]          │
│  — Image insert            │ [+ Add Collection]     │
│                          ] │                        │
│                            │ Is Featured: [✓]       │
│ Description (AR):          │ Is Exclusive: [✓]      │
│ [Rich Text Editor RTL    ] │                        │
│                            │ STOCK                  │
│ PRICING                    │ Qty: [____]            │
│ Regular Price: [5600] AED  │ In Stock: [Yes▾]       │
│ Sale Price: [5000] AED     │                        │
│ On Sale: [✓]               │ SEO                    │
│ Discount: 10% (auto)       │ Meta Title: [______]   │
│                            │ Meta Desc: [_______]   │
├────────────────────────────┴────────────────────────┤
│ IMAGES                                              │
│  [Drop images here or click to upload]              │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │Img1│ │Img2│ │Img3│ │ +  │  (drag to reorder)    │
│  │[★] │ │    │ │    │ │    │  [★]=primary           │
│  └────┘ └────┘ └────┘ └────┘                       │
└─────────────────────────────────────────────────────┘
```

---

### 5.4 ADMIN: ORDERS & ENQUIRIES `/admin/orders/`

```
┌─────────────────────────────────────────────────────┐
│ Orders & Enquiries                                  │
│ [Orders] [Enquiries]  ← tabs                        │
│                                                     │
│ Filter: [Status▾] [Payment▾] [Date Range] [Search]  │
│                                                     │
│ ┌────┬──────────┬───────────┬───────┬───────┬──────┐│
│ │ #  │ Customer │ Items     │ Total │Status │Action││
│ ├────┼──────────┼───────────┼───────┼───────┼──────┤│
│ │001 │Ahmed M.  │ 2 items   │4500AED│Pending│[View]││
│ │    │          │           │       │       │[✓][✕]││
│ │002 │Sarah J.  │ 1 item    │8700AED│Confirm│[View]││
│ └────┴──────────┴───────────┴───────┴───────┴──────┘│
│                                                     │
│ Order Detail Modal / Page:                          │
│  Customer: Ahmed Al-Rashidi                         │
│  Phone: +971 50 xxx xxxx                           │
│  Address: Dubai, UAE                                │
│  Items: [list]                                      │
│  Total: 4,500 AED                                  │
│  Payment: Tabby                                     │
│  Notes: "Please deliver before Thursday"            │
│  Status: [Pending▾]  [Update Status]                │
└─────────────────────────────────────────────────────┘
```

---

### 5.5 ADMIN: SITE SETTINGS `/admin/settings/`

```
┌─────────────────────────────────────────────────────┐
│ Site Settings                                       │
│ Tabs: [General] [SEO] [Social] [Payment] [Shipping] │
│                                                     │
│ GENERAL TAB                                         │
│  Site Name: [JKR International]                     │
│  Tagline: [Delivering world-class medical...]        │
│  Logo: [Current logo] [Upload new]                  │
│  Favicon: [Current] [Upload]                        │
│                                                     │
│  Dubai Phone: [+971 4 123 4567]                     │
│  Abu Dhabi Phone: [+971 2 xxx xxxx]                 │
│  WhatsApp: [+971 50 123 4567]                       │
│  Email: [info@jkrinternational.com]                 │
│                                                     │
│  Dubai Address: [_______________________________]   │
│  AbuDhabi Address: [____________________________]   │
│                                                     │
│  Free Delivery Threshold: [2000] AED                │
│  Instagram Handle: [@jkrinternational]              │
│                                                     │
│  Top Bar Announcement: [Free UAE Delivery on...]    │
│                                                     │
│  [Save Settings]                                    │
└─────────────────────────────────────────────────────┘
```

---

### 5.6 ADMIN: HERO SLIDER `/admin/media/slider/`

```
┌─────────────────────────────────────────────────────┐
│ Hero Slides                      [+ Add Slide]      │
│                                                     │
│ (drag handles to reorder)                           │
│ ┌─────────────────────────────────────┬────────────┐│
│ │ ⠿ [Thumb] Title: "Medical Hero"    │[Edit][🗑] ││
│ │         Active: [✓]  Order: 1      │           ││
│ ├─────────────────────────────────────┼────────────┤│
│ │ ⠿ [Thumb] Title: "Rehabilitation"  │[Edit][🗑] ││
│ │         Active: [✓]  Order: 2      │           ││
│ └─────────────────────────────────────┴────────────┘│
│                                                     │
│ Edit Slide Modal:                                   │
│  Image: [Upload / Cloudinary URL]                   │
│  Title: [______________________________]            │
│  Subtitle: [____________________________]           │
│  CTA Label: [Shop Now]                              │
│  CTA URL: [/products/]                              │
│  Is Active: [✓]                                     │
│  [Save]                                             │
└─────────────────────────────────────────────────────┘
```

---

## 6. API ENDPOINTS (REST)

### Public
```
GET  /api/products/                  → list (filter: category, brand, on_sale, search)
GET  /api/products/:slug/            → detail
GET  /api/categories/                → full tree
GET  /api/brands/                    → list
GET  /api/collections/               → list
GET  /api/collections/:slug/products/→ products in collection
GET  /api/blog/                      → posts list
GET  /api/blog/:slug/                → post detail
GET  /api/testimonials/              → active testimonials
GET  /api/clients/                   → partner logos
GET  /api/slider/                    → active hero slides
GET  /api/gallery/                   → gallery items
GET  /api/settings/                  → public site settings
POST /api/newsletter/subscribe/      → email subscription
POST /api/contact/                   → contact form submission
```

### Auth
```
POST /api/auth/login/
POST /api/auth/register/
POST /api/auth/logout/
GET  /api/auth/profile/
PUT  /api/auth/profile/
```

### Cart & Orders
```
GET  /api/cart/                      → get cart (session or user)
POST /api/cart/add/                  → add item
PUT  /api/cart/:item_id/             → update qty
DEL  /api/cart/:item_id/             → remove item
POST /api/enquiry/submit/            → submit enquiry cart as order
GET  /api/wishlist/
POST /api/wishlist/toggle/
```

### Admin (JWT protected, admin role)
```
CRUD /api/admin/products/
CRUD /api/admin/categories/
CRUD /api/admin/brands/
CRUD /api/admin/collections/
CRUD /api/admin/orders/
CRUD /api/admin/blog/
CRUD /api/admin/testimonials/
CRUD /api/admin/clients/
CRUD /api/admin/slider/
CRUD /api/admin/gallery/
CRUD /api/admin/settings/
GET  /api/admin/dashboard/stats/
GET  /api/admin/newsletter/subscribers/
```

---

## 7. KEY FEATURES CHECKLIST

### Frontend
- [ ] Sticky responsive navbar with mega-menu (Brands + Collections dropdowns)
- [ ] RTL/LTR language toggle (EN/AR) — full Arabic translation support
- [ ] Hero carousel with auto-play, dots, arrows
- [ ] Category grid with icons and hover effects
- [ ] Product card: image, discount badge, star rating, original + sale price, enquiry + wishlist CTAs
- [ ] Product detail: image gallery with zoom, tabs (description/specs/reviews), related products
- [ ] Enquiry cart (not traditional checkout — collect enquiries, not payments directly)
- [ ] Wishlist (localStorage for guests, DB for logged-in users)
- [ ] Product search with autocomplete
- [ ] Filter sidebar: by brand, price range, in-stock, on-sale
- [ ] Collections page with tabbed filtering
- [ ] Blog with category filter + sidebar
- [ ] Newsletter signup (header + footer + dedicated section)
- [ ] Instagram feed grid
- [ ] Photo gallery with lightbox
- [ ] Testimonials carousel
- [ ] Partner logos marquee / scroll
- [ ] Store locations page with Google Maps embed
- [ ] FAQ accordion
- [ ] WhatsApp floating CTA button
- [ ] SEO: meta tags, OG tags, sitemap, canonical URLs per page
- [ ] Payment logos in footer: Tabby, Tamara, Network International, COD
- [ ] Free delivery banner (threshold: AED 2,000)

### Backend / Admin
- [ ] Rich text editor for products & blog (TipTap or Quill)
- [ ] Cloudinary image upload integration
- [ ] Bulk product import via CSV
- [ ] Stock management with low-stock alerts
- [ ] Order/enquiry status management (Pending → Confirmed → Shipped → Delivered)
- [ ] Role-based access (Admin, Staff, Customer)
- [ ] Newsletter subscriber export
- [ ] SEO fields on all content types
- [ ] Multi-language content fields (EN + AR)
- [ ] Hero slider management (drag-to-reorder, active toggle)
- [ ] Gallery management
- [ ] Testimonial management
- [ ] Client logo management
- [ ] Site settings panel (phone, address, announcements, thresholds)
- [ ] Dashboard analytics (product count, orders, enquiries, subscribers)

---

## 8. DESIGN TOKENS

```
Colors:
  Primary:      #0D6B8C   (teal/medical blue — trust, healthcare)
  Primary Dark: #09505F
  Accent:       #00B4D8   (bright teal — CTAs, badges)
  Gold:         #E8A100   (sale badges, highlights)
  Dark:         #1A1A2E   (text, header)
  Light BG:     #F7F9FC   (page background)
  White:        #FFFFFF
  Border:       #E2E8F0
  Error:        #EF4444
  Success:      #22C55E

Typography:
  Display:  "Plus Jakarta Sans" (headings)
  Body:     "Inter" (UI text, descriptions)
  Arabic:   "Cairo" (RTL content)

Spacing Scale: 4px base (4/8/12/16/24/32/48/64/96px)
Border Radius: 8px cards, 4px buttons, 2px inputs
Shadows: subtle card shadow (0 2px 8px rgba(0,0,0,0.08))

Breakpoints:
  Mobile:  < 640px
  Tablet:  640px – 1024px
  Desktop: > 1024px
```

---

## 9. INTEGRATIONS SUMMARY

| Service | Purpose | Notes |
|---|---|---|
| Cloudinary | Image hosting & CDN | Already in use on reference site |
| Tabby | BNPL payment | Middle East focused |
| Tamara | BNPL payment | UAE/Saudi market |
| Network International | Card payments | UAE card gateway |
| Google Maps | Store locations embed | Static embed key |
| Instagram Basic API | Feed display | Or use Behold/Elfsight widget |
| WhatsApp Business | Float button + links | `wa.me/` deep links |
| SendGrid / Resend | Transactional email | Order confirm, newsletters |
| Algolia (optional) | Advanced product search | Or Django Haystack |
| Google Analytics | Traffic analytics | GA4 |

---

## 10. FOLDER STRUCTURE SUGGESTION (Next.js)

```
/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                  ← Home
│   │   ├── products/
│   │   │   ├── page.tsx              ← All Categories
│   │   │   ├── category/[slug]/page.tsx
│   │   │   ├── brand/[slug]/page.tsx
│   │   │   ├── collection/[slug]/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   └── [slug]/page.tsx       ← Product Detail
│   │   ├── blog/
│   │   ├── about-us/page.tsx
│   │   ├── contact/page.tsx
│   │   └── ...
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx              ← Dashboard
│   │       ├── products/
│   │       ├── orders/
│   │       ├── blog/
│   │       ├── settings/
│   │       └── ...
│   └── api/
│       ├── products/route.ts
│       ├── auth/route.ts
│       └── ...
├── components/
│   ├── layout/ (Navbar, Footer, Sidebar)
│   ├── home/ (HeroSlider, CategoryGrid, ProductRow, etc.)
│   ├── product/ (ProductCard, ProductGallery, ReviewSection)
│   ├── cart/ (CartDrawer, CartItem)
│   ├── admin/ (DataTable, RichTextEditor, ImageUpload)
│   └── ui/ (Button, Badge, Modal, Toast, etc.)
├── lib/
│   ├── api.ts         ← API client
│   ├── auth.ts
│   └── cloudinary.ts
├── types/
│   └── index.ts
└── public/
```

---

*Spec generated from: https://web-production-5e010.up.railway.app/*
*Purpose: Full AI-build blueprint for JKR International–style medical equipment e-commerce platform with admin panel*
