'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  SlidersHorizontal, X, Home, Tag, Layers, Search as SearchIcon, Percent,
  ChevronLeft, ChevronRight, Check, PackageSearch,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { ProductCard } from '@/components/product/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from '@/components/ui/sheet'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'
import type { Product, Category, Brand, Collection } from '@/types'

type SortKey = 'featured' | 'price_asc' | 'price_desc' | 'rating' | 'newest'

interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  totalPages: number
}

const PAGE_SIZE = 12

export function ProductsView() {
  const { view, params, navigate } = useStore()

  // Context derivation from view + params
  const context = useMemo(() => deriveContext(view, params), [view, params])

  // Filter state
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState<'all' | 'in_stock'>('all')
  const [onSaleOnly, setOnSaleOnly] = useState<boolean>(false)
  const [sort, setSort] = useState<SortKey>('featured')
  const [page, setPage] = useState<number>(1)

  // Data
  const [brands, setBrands] = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [data, setData] = useState<ProductListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Fetch taxonomy once
  useEffect(() => {
    Promise.all([api.brands(), api.categories(), api.collections()])
      .then(([b, c, col]) => {
        setBrands(b)
        setCategories(c)
        setCollections(col)
      })
      .catch(() => {})
  }, [])

  // Reset filters + page when the top-level context (view/params) changes.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional filter reset on context change */
    setSelectedBrands([])
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly('all')
    setOnSaleOnly(view === 'offers')
    setSort('featured')
    setPage(1)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [view, params.categorySlug, params.brandSlug, params.collectionSlug, params.query, params.onSale])

  const buildQuery = useCallback(() => {
    const q: Record<string, string | boolean | undefined> = {
      page: String(page),
      page_size: String(PAGE_SIZE),
      sort,
    }
    if (context.categorySlug) q.category = context.categorySlug
    if (context.brandSlug) q.brand = context.brandSlug
    if (context.collectionSlug) q.collection = context.collectionSlug
    if (context.search) q.search = context.search
    if (context.onSale) q.on_sale = true
    if (onSaleOnly) q.on_sale = true
    if (inStockOnly === 'in_stock') q.in_stock = true
    if (minPrice) q.min_price = minPrice
    if (maxPrice) q.max_price = maxPrice
    // Multi-brand filter: if selectedBrands is non-empty and we're not already
    // on a brand-scoped view, fetch by first brand (API supports single slug).
    // We then post-filter client-side for additional brands.
    if (selectedBrands.length > 0 && !context.brandSlug) {
      q.brand = selectedBrands[0]
    }
    return q
  }, [page, sort, context, onSaleOnly, inStockOnly, minPrice, maxPrice, selectedBrands])

  // Fetch products whenever filters/sort/page/context change.
  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- loading state must flip before async fetch */
    setLoading(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    api
      .products(buildQuery())
      .then((res) => {
        if (!active) return
        // client-side multi-brand filtering when more than one brand is selected
        let products = res.products
        if (selectedBrands.length > 1 && !context.brandSlug) {
          const allowed = new Set(selectedBrands)
          products = products.filter(
            (p) => p.brand && allowed.has(p.brand.slug)
          )
        }
        setData({ ...res, products })
      })
      .catch(() => {
        if (active) setData({ products: [], total: 0, page: 1, totalPages: 0 })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [buildQuery, selectedBrands, context.brandSlug])

  // Reset page to 1 when filters change.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- page reset on filter change */
    setPage(1)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedBrands, minPrice, maxPrice, inStockOnly, onSaleOnly, sort])

  const toggleBrand = (slug: string) => {
    setSelectedBrands((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const clearAll = () => {
    setSelectedBrands([])
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly('all')
    setOnSaleOnly(view === 'offers')
    setSort('featured')
  }

  const totalActiveFilters =
    selectedBrands.length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (inStockOnly === 'in_stock' ? 1 : 0) +
    (onSaleOnly && view !== 'offers' ? 1 : 0)

  const subcategories = useMemo(() => {
    if (!context.categorySlug) return []
    const parent = categories.find((c) => c.slug === context.categorySlug)
    if (!parent) return []
    return categories.filter((c) => c.parentId === parent.id)
  }, [categories, context.categorySlug])

  // Resolve a human-friendly display title from fetched taxonomy data
  const displayTitle = useMemo(() => {
    if (context.categorySlug) {
      const cat = categories.find((c) => c.slug === context.categorySlug)
      if (cat) return cat.name
    }
    if (context.brandSlug) {
      const brand = brands.find((b) => b.slug === context.brandSlug)
      if (brand) return brand.name
    }
    if (context.collectionSlug) {
      const col = collections.find((c) => c.slug === context.collectionSlug)
      if (col) return col.name
    }
    return context.title
  }, [context, categories, brands, collections])

  const displayContext = useMemo(() => ({ ...context, title: displayTitle }), [context, displayTitle])

  const start = data && data.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const end = data ? Math.min(page * PAGE_SIZE, data.total) : 0

  return (
    <div className="bg-brand-bg min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink
                  asChild
                  className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-brand-teal"
                >
                  <span onClick={() => navigate('home')}>
                    <Home size={12} /> Home
                  </span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {context.parentLabel && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span
                      onClick={() => navigate(context.parentView as any)}
                      className="cursor-pointer text-muted-foreground hover:text-brand-teal"
                    >
                      {context.parentLabel}
                    </span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium text-brand-ink">
                  {displayTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Page header (banner) */}
      <PageHeader context={displayContext} subcategories={subcategories} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar — desktop */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">
              <FilterPanel
                brands={brands}
                selectedBrands={selectedBrands}
                onToggleBrand={toggleBrand}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onMinPrice={setMinPrice}
                onMaxPrice={setMaxPrice}
                inStockOnly={inStockOnly}
                onInStock={setInStockOnly}
                onSaleOnly={onSaleOnly}
                onOnSale={setOnSaleOnly}
                onClear={clearAll}
                activeCount={totalActiveFilters}
                disableBrandFilter={!!context.brandSlug}
              />
            </div>
          </aside>

          {/* Main */}
          <section className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
              <div className="flex items-center gap-3">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal size={14} /> Filters
                      {totalActiveFilters > 0 && (
                        <span className="ml-1 rounded-full bg-brand-teal px-1.5 text-[10px] text-white">
                          {totalActiveFilters}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
                    <SheetHeader className="border-b">
                      <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal size={16} /> Filters
                      </SheetTitle>
                    </SheetHeader>
                    <div className="p-4">
                      <FilterPanel
                        brands={brands}
                        selectedBrands={selectedBrands}
                        onToggleBrand={toggleBrand}
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        onMinPrice={setMinPrice}
                        onMaxPrice={setMaxPrice}
                        inStockOnly={inStockOnly}
                        onInStock={setInStockOnly}
                        onSaleOnly={onSaleOnly}
                        onOnSale={setOnSaleOnly}
                        onClear={clearAll}
                        activeCount={totalActiveFilters}
                        disableBrandFilter={!!context.brandSlug}
                      />
                    </div>
                    <div className="border-t p-3">
                      <SheetClose asChild>
                        <Button className="w-full bg-brand-teal hover:bg-brand-teal-dark">
                          Show Results
                        </Button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>

                <p className="text-sm text-muted-foreground">
                  {loading ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : (
                    <>
                      Showing <span className="font-semibold text-brand-ink">{start}</span>
                      –<span className="font-semibold text-brand-ink">{end}</span> of{' '}
                      <span className="font-semibold text-brand-ink">{data?.total ?? 0}</span> products
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">Sort by:</span>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger size="sm" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active filter chips */}
            {totalActiveFilters > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {selectedBrands.map((slug) => {
                  const b = brands.find((x) => x.slug === slug)
                  if (!b) return null
                  return (
                    <button
                      key={slug}
                      onClick={() => toggleBrand(slug)}
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-brand-ink shadow-sm ring-1 ring-border hover:ring-brand-teal"
                    >
                      {b.name}
                      <X size={10} />
                    </button>
                  )
                })}
                {minPrice && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-brand-ink shadow-sm ring-1 ring-border">
                    Min: {minPrice} AED
                  </span>
                )}
                {maxPrice && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-brand-ink shadow-sm ring-1 ring-border">
                    Max: {maxPrice} AED
                  </span>
                )}
                {inStockOnly === 'in_stock' && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-brand-ink shadow-sm ring-1 ring-border">
                    In Stock
                  </span>
                )}
                {onSaleOnly && view !== 'offers' && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-brand-ink shadow-sm ring-1 ring-border">
                    On Sale
                  </span>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-brand-teal hover:underline"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : data && data.products.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {data.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <EmptyState onClear={clearAll} />
            )}

            {/* Pagination */}
            {!loading && data && data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                {buildPageList(page, data.totalPages).map((p, idx) =>
                  p === '…' ? (
                    <span key={`gap-${idx}`} className="px-2 text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => {
                        setPage(p as number)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={cn(
                        'flex h-8 min-w-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
                        p === page
                          ? 'bg-brand-teal text-white'
                          : 'bg-white text-brand-ink ring-1 ring-border hover:ring-brand-teal'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(data.totalPages, p + 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/* -------------------- helpers -------------------- */

interface ViewContext {
  title: string
  subtitle?: string
  bannerImage?: string | null
  logoUrl?: string | null
  description?: string | null
  categorySlug?: string
  brandSlug?: string
  collectionSlug?: string
  search?: string
  onSale?: boolean
  parentLabel?: string
  parentView?: string
  icon: React.ReactNode
}

function deriveContext(
  view: string,
  params: Record<string, string | boolean | undefined>
): ViewContext {
  switch (view) {
    case 'products-category':
      return {
        title: String(params.categoryName ?? params.categorySlug ?? 'Category'),
        categorySlug: String(params.categorySlug ?? ''),
        parentLabel: 'Categories',
        parentView: 'products',
        icon: <Tag size={14} />,
        bannerImage: null,
      }
    case 'products-brand':
      return {
        title: String(params.brandName ?? params.brandSlug ?? 'Brand'),
        brandSlug: String(params.brandSlug ?? ''),
        parentLabel: 'Brands',
        parentView: 'products',
        icon: <Tag size={14} />,
        logoUrl: null,
        description: null,
      }
    case 'products-collection':
      return {
        title: String(params.collectionName ?? params.collectionSlug ?? 'Collection'),
        collectionSlug: String(params.collectionSlug ?? ''),
        parentLabel: 'Collections',
        parentView: 'products',
        icon: <Layers size={14} />,
        bannerImage: null,
        description: null,
      }
    case 'products-search':
      return {
        title: `Search results for “${params.query ?? ''}”`,
        search: String(params.query ?? ''),
        parentLabel: 'Search',
        parentView: 'products',
        icon: <SearchIcon size={14} />,
      }
    case 'offers':
      return {
        title: 'Special Offers',
        subtitle: 'Limited-time deals on premium medical equipment',
        onSale: true,
        parentLabel: 'Offers',
        parentView: 'products',
        icon: <Percent size={14} />,
      }
    case 'products':
    default:
      return {
        title: 'All Products',
        subtitle: 'Browse our full catalog of medical equipment',
        parentLabel: undefined,
        parentView: 'products',
        icon: <Tag size={14} />,
      }
  }
}

function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push('…')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

/* -------------------- subcomponents -------------------- */

function PageHeader({
  context,
  subcategories,
}: {
  context: ViewContext
  subcategories: Category[]
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white">
      {/* Decorative overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-cyan blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-brand-gold blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-cyan">
              {context.icon}
              <span>{context.parentLabel ?? 'Catalog'}</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
              {context.title}
            </h1>
            {context.subtitle && (
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                {context.subtitle}
              </p>
            )}
            {context.description && (
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                {context.description}
              </p>
            )}
          </div>

          {context.logoUrl && (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white p-3 shadow-lg">
              <img
                src={context.logoUrl}
                alt={context.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Subcategory pills */}
        {subcategories.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <SubcategoryPill
              active={!subcategories.find((s) => s.slug === (context.categorySlug))}
              onClick={() => {}}
              label="All"
            />
            {subcategories.map((sub) => (
              <SubcategoryPill key={sub.id} label={sub.name} onClick={() => {}} active={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SubcategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-white text-brand-teal-dark'
          : 'bg-white/10 text-white hover:bg-white/20'
      )}
    >
      {label}
    </button>
  )
}

function FilterPanel({
  brands,
  selectedBrands,
  onToggleBrand,
  minPrice,
  maxPrice,
  onMinPrice,
  onMaxPrice,
  inStockOnly,
  onInStock,
  onSaleOnly,
  onOnSale,
  onClear,
  activeCount,
  disableBrandFilter,
}: {
  brands: Brand[]
  selectedBrands: string[]
  onToggleBrand: (slug: string) => void
  minPrice: string
  maxPrice: string
  onMinPrice: (v: string) => void
  onMaxPrice: (v: string) => void
  inStockOnly: 'all' | 'in_stock'
  onInStock: (v: 'all' | 'in_stock') => void
  onSaleOnly: boolean
  onOnSale: (v: boolean) => void
  onClear: () => void
  activeCount: number
  disableBrandFilter: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-ink">
          Filters
        </h3>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-brand-teal hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Brands */}
      {!disableBrandFilter && (
        <FilterSection title="Brands">
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {brands.length === 0 ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              brands.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink hover:text-brand-teal"
                >
                  <Checkbox
                    checked={selectedBrands.includes(b.slug)}
                    onCheckedChange={() => onToggleBrand(b.slug)}
                  />
                  <span className="flex-1">{b.name}</span>
                  {b._count && (
                    <span className="text-xs text-muted-foreground">
                      {b._count.products}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </FilterSection>
      )}

      {/* Price */}
      <FilterSection title="Price (AED)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={minPrice}
            onChange={(e) => onMinPrice(e.target.value)}
            className="h-8 text-xs"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => onMaxPrice(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </FilterSection>

      {/* Availability */}
      <FilterSection title="Availability">
        <RadioGroup
          value={inStockOnly}
          onValueChange={(v) => onInStock(v as 'all' | 'in_stock')}
          className="gap-2"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink">
            <RadioGroupItem value="all" id="r-all" />
            <Label htmlFor="r-all" className="cursor-pointer font-normal">
              All products
            </Label>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink">
            <RadioGroupItem value="in_stock" id="r-stock" />
            <Label htmlFor="r-stock" className="cursor-pointer font-normal">
              In stock only
            </Label>
          </label>
        </RadioGroup>
      </FilterSection>

      {/* On Sale */}
      <FilterSection title="Promotions">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink">
          <Checkbox
            checked={onSaleOnly}
            onCheckedChange={(v) => onOnSale(v === true)}
          />
          <span className="flex items-center gap-1">
            <Percent size={12} className="text-brand-gold" /> On sale only
          </span>
        </label>
      </FilterSection>
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-border pt-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <PackageSearch size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-brand-ink">No products found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try adjusting your filters or browsing another category.
      </p>
      <Button
        onClick={onClear}
        variant="outline"
        className="mt-4 border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
      >
        <Check size={14} /> Clear filters
      </Button>
    </div>
  )
}
