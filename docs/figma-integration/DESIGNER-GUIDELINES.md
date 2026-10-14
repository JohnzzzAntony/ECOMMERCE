# Designing in Figma for your NexEcoms store

NexEcoms copies your Figma frames into your store as editable pages. These guidelines make imports accurate and
keep pages fast, accessible and easy to edit afterwards.

## 1. One frame per page and device

- Put each page in a **top-level frame** (directly on the canvas, or inside a section).
- Name frames `Page / Device`:
  - `Home / Desktop`, `Home / Mobile`, `About us / Tablet`
  - or a suffix: `Home @mobile`
- Without a device in the name, the width decides: **1200 px and wider = desktop**, **768–1199 = tablet**,
  **767 and narrower = mobile**. Frames with the same name at different widths are paired automatically.
- Design desktop first; tablet and mobile frames only need what differs (text, images, layout). Matching sections
  are paired by order, so keep sections in the same order across devices.

## 2. Build pages from sections

Each direct child of a page frame becomes one section. Name it `Section/<type>` to choose the template
explicitly:

| Name | Section |
|---|---|
| `Section/announcement-bar` | Thin message bar |
| `Section/hero`, `Section/hero-slideshow` | Big heading, image, buttons / rotating slides |
| `Section/image-with-text`, `Section/rich-text` | Image beside text / text only |
| `Section/feature-grid`, `Section/testimonials`, `Section/logo-cloud`, `Section/gallery`, `Section/faq` | Repeated items |
| `Section/collection-list`, `Section/product-grid` | Catalogue collections / products |
| `Section/newsletter`, `Section/cta-banner`, `Section/video`, `Section/spacer` | Sign-up, call to action, video, space |

Unnamed sections are recognised by shape (for example: full-width first frame with a large heading and an image →
hero; repeated cards with prices → product grid; questions ending in “?” → FAQ). Anything not recognised is kept
as a **freeform** section that looks like your design but is less flexible — name it to avoid that.

### Name the important layers

Inside a section, name layers to say which field they fill:

- `{{title}}`, `{{subtitle}}`, `{{body}}`, `{{eyebrow}}` — text
- `{{image}}` — the main image
- `{{cta}}` — the main button
- `Block/<type>` — repeated items (e.g. `Block/feature`, `Block/question`, `Block/slide`)

## 3. Use auto layout

Auto layout becomes responsive CSS (direction, gap, padding, alignment, wrap, fill/hug/fixed sizing). Frames
without auto layout are placed with fixed positions and are flagged **NO_AUTO_LAYOUT** — they won't adapt well to
other screen sizes.

## 4. Commerce sections show live data

Product grids, product details, collection lists and the cart always show your **real catalogue**. Design one or
two example cards; their names and prices are placeholders. The number of cards in the first row sets the
column count.

Page types you choose when importing: Home, Content page (with its own URL), Product template (used for every
product page), Collection template, Cart, Header and Footer (shared by all pages).

## 5. Text and styles

- Use **text styles** and **colour styles** (e.g. `Brand/Primary`, `Heading/H1`). They become your store's design
  tokens with the same names; unstyled values are grouped automatically.
- Bold, italic, underline and links inside text are kept.
- Make the page's main heading the hero title — it becomes the page's single **H1**.
- Keep text readable: body text needs **4.5:1** contrast with its background (3:1 for 24 px+). Low contrast is
  flagged **LOW_CONTRAST**.

## 6. Fonts

- **Google Fonts** are hosted by NexEcoms automatically.
- Any other font must be uploaded in Admin → Design system → Fonts, and **you are responsible for having a web
  licence** for it. Until then a similar system font is used and the import shows **MISSING_FONT**.

## 7. Images and icons

- Use image fills on rectangles or frames; export-quality originals (up to 4096 px) are best.
- Icons and logos made of vectors are exported as SVG automatically.
- Name image layers descriptively (`Nurse helping a patient`) — the name becomes the starting alt text. Generic
  names (`Rectangle 12`, `Image`) give none and the page can't be published until alt text is added (or the image
  is marked decorative).

## 8. Prototype links

Prototype connections between imported frames become links between store pages. External URL actions become
links that open safely. Links to frames you don't import must be set in the editor before publishing.

## 9. After importing

Nothing goes live automatically. Review the mapped sections (change types or remap layers if needed), install,
edit in the page editor, then publish each page. When you change the Figma file later, the store shows
**Updates available**; re-syncing keeps every edit made in NexEcoms unless you choose to take the Figma version.
