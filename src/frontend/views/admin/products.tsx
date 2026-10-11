'use client'
// Products section: catalog table with filters + bulk actions, and tabs for categories and brands.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FolderTree, ListPlus, Package, Pencil, Plus, Search, Tag, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Checkbox } from '@/frontend/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import { api } from '@/frontend/lib/api'
import { formatAED, formatNumber } from '@/frontend/lib/format'
import type { Brand, Category, Product } from '@/shared/types'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { CrudSection, type CrudConfig } from './crud-section'
import { ExportButtons, ImportDialog } from './product-transfer'
import { ImageUpload, SectionHeader, Thumb } from './shared'

const ALL = 'all'
const NONE = '__none__'
const PAGE_SIZE = 20

export function ProductsSection() {
  const [tab, setTab] = useState('products')
  // Categories/brands are shared by the product form and filters; the tabs edit them.
  const categories = useAdminList<Category>('/api/admin/categories')
  const brands = useAdminList<Brand>('/api/admin/brands')
  const fields = useAdminList<ProductField>('/api/admin/product-fields')

  return (
    <Tabs value={tab} onValueChange={(t) => { setTab(t); if (t === 'products') { categories.reload(); brands.reload(); fields.reload() } }} className="space-y-4">
      <TabsList>
        <TabsTrigger value="products" className="gap-1.5"><Package className="size-4" /> Products</TabsTrigger>
        <TabsTrigger value="categories" className="gap-1.5"><FolderTree className="size-4" /> Categories</TabsTrigger>
        <TabsTrigger value="brands" className="gap-1.5"><Tag className="size-4" /> Brands</TabsTrigger>
        <TabsTrigger value="fields" className="gap-1.5"><ListPlus className="size-4" /> Custom fields</TabsTrigger>
      </TabsList>
      <TabsContent value="products">
        <ProductCatalog categories={categories.items} brands={brands.items} fields={fields.items} onTaxonomyChanged={() => { categories.reload(); brands.reload(); fields.reload() }} />
      </TabsContent>
      <TabsContent value="categories"><CrudSection config={categoryConfig} /></TabsContent>
      <TabsContent value="brands"><CrudSection config={brandConfig} /></TabsContent>
      <TabsContent value="fields"><CrudSection config={fieldConfig} /></TabsContent>
    </Tabs>
  )
}

// ─── Catalog ──────────────────────────────────────────────────────────────
function ProductCatalog({ categories, brands, fields, onTaxonomyChanged }: { categories: Category[]; brands: Brand[]; fields: ProductField[]; onTaxonomyChanged: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [brand, setBrand] = useState(ALL)
  const [onSale, setOnSale] = useState(false)
  const [featured, setFeatured] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | boolean | undefined> = { page: String(page), page_size: String(PAGE_SIZE), sort: 'newest', full: '1' }
    if (search) params.search = search
    if (category !== ALL) params.category = category
    if (brand !== ALL) params.brand = brand
    if (onSale) params.on_sale = true
    if (featured) params.featured = true
    return api.products(params)
      .then((r) => { setProducts(r.products); setTotal(r.total); setTotalPages(Math.max(r.totalPages, 1)); setSelected(new Set()) })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [page, search, category, brand, onSale, featured])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/filter change; the loading flag flips before the request
  useEffect(() => { load() }, [load])

  const filtersActive = search || category !== ALL || brand !== ALL || onSale || featured
  const clearFilters = () => { setSearchInput(''); setSearch(''); setCategory(ALL); setBrand(ALL); setOnSale(false); setFeatured(false); setPage(1) }

  const remove = async (p: Product) => {
    if (!confirm(`Delete “${p.name}”? Past orders keep their copy of the name and price.`)) return
    try {
      await adminApi.del(`/api/admin/products?id=${encodeURIComponent(p.id)}`)
      toast.success('Product deleted')
      load()
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const bulk = async (label: string, run: (id: string) => Promise<unknown>) => {
    const ids = [...selected]
    setBusy(true)
    const results = await Promise.allSettled(ids.map(run))
    setBusy(false)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${label}: ${failed} of ${ids.length} failed`)
    else toast.success(`${label}: ${ids.length} product${ids.length === 1 ? '' : 's'}`)
    load()
  }
  const bulkUpdate = (label: string, data: Partial<Product>) => bulk(label, (id) => adminApi.put('/api/admin/products', { id, ...data }))
  const bulkDelete = () => {
    if (confirm(`Delete ${selected.size} selected products? This cannot be undone.`)) bulk('Deleted', (id) => adminApi.del(`/api/admin/products?id=${encodeURIComponent(id)}`))
  }

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allSelected = products.length > 0 && selected.size === products.length

  return (
    <div className="space-y-5">
      <SectionHeader title="Products" subtitle={`${formatNumber(total)} ${filtersActive ? 'matching' : 'in catalog'}`}>
        <Button variant="outline" onClick={() => setImporting(true)}><Upload className="size-4" /> Import</Button>
        <ExportButtons />
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => setEditing('new')}><Plus className="size-4" /> Add Product</Button>
      </SectionHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, SKU, description…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.path ?? c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3">
              <Checkbox checked={onSale} onCheckedChange={(v) => { setOnSale(v === true); setPage(1) }} /><span className="text-sm">On sale</span>
            </label>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3">
              <Checkbox checked={featured} onCheckedChange={(v) => { setFeatured(v === true); setPage(1) }} /><span className="text-sm">Featured</span>
            </label>
          </div>
          {filtersActive && <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-teal/5 px-3 py-2 text-sm">
              <span className="mr-auto font-medium text-brand-teal">{selected.size} selected</span>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkUpdate('Featured', { isFeatured: true })}>Feature</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkUpdate('Unfeatured', { isFeatured: false })}>Unfeature</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkUpdate('Marked in stock', { inStock: true })}>In stock</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkUpdate('Marked out of stock', { inStock: false })}>Out of stock</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkUpdate('Sale ended', { onSale: false })}>End sale</Button>
              <Button variant="outline" size="sm" disabled={busy} className="text-red-600" onClick={bulkDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)))} aria-label="Select all" /></TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && products.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No products found.</TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id} className={loading ? 'opacity-60' : ''}>
                  <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></TableCell>
                  <TableCell><Thumb src={p.images?.[0]?.imageUrl} alt={p.name} /></TableCell>
                  <TableCell>
                    <div className="line-clamp-2 max-w-xs font-medium text-brand-ink">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{[p.brand?.name, p.category?.name].filter(Boolean).join(' · ') || '—'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{formatAED(p.onSale && p.salePrice ? p.salePrice : p.regularPrice)}</div>
                    {p.onSale && p.salePrice ? <div className="text-xs text-muted-foreground line-through">{formatAED(p.regularPrice)}</div> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={!p.inStock ? 'text-muted-foreground' : p.stockQty <= 5 ? 'font-medium text-red-600' : ''}>{p.inStock ? p.stockQty : 'Out'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.onSale && <Badge className="border-0 bg-brand-gold text-white">Sale</Badge>}
                      {p.isFeatured && <Badge variant="secondary">Featured</Badge>}
                      {p.isExclusive && <Badge variant="outline">Exclusive</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(p)} aria-label="Edit"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => remove(p)} aria-label="Delete"><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Page {page} of {totalPages} · {formatNumber(total)} total</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /> Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportDialog open={importing} onOpenChange={setImporting} onImported={() => { load(); onTaxonomyChanged() }} />
      <ProductForm product={editing} categories={categories} brands={brands} fields={fields} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  )
}

// ─── Add / edit form ──────────────────────────────────────────────────────
const blankProduct = {
  name: '', nameAr: '', shortDescription: '', description: '', descriptionAr: '', specifications: '', sku: '', barcode: '',
  regularPrice: '', salePrice: '', onSale: false, stockQty: '0', inStock: true, categoryId: '', brandId: '',
  isFeatured: false, isExclusive: false, badge: '', metaTitle: '', metaDescription: '', metaKeywords: '', imageUrl: '',
}
type ProductFormValues = typeof blankProduct

function toFormValues(p: Product): ProductFormValues {
  return {
    name: p.name, nameAr: p.nameAr || '', shortDescription: p.shortDescription || '', description: p.description || '',
    descriptionAr: p.descriptionAr || '', specifications: p.specifications || '', sku: p.sku || '', barcode: p.barcode || '',
    regularPrice: String(p.regularPrice), salePrice: p.salePrice == null ? '' : String(p.salePrice), onSale: p.onSale,
    stockQty: String(p.stockQty), inStock: p.inStock, categoryId: p.categoryId || '', brandId: p.brandId || '',
    isFeatured: p.isFeatured, isExclusive: p.isExclusive, badge: p.badge || '',
    metaTitle: p.metaTitle || '', metaDescription: p.metaDescription || '', metaKeywords: p.metaKeywords || '',
    imageUrl: p.images?.[0]?.imageUrl || '',
  }
}

function ProductForm({ product, categories, brands, fields, onClose, onSaved }: {
  product: Product | 'new' | null
  categories: Category[]
  brands: Brand[]
  fields: ProductField[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProductFormValues>(blankProduct)
  const [attrs, setAttrs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const isNew = product === 'new'

  useEffect(() => {
    if (!product) return
    setForm(product === 'new' ? blankProduct : toFormValues(product))
    setAttrs(product === 'new' ? {} : parseAttrs(product.attributes))
  }, [product])

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setForm((f) => ({ ...f, [key]: value }))
  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c.id, label: c.path ?? c.name })), [categories])

  const submit = async () => {
    if (!form.name.trim() || form.regularPrice === '') { toast.error('Name and regular price are required'); return }
    if (form.onSale && form.salePrice === '') { toast.error('Enter a sale price or untick “On sale”'); return }
    setSaving(true)
    try {
      const payload = { ...form, stockQty: form.stockQty === '' ? 0 : form.stockQty, attributes: attrs }
      if (isNew) await adminApi.post('/api/admin/products', payload)
      else await adminApi.put('/api/admin/products', { id: (product as Product).id, ...payload })
      toast.success(isNew ? 'Product created' : 'Product updated')
      onClose()
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Product' : 'Edit Product'}</DialogTitle>
          <DialogDescription>Saved changes appear on the storefront immediately.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Lightweight Folding Wheelchair" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Name (Arabic)</Label>
            <Input dir="rtl" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Short description</Label>
            <Input value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="One line shown on product cards" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Full description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Description (Arabic)</Label>
            <Textarea dir="rtl" value={form.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} rows={3} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Specifications</Label>
            <Textarea value={form.specifications} onChange={(e) => set('specifications', e.target.value)} rows={4} className="font-mono text-sm" placeholder={'One per line, e.g.\nWeight: 12 kg\nSeat width: 45 cm'} />
          </div>
          <div className="sm:col-span-2"><ImageUpload value={form.imageUrl} onChange={(url) => set('imageUrl', url)} folder="products" label="Main image" /></div>
          <div className="grid gap-2">
            <Label>Regular price (AED) <span className="text-red-500">*</span></Label>
            <Input type="number" min={0} step="0.01" value={form.regularPrice} onChange={(e) => set('regularPrice', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Sale price (AED)</Label>
            <Input type="number" min={0} step="0.01" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} placeholder="Leave empty if not on sale" />
          </div>
          <div className="grid gap-2">
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder={isNew ? 'Generated if empty' : ''} />
          </div>
          <div className="grid gap-2">
            <Label>Stock quantity</Label>
            <Input type="number" min={0} value={form.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={form.categoryId || NONE} onValueChange={(v) => set('categoryId', v === NONE ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No category</SelectItem>
                {categoryOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Brand</Label>
            <Select value={form.brandId || NONE} onValueChange={(v) => set('brandId', v === NONE ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No brand</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="EAN / UPC" />
          </div>
          <div className="grid gap-2">
            <Label>Badge</Label>
            <Input value={form.badge} onChange={(e) => set('badge', e.target.value)} placeholder="e.g. New, Best Seller" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-5">
            {([['onSale', 'On sale'], ['inStock', 'In stock'], ['isFeatured', 'Featured'], ['isExclusive', 'Exclusive']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                {label}<Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
              </label>
            ))}
          </div>
          {fields.length > 0 && (
            <div className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-2">
              <div className="text-sm font-semibold text-brand-ink sm:col-span-2">Custom fields <span className="font-normal text-muted-foreground">— leave empty to hide on the website</span></div>
              {fields.map((f) => (
                <div key={f.id} className="grid gap-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input value={attrs[f.slug] ?? ''} onChange={(e) => setAttrs((a) => ({ ...a, [f.slug]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:col-span-2">
            <Label>SEO title</Label>
            <Input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Defaults to the product name" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>SEO description</Label>
            <Textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>SEO keywords</Label>
            <Input value={form.metaKeywords} onChange={(e) => set('metaKeywords', e.target.value)} placeholder="Comma separated" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={submit} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseAttrs(json?: string): Record<string, string> {
  try { const v = JSON.parse(json || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

// ─── Categories & brands ──────────────────────────────────────────────────
const categoryConfig: CrudConfig<Category> = {
  endpoint: '/api/admin/categories',
  title: 'Categories',
  subtitle: 'Nest categories to any depth; products in a sub-category also show under its parents',
  singular: 'Category',
  activeToggle: true,
  searchText: (c) => c.path ?? c.name,
  deleteWarning: (c) => `Delete “${c.name}”? Its ${c._count?.products ?? 0} products stay in the catalog without a category.`,
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'nameAr', label: 'Arabic name', type: 'text' },
    {
      key: 'parentId', label: 'Parent category', type: 'select', emptyLabel: 'None (top level)',
      options: (all, editing) => all.filter((c) => c.id !== editing?.id && !(editing && c.path?.startsWith(`${editing.path} › `))).map((c) => ({ value: c.id, label: c.path ?? c.name })),
    },
    { key: 'sortOrder', label: 'Display order', type: 'number', min: 0 },
    { key: 'imageUrl', label: 'Image', type: 'image', folder: 'categories' },
    { key: 'isActive', label: 'Visible on website', type: 'switch' },
  ],
  columns: [
    { label: 'Image', className: 'w-16', render: (c) => <Thumb src={c.imageUrl} alt={c.name} /> },
    {
      label: 'Name', render: (c) => (
        <div>
          <div className="font-medium text-brand-ink">{c.path && c.path !== c.name ? <span className="text-muted-foreground">{c.path.slice(0, -c.name.length)}</span> : null}{c.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
        </div>
      ),
    },
    { label: 'Products', className: 'text-right', render: (c) => c._count?.products ?? 0 },
    { label: 'Order', className: 'text-right', render: (c) => c.sortOrder },
  ],
}

interface ProductField { id: string; slug: string; label: string; sortOrder: number; showOnStorefront: boolean }

const fieldConfig: CrudConfig<ProductField> = {
  endpoint: '/api/admin/product-fields',
  title: 'Custom fields',
  subtitle: 'Extra product details. Catalogue imports add a field for every column the store doesn’t know. Empty values are hidden on the website.',
  singular: 'Field',
  searchText: (f) => `${f.label} ${f.slug}`,
  deleteWarning: (f) => `Delete “${f.label}”? It disappears from all products and the website.`,
  fields: [
    { key: 'label', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Country of origin' },
    { key: 'sortOrder', label: 'Display order', type: 'number', min: 0 },
    { key: 'showOnStorefront', label: 'Show on product page', type: 'switch' },
  ],
  columns: [
    { label: 'Name', render: (f) => <div><div className="font-medium text-brand-ink">{f.label}</div><div className="font-mono text-xs text-muted-foreground">{f.slug}</div></div> },
    { label: 'On website', render: (f) => (f.showOnStorefront ? 'Shown' : 'Hidden') },
    { label: 'Order', className: 'text-right', render: (f) => f.sortOrder },
  ],
}

const brandConfig: CrudConfig<Brand> = {
  endpoint: '/api/admin/brands',
  title: 'Brands',
  singular: 'Brand',
  activeToggle: true,
  searchText: (b) => b.name,
  deleteWarning: (b) => `Delete “${b.name}”? Its ${b._count?.products ?? 0} products stay in the catalog without a brand.`,
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'isActive', label: 'Visible on website', type: 'switch' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'logoUrl', label: 'Logo', type: 'image', folder: 'brands' },
  ],
  columns: [
    { label: 'Logo', className: 'w-24', render: (b) => b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="h-10 w-20 object-contain" /> : <Thumb alt={b.name} className="h-10 w-20" /> },
    { label: 'Name', render: (b) => <div><div className="font-medium text-brand-ink">{b.name}</div><div className="font-mono text-xs text-muted-foreground">{b.slug}</div></div> },
    { label: 'Products', className: 'text-right', render: (b) => b._count?.products ?? 0 },
  ],
}
