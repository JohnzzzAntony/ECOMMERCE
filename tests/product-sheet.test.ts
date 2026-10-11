// Catalogue import planning: matching, overwrite semantics, validation. No database writes.
import { expect, test } from 'bun:test'
import { exportColumns, exportRows, planImport, type Catalog } from '../src/backend/lib/product-sheet'
import { parseCsv } from '../src/backend/lib/spreadsheet'

const now = new Date('2026-01-01T00:00:00Z')
const product = (over: Record<string, unknown>) => ({
  id: 'p1', slug: 'chair', name: 'Chair', nameAr: null, description: 'Old desc', descriptionAr: null, shortDescription: null,
  specifications: null, sku: 'SKU-1', barcode: null, regularPrice: 100, salePrice: null, onSale: false, stockQty: 5, inStock: true,
  categoryId: 'c2', brandId: 'b1', isFeatured: false, isExclusive: false, badge: null, metaTitle: null, metaDescription: null,
  metaKeywords: null, ratingAvg: 4.5, ratingCount: 2, createdAt: now, updatedAt: now, attributes: '{"country-of-origin":"Germany"}',
  images: [{ id: 'i1', productId: 'p1', imageUrl: 'https://img/1.jpg', altText: null, sortOrder: 0, isPrimary: true }],
  category: { id: 'c2', name: 'Active', slug: 'active', parentId: 'c1', parent: { id: 'c1', name: 'Wheelchairs' } },
  brand: { id: 'b1', name: 'Ottobock' },
  collections: [{ collection: { id: 'k1', name: 'Featured', slug: 'featured' } }],
  ...over,
})
const catalog = {
  products: [product({}), product({ id: 'p2', slug: 'bed', name: 'Bed', sku: 'SKU-2', images: [], collections: [] })],
  categories: [{ id: 'c1', name: 'Wheelchairs', slug: 'wheelchairs', parentId: null }, { id: 'c2', name: 'Active', slug: 'active', parentId: 'c1' }],
  brands: [{ id: 'b1', name: 'Ottobock', slug: 'ottobock' }],
  collections: [{ id: 'k1', name: 'Featured', slug: 'featured' }],
  fields: [{ id: 'f1', slug: 'country-of-origin', label: 'Country of Origin' }],
} as unknown as Catalog

const headers = exportColumns(catalog).map((c) => c.header)
const exported = () => [headers, ...exportRows(catalog).map((r) => r.map((v) => (v === null ? '' : String(v))))]

test('re-importing an unedited export changes nothing', () => {
  const plan = planImport(exported(), catalog)
  expect(plan.rows.map((r) => r.action)).toEqual(['unchanged', 'unchanged'])
  expect(plan.ignoredColumns).toEqual([])
})

test('edited export updates the matched product in place (no duplicate)', () => {
  const grid = exported()
  const col = (h: string) => headers.indexOf(h)
  grid[1][col('Regular Price')] = '150'
  grid[1][col('Description')] = ''
  grid[1][col('Category')] = 'Wheelchairs > Electric'
  const [row] = planImport(grid, catalog).rows
  expect(row).toMatchObject({ action: 'update', productId: 'p1' })
  expect(row.scalars).toEqual({ regularPrice: 150, description: null })
  expect(row.category).toEqual(['Wheelchairs', 'Electric'])
  expect(row.changes.sort()).toEqual(['category', 'description', 'regularPrice'])
})

test('customer sheet: matches by SKU, creates new rows, leaves missing columns alone', () => {
  const grid = parseCsv('Product Name,SKU,Price,Qty,Brand,Image\r\nChair,sku-1,100,9,,\r\nWalker,W-9,"1,250",3,NewCo,https://img/w.jpg | https://img/w2.jpg\r\n')
  const [update, create] = planImport(grid, catalog).rows
  expect(update).toMatchObject({ action: 'update', productId: 'p1' })
  expect(update.scalars).toEqual({ stockQty: 9 }) // description etc. untouched: no column
  expect(update.brand).toBeNull() // blank Brand cell clears it
  expect(create).toMatchObject({ action: 'create', label: 'Walker' })
  expect(create.scalars).toMatchObject({ name: 'Walker', sku: 'W-9', regularPrice: 1250, stockQty: 3, slug: 'walker' })
  expect(create.images).toEqual(['https://img/w.jpg', 'https://img/w2.jpg'])
})

test('reports row errors instead of guessing', () => {
  const grid = [
    ['ID', 'SKU', 'Name', 'Regular Price', 'Sale Price', 'On Sale', 'Featured'],
    ['nope', '', 'Ghost', '10', '', '', ''],
    ['', 'SKU-1', 'Chair', '100', '120', '', ''],
    ['', 'SKU-2', 'Bed', 'abc', '', '', 'maybe'],
    ['', 'NEW-1', 'Thing', '', '', 'TRUE', ''],
    ['p1', '', '', '100', '', '', ''],
    ['p1', '', 'Chair again', '100', '', '', ''],
    ['', 'SKU-2', 'Bed', '50', '', '', ''],
    ['', 'SKU-2', 'Bed', '60', '', '', ''],
  ]
  const errs = planImport(grid, catalog).rows.map((r) => r.errors.join('; '))
  expect(errs[0]).toContain('No product has ID')
  expect(errs[1]).toContain('Sale Price must be lower')
  expect(errs[2]).toContain('Regular Price "abc"')
  expect(errs[2]).toContain('Featured must be TRUE or FALSE')
  expect(errs[3]).toContain('Regular Price is required')
  expect(errs[3]).toContain('On Sale is TRUE but Sale Price is empty')
  expect(errs[4]).toContain('Name cannot be empty')
  expect(errs[5]).toContain('Same product as row')
  expect(errs[7]).toContain('Same product as row')
})

test('requires an identifier column', () => {
  expect(() => planImport([['Price', 'Stock'], ['1', '2']], catalog)).toThrow('at least one of: ID, SKU, Slug or Name')
})

test('CSV parser handles quotes, newlines, semicolons and BOM', () => {
  expect(parseCsv('﻿a,b\r\n"x, y","line1\nline2"\r\n"he said ""hi""",')).toEqual([['a', 'b'], ['x, y', 'line1\nline2'], ['he said "hi"', '']])
  expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
})

test('rows without ID/SKU match an existing product by exact name, and repeated new names are flagged', () => {
  const plan = planImport([['Name', 'Regular Price'], ['Chair', '100'], ['Walker', '10'], ['walker', '12']], catalog)
  expect(plan.rows[0]).toMatchObject({ action: 'unchanged', productId: 'p1' })
  expect(plan.rows[1]).toMatchObject({ action: 'create' })
  expect(plan.rows[2].errors[0]).toContain('Same new product as row 3')
})

test('unknown columns become custom fields; values are saved, empty cells are fine', () => {
  const grid = [
    ['SKU', 'Name', 'Regular Price', 'Country of Origin', 'Warranty', 'Material'],
    ['SKU-1', 'Chair', '100', 'Japan', '2 years', ''],
    ['NEW-1', 'Stool', '50', '', '', 'Oak'],
  ]
  const plan = planImport(grid, catalog)
  expect(plan.ignoredColumns).toEqual([])
  expect(plan.newFields).toEqual([{ slug: 'warranty', label: 'Warranty' }, { slug: 'material', label: 'Material' }])
  const [update, create] = plan.rows
  expect(update.errors).toEqual([])
  expect(update.attributes).toEqual({ 'country-of-origin': 'Japan', warranty: '2 years' }) // Material unchanged (was empty)
  expect(update.changes.sort()).toEqual(['attr:country-of-origin', 'attr:warranty'])
  expect(create.errors).toEqual([])
  expect(create.attributes).toEqual({ 'country-of-origin': null, warranty: null, material: 'Oak' })
  expect(create.changes).toContain('attr:material')
})

test('exported custom field round-trips unchanged; deep category paths and Excel text markers are accepted', () => {
  expect(headers).toContain('Country of Origin')
  expect(exported()[1][headers.indexOf('Country of Origin')]).toBe('Germany')
  expect(exported()[1][headers.indexOf('Category')]).toBe('Wheelchairs > Active')
  const grid = [
    ['SKU', 'Name', 'Regular Price', 'Category', 'SEO Description'],
    ["'402306", 'Oud 50ml', '810.00', 'Health & Beauty > Personal Care > Cosmetics > Perfumes & Colognes > Eaux de Parfum', 'x'.repeat(3000)],
  ]
  const [row] = planImport(grid, catalog).rows
  expect(row.errors).toEqual([])
  expect(row.scalars.sku).toBe('402306')
  expect(row.category).toHaveLength(5)
})
