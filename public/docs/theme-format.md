# Theme packages

Admin → **Themes** → **Add a theme** accepts a `.zip` in one of two forms.

| Kind | What's in the zip | What you can edit afterwards |
|---|---|---|
| **Native theme** | `theme.json` + CSS + assets (+ optional pages) | All theme settings (colors, fonts, radius, logo, header, footer, plus the theme's own settings), homepage sections, custom CSS, menus, pages |
| **HTML template** (ThemeForest, Envato, TemplateMonster…) | `.html` pages + CSS/images/fonts | Each HTML page (Pages section), the template CSS (Customize → Custom CSS), the homepage layout, the store colors and fonts used on shop pages |

**WordPress** (`style.css` with `Theme Name:`, `.php`) and **Shopify** (`.liquid`) themes need their own server
platforms and are rejected. Most marketplace themes ship an HTML version, so upload that one.

Export any installed theme (Themes → Export) to get a working native package to start from.

## Native package

```
my-theme.zip
├── theme.json
├── assets/
│   ├── theme.css
│   └── hero.jpg
└── pages/
    └── about.html
```

### theme.json

```json
{
  "name": "Aurora",
  "version": "1.0.0",
  "author": "Studio Name",
  "description": "Clean, airy storefront.",
  "css": ["assets/theme.css"],
  "settings_schema": [
    { "id": "color_primary", "type": "color", "label": "Primary", "group": "Colors", "default": "#6D28D9",
      "var": ["--brand-teal", "--primary", "--ring"] },
    { "id": "hero_overlay", "type": "range", "label": "Hero overlay", "group": "Hero",
      "default": 40, "min": 0, "max": 90, "unit": "%", "var": "--hero-overlay" },
    { "id": "promo_image", "type": "image", "label": "Promo image", "group": "Hero", "default": "assets/hero.jpg" }
  ],
  "settings": { "logo_text": "Aurora", "announcement_text": "Free shipping this week" },
  "sections": [
    { "type": "hero" },
    { "type": "categories", "settings": { "eyebrow": "Browse", "title": "Shop by category" } },
    { "type": "rich_text", "settings": { "title": "Our story", "html": "<p>Since 1998…</p>" } },
    { "type": "page", "settings": { "page": "about" } },
    { "type": "newsletter" }
  ],
  "menus": {
    "main": [
      { "label": "Shop", "link": "view:products" },
      { "label": "Categories", "link": "mega:categories" },
      { "label": "About", "link": "page:about" }
    ],
    "footer": [
      { "label": "Help", "link": "", "children": [
        { "label": "Contact", "link": "view:contact" },
        { "label": "FAQ", "link": "view:faq" }
      ] }
    ]
  },
  "pages": [
    { "slug": "about", "title": "About us", "file": "pages/about.html" },
    { "slug": "landing", "title": "Landing", "file": "pages/landing.html", "layout": "isolated", "hide_header_footer": true }
  ]
}
```

Only `name` is required. Menus from the package replace the store menus when the theme is installed with **Publish after install** on.

### Settings

Every theme gets the built-in settings below. A theme can add its own, or redefine one by reusing its `id`.

| id | type | Drives |
|---|---|---|
| `color_primary`, `color_primary_dark`, `color_accent`, `color_highlight`, `color_text`, `color_background`, `color_surface`, `color_tint`, `color_border` | color | Store color tokens |
| `font_body`, `font_heading` | select | `--theme-font-body`, `--theme-font-heading` |
| `radius` | range (px) | `--radius` |
| `logo_url`, `logo_badge`, `logo_text`, `logo_tagline` | image / text | Header and footer logo |
| `show_announcement`, `announcement_text` | checkbox / text | Header announcement bar |
| `show_footer_newsletter`, `footer_about`, `show_payment_badges`, `copyright_text` | | Footer |
| `hide_chrome_on_home` | checkbox | Hide store header/footer on the homepage |

Setting fields: `id` (lowercase, `a-z0-9_`), `type` (`color`, `text`, `textarea`, `image`, `select`, `checkbox`, `range`),
`label`, optional `group`, `default`, `help`, `options` (`[{ "value", "label" }]` for select), `min`/`max`/`step`/`unit` (range),
and `var`: one or more CSS custom properties that receive the value. Use those variables in your CSS:

```css
.hero::after { background: rgb(0 0 0 / var(--hero-overlay)); }
```

Store color tokens you can target: `--brand-teal` (primary), `--brand-teal-dark`, `--brand-cyan` (accent),
`--brand-gold` (highlight), `--brand-ink` (text), `--brand-bg`, `--background`, `--foreground`, `--primary`,
`--secondary`, `--accent`, `--muted`, `--border`, `--radius`.

### Homepage sections

`hero`, `trust_bar`, `categories`, `featured`, `banner`, `collections`, `new_arrivals`, `best_sellers`, `on_sale`,
`features`, `testimonials`, `clients`, `blog`, `newsletter`, `instagram`, `gallery`, `rich_text`, `page`.

Section settings: `eyebrow`, `title` (most sections); `banner` adds `text`, `button_label`, `link`; `newsletter` uses
`title`, `text`; `rich_text` uses `title`, `html`; `page` uses `page` (a page slug).

### Links (menus, banner)

`view:<home|products|offers|blog|about|contact|store-locations|faq|shipping-info|terms|privacy|track-order|wishlist|compare|cart|profile>`,
`page:<slug>`, `category:<slug>`, `brand:<slug>`, `collection:<slug>`, `product:<slug>`, `blog:<slug>`,
`mega:categories|brands|collections` (header dropdown from the live catalog), or a URL (`https://…`, `/path`, `mailto:`, `tel:`).

### Pages

`layout: "standard"` renders inside the store with the theme's styles (HTML is sanitized: no scripts or forms).
`layout: "isolated"` renders in a sandboxed frame with only the page's own `<style>` and, for HTML templates, the template CSS.
Link between pages with `/?page=<slug>` or the original `.html` file name (rewritten on install).

## HTML templates

On install:

- every `.html` file (outside `documentation/`, `docs/`) becomes an isolated page; `index.html` becomes the `home` page and the homepage
- linked local stylesheets are combined into the theme CSS; remote ones (Google Fonts, CDNs) are kept as `@import`
- images, fonts and videos referenced from HTML or CSS are uploaded to the media library and links are rewritten
- links between the template's pages keep working (`about.html` → `/?page=about`)
- **JavaScript is not run.** Sliders, carousels, tabs and scroll animations show their static content. Common
  preloaders and reveal-on-scroll classes are made visible by a small CSS block at the end of the theme CSS.

Limits: zip ≤ 60 MB, ≤ 250 MB extracted, ≤ 80 pages, ≤ 600 referenced assets (25 MB each).
