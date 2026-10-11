// Product catalogue ⇄ spreadsheet.
//
// Export writes every product field as one row. Import reads the same layout (or a customer's own
// sheet with similar headers) and upserts:
//   • a row is matched to an existing product by ID → SKU → Slug → exact Name, so re-importing never duplicates;
//   • matched products are overwritten with the sheet's values, unmatched rows become new products;
//   • a column that is missing from the sheet is left untouched; a blank cell clears that field
//     (except ID/SKU/Slug, which are identifiers and are kept);
//   • categories ("Parent > Child > …", any depth), brands and collections are looked up by name and created if new;
//   • a column the store doesn't know becomes a custom product field (ProductField) automatically, and its
//     cells are stored in Product.attributes. Empty cells simply leave the field empty (hidden on the storefront).
// `planImport` is pure (no DB writes) so the admin can preview the result before applying it.
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from './db'
import { failure, HttpError } from './auth'
import { slugify } from './slug'
import type { Grid, SheetColumn } from './spreadsheet'

type Kind = 'id' | 'text' | 'number' | 'int' | 'bool' | 'list' | 'category' | 'readonly'

interface ProductColumn extends SheetColumn {
  key: string
  kind: Kind
  max?: number
  /** Value used for an empty cell when the field cannot be null. */
  blank?: number
  aliases?: string[]
  help: string
}

export const LIST_SEPARATOR = ' | '

export const PRODUCT_COLUMNS: ProductColumn[] = [
  { key: 'id', header: 'ID', kind: 'id', width: 28, readOnly: true, help: 'Internal ID from the export. Keep it to update that exact product; clear it to add the row as a new product.' },
  { key: 'sku', header: 'SKU', kind: 'id', width: 20, aliases: ['sku code', 'item code', 'product code', 'code'], help: 'Your product code. Used to match existing products when there is no ID. Generated if empty for new products.' },
  { key: 'name', header: 'Name', kind: 'text', max: 500, width: 40, required: true, aliases: ['product name', 'product', 'title', 'item name'], help: 'Required for new products.' },
  { key: 'slug', header: 'Slug', kind: 'id', width: 30, aliases: ['url', 'url key', 'handle'], help: 'Web address part, e.g. folding-wheelchair. Generated from the name if empty.' },
  { key: 'nameAr', header: 'Name (Arabic)', kind: 'text', max: 300, width: 30, aliases: ['arabic name', 'name ar'], help: 'Arabic product name.' },
  { key: 'shortDescription', header: 'Short Description', kind: 'text', max: 10000, width: 40, aliases: ['summary', 'short desc', 'features'], help: 'One line shown on product cards.' },
  { key: 'description', header: 'Description', kind: 'text', max: 30000, width: 60, aliases: ['long description', 'full description', 'overview', 'details'], help: 'Full product description.' },
  { key: 'descriptionAr', header: 'Description (Arabic)', kind: 'text', max: 30000, width: 40, aliases: ['arabic description', 'description ar'], help: 'Arabic description.' },
  { key: 'specifications', header: 'Specifications', kind: 'text', max: 30000, width: 50, aliases: ['specs', 'technical information', 'tech info', 'technical specifications'], help: 'One per line as "Label: Value", or JSON.' },
  { key: 'regularPrice', header: 'Regular Price', kind: 'number', width: 14, required: true, aliases: ['price', 'regular price aed', 'price aed', 'mrp', 'list price', 'unit price'], help: 'Required. Number in AED, e.g. 1250 or 1250.50.' },
  { key: 'salePrice', header: 'Sale Price', kind: 'number', width: 14, aliases: ['sale price aed', 'offer price', 'discount price', 'special price'], help: 'Must be lower than Regular Price. Leave empty if not on sale.' },
  { key: 'onSale', header: 'On Sale', kind: 'bool', width: 10, aliases: ['sale'], help: 'TRUE or FALSE. TRUE needs a Sale Price.' },
  { key: 'stockQty', header: 'Stock Qty', kind: 'int', blank: 0, width: 11, aliases: ['stock', 'quantity', 'qty', 'stock quantity', 'inventory'], help: 'Whole number, 0 or more. Empty = 0.' },
  { key: 'inStock', header: 'In Stock', kind: 'bool', width: 10, aliases: ['available', 'availability'], help: 'TRUE or FALSE. Empty = TRUE.' },
  { key: 'category', header: 'Category', kind: 'category', width: 34, aliases: ['category path', 'sub category', 'subcategory'], help: 'Use "Parent > Child > …" (any depth, e.g. Health & Beauty > Perfumes) or one name. New categories are created.' },
  { key: 'brand', header: 'Brand', kind: 'text', max: 120, width: 18, aliases: ['manufacturer', 'make'], help: 'Brand name. New brands are created.' },
  { key: 'collections', header: 'Collections', kind: 'list', width: 30, aliases: ['collection', 'tags'], help: 'Separate several with |  e.g. Featured | On Sale. New collections are created.' },
  { key: 'isFeatured', header: 'Featured', kind: 'bool', width: 10, aliases: ['is featured'], help: 'TRUE or FALSE.' },
  { key: 'isExclusive', header: 'Exclusive', kind: 'bool', width: 10, aliases: ['is exclusive'], help: 'TRUE or FALSE.' },
  { key: 'badge', header: 'Badge', kind: 'text', max: 60, width: 12, aliases: ['label', 'ribbon'], help: 'Short label such as New or Best Seller.' },
  { key: 'images', header: 'Images', kind: 'list', width: 60, aliases: ['image', 'image url', 'image urls', 'images url', 'photo', 'photos', 'picture', 'pictures', 'image public id'], help: 'Image URLs separated by |  The first is the main image. A Cloudinary public ID also works.' },
  { key: 'barcode', header: 'Barcode', kind: 'text', max: 100, width: 16, aliases: ['ean', 'upc', 'gtin'], help: 'EAN/UPC barcode.' },
  { key: 'metaTitle', header: 'SEO Title', kind: 'text', max: 500, width: 30, aliases: ['meta title'], help: 'Search engine title.' },
  { key: 'metaDescription', header: 'SEO Description', kind: 'text', max: 5000, width: 40, aliases: ['meta description'], help: 'Search engine description.' },
  { key: 'metaKeywords', header: 'SEO Keywords', kind: 'text', max: 2000, width: 30, aliases: ['meta keywords', 'keywords'], help: 'Comma separated keywords.' },
  { key: 'ratingAvg', header: 'Rating (read-only)', kind: 'readonly', width: 12, readOnly: true, aliases: ['rating'], help: 'From customer reviews. Ignored on import.' },
  { key: 'ratingCount', header: 'Reviews (read-only)', kind: 'readonly', width: 12, readOnly: true, aliases: ['reviews', 'review count'], help: 'Ignored on import.' },
  { key: 'createdAt', header: 'Created (read-only)', kind: 'readonly', width: 22, readOnly: true, aliases: ['created'], help: 'Ignored on import.' },
  { key: 'updatedAt', header: 'Updated (read-only)', kind: 'readonly', width: 22, readOnly: true, aliases: ['updated'], help: 'Ignored on import.' },
]

// Product columns that map 1:1 to a Product scalar.
const SCALARS = ['sku', 'name', 'nameAr', 'shortDescription', 'description', 'descriptionAr', 'specifications', 'regularPrice', 'salePrice', 'onSale', 'stockQty', 'inStock', 'isFeatured', 'isExclusive', 'badge', 'barcode', 'metaTitle', 'metaDescription', 'metaKeywords'] as const
type Scalar = (typeof SCALARS)[number]
const BOOL_DEFAULTS: Record<string, boolean> = { onSale: false, inStock: true, isFeatured: false, isExclusive: false }

// ─── Catalogue snapshot ───────────────────────────────────────────────────

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  category: { include: { parent: true } },
  brand: true,
  collections: { include: { collection: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude
type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>

export async function loadCatalog() {
  const [products, categories, brands, collections, fields] = await Promise.all([
    db.product.findMany({ include: productInclude, orderBy: { name: 'asc' } }),
    db.category.findMany({ select: { id: true, name: true, slug: true, parentId: true } }),
    db.brand.findMany({ select: { id: true, name: true, slug: true } }),
    db.collection.findMany({ select: { id: true, name: true, slug: true } }),
    db.productField.findMany({ select: { id: true, slug: true, label: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
  ])
  return { products, categories, brands, collections, fields }
}
export type Catalog = Awaited<ReturnType<typeof loadCatalog>>

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** "Parent > Child > Leaf" for a category id, walking up the tree. */
function pathOf(categories: Catalog['categories'], id: string | null): string | null {
  if (!id) return null
  const byId = new Map(categories.map((c) => [c.id, c]))
  const names: string[] = []
  for (let c = byId.get(id); c && names.length < 20; c = c.parentId ? byId.get(c.parentId) : undefined) names.unshift(c.name)
  return names.join(' > ') || null
}

export function parseAttributes(json: string | null | undefined): Record<string, string> {
  try {
    const v = JSON.parse(json || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string> : {}
  } catch { return {} }
}

// ─── Export ───────────────────────────────────────────────────────────────

/** Standard columns followed by one column per custom product field. */
export function exportColumns(catalog: Pick<Catalog, 'fields'>): SheetColumn[] {
  return [...PRODUCT_COLUMNS, ...catalog.fields.map((f) => ({ header: f.label, width: 24 }))]
}

export function exportRows(catalog: Catalog) {
  return catalog.products.map((p) => {
    const attrs = parseAttributes(p.attributes)
    return [...standardCells(p, catalog), ...catalog.fields.map((f) => attrs[f.slug] ?? null)]
  })
}

function standardCells(p: CatalogProduct, catalog: Catalog) {
  return PRODUCT_COLUMNS.map((c): string | number | boolean | null => {
    switch (c.key) {
      case 'category': return pathOf(catalog.categories, p.categoryId)
      case 'brand': return p.brand?.name ?? null
      case 'collections': return p.collections.map((cp) => cp.collection.name).join(LIST_SEPARATOR) || null
      case 'images': return p.images.map((i) => i.imageUrl).join(LIST_SEPARATOR) || null
      case 'createdAt': return p.createdAt.toISOString()
      case 'updatedAt': return p.updatedAt.toISOString()
      default: return (p as unknown as Record<string, string | number | boolean | null>)[c.key] ?? null
    }
  })
}

/** Rows for the "Instructions" sheet. */
export function instructionRows(catalog: Catalog) {
  const rows: (string | null)[][] = [
    ['How importing works', ''],
    ['Matching', 'Each row is matched to an existing product by ID, then SKU, then Slug, then exact Name. Matches are updated (overwritten); other rows are added as new products. Nothing is duplicated.'],
    ['Bulk edit', 'Export, edit the cells you want in Excel, then import the same file.'],
    ['Missing columns', 'You may delete columns you do not need; those fields are left unchanged.'],
    ['Empty cells', 'An empty cell clears that field (ID, SKU and Slug are kept). Read-only columns are ignored.'],
    ['Lists', 'Images and Collections take several values separated by |'],
    ['Extra columns', 'Any other column becomes a custom product field (created automatically) and its values are saved. Empty cells leave that field empty; it is hidden on the website and can be filled in later from the admin.'],
    ['', ''],
    ['Column', 'What to enter'],
    ...PRODUCT_COLUMNS.map((c) => [c.header + (c.required ? ' *' : ''), c.help]),
    ['', ''],
    ['Existing categories', ''],
    ...catalog.categories.map((c) => pathOf(catalog.categories, c.id) ?? c.name).sort().map((path) => [path, null]),
    ['', ''],
    ['Existing brands', catalog.brands.map((b) => b.name).sort().join(', ')],
    ['Existing collections', catalog.collections.map((c) => c.name).sort().join(LIST_SEPARATOR)],
    ['Custom fields', catalog.fields.map((f) => f.label).join(', ') || '(none yet)'],
  ]
  return rows
}

// ─── Import: parse + plan ─────────────────────────────────────────────────

const headerKey = (h: string) => h.toLowerCase().replace(/\(read-only\)/g, '').replace(/[^a-z0-9]/g, '')
const HEADER_INDEX = new Map<string, ProductColumn>()
for (const c of PRODUCT_COLUMNS) for (const h of [c.header, c.key, ...(c.aliases ?? [])]) HEADER_INDEX.set(headerKey(h), c)

const TRUE = new Set(['true', 'yes', 'y', '1', 'on', 't'])
const FALSE = new Set(['false', 'no', 'n', '0', 'off', 'f'])
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME

/** Undo the CSV formula guard added on export (see spreadsheet.ts) and Excel's text marker before numbers ('402306). */
const unguard = (s: string) => s.replace(/^'(?=[=+\-@\d])/, '')

export interface RowPlan {
  row: number // spreadsheet row number (header = 1)
  action: 'create' | 'update' | 'unchanged' | 'error'
  label: string
  productId?: string
  errors: string[]
  changes: string[]
  scalars: Partial<Record<Scalar | 'slug', string | number | boolean | null>>
  category?: string[] | null // path from top level to leaf; null = clear; undefined = untouched
  brand?: string | null
  collections?: string[]
  images?: string[]
  /** Custom field values by field slug; null clears. */
  attributes?: Record<string, string | null>
}

export interface ImportPlan {
  columns: string[]
  ignoredColumns: string[]
  /** Custom fields this file introduces (created on apply). */
  newFields: { slug: string; label: string }[]
  rows: RowPlan[]
}

/** A sheet column that is a custom product field. */
interface FieldColumn { field: { slug: string; label: string } }

function parseValue(col: ProductColumn, raw: string, errors: string[]) {
  const v = unguard(raw)
  switch (col.kind) {
    case 'number':
    case 'int': {
      if (v === '') return col.blank ?? null
      const n = Number(v.replace(/aed|,|\s/gi, ''))
      if (!Number.isFinite(n) || n < 0 || (col.kind === 'int' && !Number.isInteger(n))) {
        errors.push(`${col.header} "${raw}" is not a valid ${col.kind === 'int' ? 'whole number' : 'number'}`)
        return undefined
      }
      return n
    }
    case 'bool': {
      if (v === '') return BOOL_DEFAULTS[col.key] ?? false
      const s = v.toLowerCase()
      if (TRUE.has(s)) return true
      if (FALSE.has(s)) return false
      errors.push(`${col.header} must be TRUE or FALSE (got "${raw}")`)
      return undefined
    }
    case 'list':
      return v.split(/\s*[|\n]\s*/).map((s) => s.trim()).filter(Boolean)
    default:
      if (v === '') return null
      if (col.max && v.length > col.max) { errors.push(`${col.header} is longer than ${col.max} characters`); return undefined }
      return v
  }
}

function imageUrl(value: string, errors: string[]) {
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value
  if (CLOUD && /^[\w\-./]+$/.test(value)) return `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto/${value}`
  errors.push(`Image "${value.slice(0, 60)}" is not a URL`)
  return null
}

function uniqueIn(used: Set<string>, base: string) {
  const root = slugify(base) || 'product'
  let slug = root
  for (let i = 2; used.has(slug); i++) slug = `${root}-${i}`
  used.add(slug)
  return slug
}

// Cells come back trimmed and with \n line endings, so compare text the same way.
const tidy = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() || null : v ?? null)
const same = (a: unknown, b: unknown) => tidy(a) === tidy(b)

export function planImport(grid: Grid, catalog: Catalog): ImportPlan {
  const [header = [], ...body] = grid
  const cols: (ProductColumn | null)[] = header.map((h) => (h ? HEADER_INDEX.get(headerKey(h)) ?? null : null))

  // Unknown headers → existing custom field with that name, or a new one.
  const fieldByKey = new Map<string, { slug: string; label: string }>()
  for (const f of catalog.fields) { fieldByKey.set(headerKey(f.label), f); fieldByKey.set(headerKey(f.slug), f) }
  const usedFieldSlugs = new Set(catalog.fields.map((f) => f.slug))
  const newFields: { slug: string; label: string }[] = []
  const custom: (FieldColumn | null)[] = header.map((h, i) => {
    if (cols[i] || !h?.trim() || !headerKey(h)) return null
    let field = fieldByKey.get(headerKey(h))
    if (!field) {
      field = { slug: uniqueIn(usedFieldSlugs, h), label: h.trim().slice(0, 120) }
      fieldByKey.set(headerKey(h), field)
      newFields.push(field)
    }
    return { field }
  })
  const ignoredColumns = header.filter((h, i) => h?.trim() && !cols[i] && !custom[i])
  const seenCols = new Set<string>()
  header.forEach((h, i) => {
    const key = cols[i]?.key ?? (custom[i] ? `attr:${custom[i]!.field.slug}` : null)
    if (!key) return
    if (seenCols.has(key)) throw new HttpError(400, `Column "${h}" appears twice`)
    seenCols.add(key)
  })
  if (!['id', 'sku', 'slug', 'name'].some((k) => seenCols.has(k))) {
    throw new HttpError(400, 'The first row must contain column headers, including at least one of: ID, SKU, Slug or Name. Tip: export the catalogue to get the right layout.')
  }
  if (body.length > 10000) throw new HttpError(400, 'Import at most 10,000 rows at a time')

  const byId = new Map(catalog.products.map((p) => [p.id, p]))
  const bySlug = new Map(catalog.products.map((p) => [p.slug, p]))
  const byName = new Map<string, CatalogProduct[]>()
  for (const p of catalog.products) byName.set(norm(p.name), [...(byName.get(norm(p.name)) ?? []), p])
  const newRowByName = new Map<string, number>() // new products in this file, to catch repeats
  const bySku = new Map<string, CatalogProduct[]>()
  for (const p of catalog.products) if (p.sku) bySku.set(norm(p.sku), [...(bySku.get(norm(p.sku)) ?? []), p])
  const usedSlugs = new Set(catalog.products.map((p) => p.slug))
  const skuOwner = new Map<string, string>() // normalised sku → product id or "row:N"
  for (const p of catalog.products) if (p.sku) skuOwner.set(norm(p.sku), p.id)
  const rowOfProduct = new Map<string, number>()

  const rows: RowPlan[] = []
  body.forEach((cells, i) => {
    const rowNo = i + 2
    if (!cells.some((c) => c && c.trim())) return
    const errors: string[] = []
    const values = new Map<string, unknown>()
    cols.forEach((col, ci) => {
      if (!col || col.kind === 'readonly') return
      const raw = (cells[ci] ?? '').trim()
      if (col.kind === 'id') { if (raw) values.set(col.key, unguard(raw)); return }
      const parsed = parseValue(col, raw, errors)
      if (parsed !== undefined) values.set(col.key, parsed)
    })

    // Match an existing product: ID → SKU → Slug.
    const id = values.get('id') as string | undefined
    const sku = values.get('sku') as string | undefined
    const slugCell = values.get('slug') as string | undefined
    let product: CatalogProduct | undefined
    if (id) {
      product = byId.get(id)
      if (!product) errors.push(`No product has ID "${id}". Clear the ID cell to add this row as a new product.`)
    } else if (sku && bySku.has(norm(sku))) {
      const matches = bySku.get(norm(sku))!
      if (matches.length > 1) errors.push(`SKU "${sku}" is used by ${matches.length} products; add the ID column to choose one`)
      else product = matches[0]
    } else if (slugCell && bySlug.has(slugify(slugCell))) {
      product = bySlug.get(slugify(slugCell))
    } else if (!sku && typeof values.get('name') === 'string') {
      // Last resort for sheets without ID/SKU: an exact, unambiguous name match.
      const matches = byName.get(norm(values.get('name') as string)) ?? []
      if (matches.length === 1) product = matches[0]
      else if (matches.length > 1) errors.push(`${matches.length} products are named "${values.get('name')}"; add an ID or SKU column to choose one`)
    }
    if (product) {
      const earlier = rowOfProduct.get(product.id)
      if (earlier) errors.push(`Same product as row ${earlier}; each product may appear only once`)
      else rowOfProduct.set(product.id, rowNo)
    } else if (!id && !sku && typeof values.get('name') === 'string') {
      const key = norm(values.get('name') as string)
      const earlier = newRowByName.get(key)
      if (earlier) errors.push(`Same new product as row ${earlier}; each product may appear only once`)
      else newRowByName.set(key, rowNo)
    }

    const attributes: Record<string, string | null> = {}
    custom.forEach((c, ci) => {
      if (!c) return
      const raw = unguard((cells[ci] ?? '').trim())
      attributes[c.field.slug] = raw ? raw.slice(0, 10000) : null
    })

    const plan: RowPlan = {
      row: rowNo,
      action: product ? 'update' : 'create',
      label: (values.get('name') as string) || product?.name || sku || slugCell || `Row ${rowNo}`,
      productId: product?.id,
      errors,
      changes: [],
      scalars: {},
    }

    // Scalars
    for (const key of SCALARS) {
      if (!values.has(key) || key === 'sku') continue
      plan.scalars[key] = values.get(key) as string | number | boolean | null
    }
    const merged = <K extends Scalar>(k: K) => (k in plan.scalars ? plan.scalars[k] : product ? product[k] : undefined)
    if (!merged('name')) errors.push(product ? 'Name cannot be empty' : 'Name is required for a new product')
    if (merged('regularPrice') == null) errors.push(product ? 'Regular Price cannot be empty' : 'Regular Price is required for a new product')
    const regular = merged('regularPrice') as number | null | undefined
    const sale = merged('salePrice') as number | null | undefined
    if (regular != null && sale != null && sale >= regular) errors.push('Sale Price must be lower than Regular Price')
    if (merged('onSale') === true && sale == null) errors.push('On Sale is TRUE but Sale Price is empty')

    // Identifiers: SKU and slug must stay unique across the catalogue and the file.
    if (sku) {
      const owner = skuOwner.get(norm(sku))
      const me = product?.id ?? `row:${rowNo}`
      if (owner && owner !== me) errors.push(`SKU "${sku}" is already used by ${owner.startsWith('row:') ? `row ${owner.slice(4)}` : 'another product'}`)
      else { skuOwner.set(norm(sku), me); if (!product || norm(product.sku ?? '') !== norm(sku)) plan.scalars.sku = sku }
    } else if (!product) {
      plan.scalars.sku = `SKU-${randomBytes(4).toString('hex').toUpperCase()}`
    }
    if (!product) {
      plan.scalars.slug = uniqueIn(usedSlugs, slugCell || (merged('name') as string) || 'product')
    } else if (slugCell && slugify(slugCell) !== product.slug) {
      const wanted = slugify(slugCell)
      if (!wanted || usedSlugs.has(wanted)) errors.push(`Slug "${slugCell}" is already used by another product`)
      else { usedSlugs.add(wanted); plan.scalars.slug = wanted }
    }

    // Relations
    if (values.has('category')) {
      const raw = values.get('category') as string | null
      const parts = raw ? raw.split('>').map((s) => s.trim()).filter(Boolean) : []
      if (parts.length > 10) errors.push('Category paths can be at most 10 levels deep')
      plan.category = parts.length ? parts : null
    }
    if (values.has('brand')) plan.brand = values.get('brand') as string | null
    if (values.has('collections')) plan.collections = [...new Set(values.get('collections') as string[])]
    if (values.has('images')) plan.images = (values.get('images') as string[]).map((v) => imageUrl(v, errors)).filter((u): u is string => !!u)
    if (Object.keys(attributes).length) plan.attributes = attributes

    // What changes?
    if (product) {
      for (const [k, v] of Object.entries(plan.scalars)) {
        if (k === 'slug' || k === 'sku' || !same(v, product[k as Scalar])) plan.changes.push(k)
        else delete plan.scalars[k as Scalar]
      }
      if (plan.category !== undefined && norm(plan.category?.join(' > ') ?? '') !== norm(pathOf(catalog.categories, product.categoryId) ?? '')) plan.changes.push('category')
      else delete plan.category
      if (plan.brand !== undefined && norm(plan.brand ?? '') !== norm(product.brand?.name ?? '')) plan.changes.push('brand')
      else delete plan.brand
      if (plan.collections && plan.collections.map(norm).sort().join('|') !== product.collections.map((c) => norm(c.collection.name)).sort().join('|')) plan.changes.push('collections')
      else delete plan.collections
      if (plan.images && plan.images.join('|') !== product.images.map((i) => i.imageUrl).join('|')) plan.changes.push('images')
      else delete plan.images
      if (plan.attributes) {
        const current = parseAttributes(product.attributes)
        for (const [slug, v] of Object.entries(plan.attributes)) {
          if ((current[slug] ?? null) === v) delete plan.attributes[slug]
          else plan.changes.push(`attr:${slug}`)
        }
        if (!Object.keys(plan.attributes).length) delete plan.attributes
      }
      if (!plan.changes.length && !errors.length) plan.action = 'unchanged'
    } else {
      // For new products list only the fields that were actually filled in.
      plan.changes = [
        ...Object.entries(plan.scalars).filter(([k, v]) => v !== null && v !== false && k !== 'slug').map(([k]) => k),
        ...(['category', 'brand', 'collections', 'images'] as const).filter((k) => (Array.isArray(plan[k]) ? plan[k]!.length : plan[k] != null)),
        ...Object.entries(plan.attributes ?? {}).filter(([, v]) => v !== null).map(([slug]) => `attr:${slug}`),
      ]
    }
    if (errors.length) plan.action = 'error'
    rows.push(plan)
  })

  return { columns: header.filter((_, i) => cols[i] || custom[i]), ignoredColumns, newFields, rows }
}

// ─── Import: apply ────────────────────────────────────────────────────────

/** Find-or-create categories, brands and collections referenced by the plan. */
async function resolveTaxonomy(rows: RowPlan[], catalog: Catalog, dryRun: boolean) {
  const created = { categories: [] as string[], brands: [] as string[], collections: [] as string[] }
  const catSlugs = new Set(catalog.categories.map((c) => c.slug))
  const brandSlugs = new Set(catalog.brands.map((b) => b.slug))
  const colSlugs = new Set(catalog.collections.map((c) => c.slug))
  const categories = [...catalog.categories]
  const brands = new Map(catalog.brands.map((b) => [norm(b.name), b.id]))
  const collections = new Map<string, string>()
  for (const c of catalog.collections) { collections.set(norm(c.name), c.id); collections.set(norm(c.slug), c.id) }

  const makeCategory = async (name: string, parent: { id: string; name: string } | null) => {
    const row = { id: `new:${parent?.id ?? ''}/${name}`, name, slug: uniqueIn(catSlugs, name), parentId: parent?.id ?? null }
    if (!dryRun) row.id = (await db.category.create({ data: { name: row.name, slug: row.slug, parentId: row.parentId } })).id
    categories.push(row)
    created.categories.push(pathOf(categories, row.id) ?? name)
    return row
  }

  const categoryIds = new Map<string, string>()
  for (const parts of rows.map((r) => r.category).filter((c): c is string[] => !!c?.length)) {
    const key = norm(parts.join(' > '))
    if (categoryIds.has(key)) continue
    let id: string
    if (parts.length > 1) {
      // Walk the path from the top, creating any missing level.
      let parent: { id: string; name: string } | null = null
      for (const name of parts) {
        const parentId: string | null = parent ? parent.id : null
        const found: { id: string; name: string } | undefined = categories.find((c) => c.parentId === parentId && norm(c.name) === norm(name))
        parent = found ?? await makeCategory(name, parent)
      }
      id = (parent as { id: string }).id
    } else {
      // A single name may be top-level or a sub-category; prefer top-level when ambiguous.
      const matches = categories.filter((c) => norm(c.name) === norm(parts[0]))
      id = (matches.find((c) => !c.parentId) ?? matches[0] ?? await makeCategory(parts[0], null)).id
    }
    categoryIds.set(key, id)
  }

  for (const name of new Set(rows.map((r) => r.brand).filter((b): b is string => !!b))) {
    if (brands.has(norm(name))) continue
    const slug = uniqueIn(brandSlugs, name)
    brands.set(norm(name), dryRun ? `new:${name}` : (await db.brand.create({ data: { name, slug } })).id)
    created.brands.push(name)
  }

  for (const name of new Set(rows.flatMap((r) => r.collections ?? []))) {
    if (collections.has(norm(name))) continue
    const slug = uniqueIn(colSlugs, name)
    collections.set(norm(name), dryRun ? `new:${name}` : (await db.collection.create({ data: { name, slug } })).id)
    created.collections.push(name)
  }

  return {
    created,
    categoryId: (parts: string[]) => categoryIds.get(norm(parts.join(' > '))) ?? null,
    brandId: (name: string) => brands.get(norm(name)) ?? null,
    collectionId: (name: string) => collections.get(norm(name))!,
  }
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run))
}

export async function applyImport(plan: ImportPlan, catalog: Catalog, dryRun: boolean) {
  const writable = plan.rows.filter((r) => r.action === 'create' || r.action === 'update')
  const taxonomy = await resolveTaxonomy(writable, catalog, dryRun)
  // Only fields that some written row actually uses are created.
  const usedFields = new Set(writable.flatMap((r) => Object.keys(r.attributes ?? {})))
  const fieldsToCreate = plan.newFields.filter((f) => usedFields.has(f.slug))
  if (!dryRun && fieldsToCreate.length) {
    const start = catalog.fields.length
    await db.productField.createMany({ data: fieldsToCreate.map((f, i) => ({ ...f, sortOrder: start + i })), skipDuplicates: true })
  }
  const productsById = new Map(catalog.products.map((p) => [p.id, p]))

  if (!dryRun) {
    await inBatches(writable, 6, async (r) => {
      // The planner guarantees types per column (e.g. slug/name are never null).
      const data = { ...r.scalars } as Prisma.ProductUncheckedUpdateInput
      if (r.category !== undefined) data.categoryId = r.category ? taxonomy.categoryId(r.category) : null
      if (r.brand !== undefined) data.brandId = r.brand ? taxonomy.brandId(r.brand) : null
      const name = (r.scalars.name as string | undefined) ?? r.label
      const images = r.images?.map((imageUrl, i) => ({ imageUrl, altText: name, sortOrder: i, isPrimary: i === 0 }))
      const collections = r.collections?.map((n, i) => ({ collectionId: taxonomy.collectionId(n), sortOrder: i }))
      if (r.attributes) {
        const merged: Record<string, string> = r.productId ? parseAttributes(productsById.get(r.productId)?.attributes) : {}
        for (const [slug, v] of Object.entries(r.attributes)) { if (v === null) delete merged[slug]; else merged[slug] = v }
        data.attributes = JSON.stringify(merged)
      }
      try {
        if (r.action === 'create') {
          await db.product.create({
            data: {
              ...(data as Prisma.ProductUncheckedCreateInput),
              images: images ? { create: images } : undefined,
              collections: collections ? { create: collections } : undefined,
            },
          })
        } else {
          await db.product.update({
            where: { id: r.productId },
            data: {
              ...data,
              images: images ? { deleteMany: {}, create: images } : undefined,
              collections: collections ? { deleteMany: {}, create: collections } : undefined,
            },
          })
        }
      } catch (error) {
        r.action = 'error'
        r.errors.push(await failure(error).json().then((b: { error: string }) => b.error))
      }
    })
  }

  const count = (a: RowPlan['action']) => plan.rows.filter((r) => r.action === a).length
  return {
    dryRun,
    columns: plan.columns,
    ignoredColumns: plan.ignoredColumns,
    totals: { rows: plan.rows.length, create: count('create'), update: count('update'), unchanged: count('unchanged'), error: count('error') },
    newTaxonomy: taxonomy.created,
    newFields: fieldsToCreate.map((f) => f.label),
    // Unchanged rows are omitted to keep the response small.
    rows: plan.rows.filter((r) => r.action !== 'unchanged').slice(0, 1000)
      .map(({ row, action, label, changes, errors }) => ({ row, action, label, changes: changes.map(columnHeader), errors })),
  }

  function columnHeader(key: string) {
    if (key.startsWith('attr:')) {
      const slug = key.slice(5)
      return (catalog.fields.find((f) => f.slug === slug) ?? plan.newFields.find((f) => f.slug === slug))?.label ?? slug
    }
    return PRODUCT_COLUMNS.find((c) => c.key === key)?.header ?? key
  }
}
