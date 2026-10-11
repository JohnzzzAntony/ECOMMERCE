# DESIGN.md: Ferm Living (fermliving.com)

## Source
- URL: https://fermliving.com/
- Capture date: 2026-10-11
- Evidence: Firecrawl `branding` + `markdown` scrape, full-page screenshot, computed styles read in a live browser
- Artifacts (local only, git-ignored): `.firecrawl/ferm-branding.json`, `.firecrawl/ferm.md`, `.firecrawl/ferm-screenshot.png`

## Reference Screenshot
![Full-page screenshot of fermliving.com](./.firecrawl/ferm-screenshot.png)

Use the screenshot for layout, hierarchy, density and feel. Only the *design language* is reproduced in this store;
Ferm Living's logo, photography, product names and copy are theirs and are not copied.

## Design Summary
Quiet Scandinavian editorial retail. A warm off-white canvas, charcoal text, a refined display serif for headlines
and a plain sans for everything else. Photography carries the page: full-bleed hero images with a large serif headline
and an outlined button, horizontally scrolling product/image rows, split image + text stories, a dense grid of
category links and a `#livingwithferm` social strip. No shadows, no rounded corners, almost no colour except a red
used sparingly for sale messaging.

## Design Tokens

### Colors (observed)
| Role | Value |
|---|---|
| Background | `#FFFEFA` (warm off-white; footer uses the same) |
| Text / ink | `#383838` |
| Muted text / links | `#6B7280` |
| Sale / accent red | `#E6352A` |
| Sale tint | `#FFEBEA` |
| Surface (image placeholders, cards) — inferred | `#F3F1EA` |
| Borders — inferred | `#E4E1D8` |
| On-image text & outlined buttons | `#FFFEFA` |

### Typography
- Headings: **Canela** (commercial serif), weight 500, h2 32px/40px. Free stand-in used here: **Newsreader**.
- Body: **Teka** (commercial sans), 16px/24px, weight 400. Free stand-in: **DM Sans**.
- Hero headlines are very large (≈64–96px desktop), sentence case, tight leading (~1.05).
- Small labels and nav: 13–14px sans, regular weight, no heavy uppercase tracking.

### Spacing And Layout
- 4px base unit. Sections ≈ 48–96px apart; product rows have 24px top/bottom padding.
- Content gutters ≈ 24–32px; images are often edge-to-edge.
- Radius **0** everywhere (buttons, images, cards). No shadows.
- Product/image rows: horizontal scroll, ~4.3 cards visible on desktop, ~1.5 on mobile; 3:4 portrait images.

## Components
- **Announcement bar**: thin, centered, rotating messages (offer, shipping, delivery), small sans text.
- **Header**: transparent over the homepage hero (light logo/text), solid off-white after scroll and on inner pages.
  Logo left, primary nav (Shop · Inspiration · Rooms · Professionals · New Collection) with mega menus, search,
  wishlist, cart, login on the right.
- **Buttons**: transparent with 1px border in the text colour, square, 14–15px sans, ~12px × 20px padding.
  Text links with underline for secondary CTAs ("Discover Now", "Shop Accessories").
- **Hero with CTA**: full-bleed photo, headline bottom-left in serif, outlined button below.
- **Product card**: image on soft neutral, no border; name and price in small sans beneath; wishlist heart on image.
- **Split feature**: large photo on one side, serif headline + short copy + text link on the other.
- **Category link grid**: many short labels (Kids Toys, Lighting, Vases…) in bold sans arranged in columns.
- **Social strip**: `#livingwithferm` heading over a row of square images.
- **Footer**: same off-white background, newsletter sign-up in serif, link columns (Our World, Customer Service…),
  small legal row.

## Page Patterns
Homepage order: announcement → transparent header → hero with CTA → product slider → split feature → image slider →
second hero with CTA → product slider → category link grid → social strip → footer.
Mobile: stacked; sliders keep horizontal scroll; header collapses to menu/logo/cart.

## Content Style
Calm, confident and brief. Headlines are short phrases ("The Finishing Touches"). CTAs are two words:
"Shop Now", "Discover Now", "Explore Now", "Shop Accessories".

## Agent Build Instructions (as implemented in this repo)
- Tokens live in `CORE_SETTINGS` (`src/shared/theme.ts`); every value is editable in Admin → Themes → Customize.
- `header_style` / `footer_style` = `editorial` switch the header and footer to this layout; `header_transparent`
  overlays the header on the homepage hero.
- Homepage sections added for this layout: `image_banner`, `split_feature`, `link_grid`, `product_slider`.
  Each has its own content settings (images, headings, links) plus the shared style settings.
- Headline weight is the `heading_weight` setting (`--theme-heading-weight`).

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://fermliving.com/
target_stack: Next.js + Tailwind v4 theme system (this repo)
output: DESIGN.md
