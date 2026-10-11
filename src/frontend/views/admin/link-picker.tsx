'use client'
// Picks a storefront link in the syntax understood by resolveLink() (src/shared/theme.ts).
import { useEffect, useState } from 'react'
import { Input } from '@/frontend/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { api } from '@/frontend/lib/api'
import { LINK_VIEWS } from '@/shared/theme'
import type { Category } from '@/shared/types'
import { adminApi } from './admin-api'

type Option = { value: string; label: string }
export interface LinkTargets { pages: Option[]; categories: Option[]; brands: Option[]; collections: Option[] }

const EMPTY: LinkTargets = { pages: [], categories: [], brands: [], collections: [] }
let cache: Promise<LinkTargets> | null = null

/** Pages and catalog entries to choose from (loaded once per admin session; `refresh` after edits). */
export function useLinkTargets(refreshKey = 0) {
  const [targets, setTargets] = useState<LinkTargets>(EMPTY)
  useEffect(() => {
    if (refreshKey || !cache) {
      cache = Promise.all([
        adminApi.get<{ slug: string; title: string }[]>('/api/admin/pages').catch(() => []),
        api.categories().catch(() => []),
        api.brands().catch(() => []),
        api.collections().catch(() => []),
      ]).then(([pages, categories, brands, collections]) => ({
        pages: pages.map((p) => ({ value: p.slug, label: p.title })),
        categories: flattenCategories(categories),
        brands: brands.map((b) => ({ value: b.slug, label: b.name })),
        collections: collections.map((c) => ({ value: c.slug, label: c.name })),
      }))
    }
    let cancelled = false
    cache.then((t) => { if (!cancelled) setTargets(t) })
    return () => { cancelled = true }
  }, [refreshKey])
  return targets
}

function flattenCategories(tree: Category[], depth = 0): Option[] {
  return tree.flatMap((c) => [{ value: c.slug, label: `${'— '.repeat(depth)}${c.name}` }, ...flattenCategories(c.children ?? [], depth + 1)])
}

const TYPES = [
  { value: 'view', label: 'Store page' },
  { value: 'page', label: 'Custom page' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'collection', label: 'Collection' },
  { value: 'product', label: 'Product (slug)' },
  { value: 'blog', label: 'Blog post (slug)' },
  { value: 'mega', label: 'Catalog dropdown' },
  { value: 'url', label: 'Web address' },
  { value: 'none', label: 'No link (column heading)' },
]

function split(link: string): [string, string] {
  if (!link) return ['none', '']
  if (/^(https?:|mailto:|tel:|\/)/i.test(link)) return ['url', link]
  const i = link.indexOf(':')
  return i > 0 ? [link.slice(0, i), link.slice(i + 1)] : ['url', link]
}

export function LinkPicker({ value, onChange, targets, allowMega = false, allowNone = false }: {
  value: string
  onChange: (link: string) => void
  targets: LinkTargets
  allowMega?: boolean
  allowNone?: boolean
}) {
  const [type, arg] = split(value)
  const setType = (t: string) => {
    if (t === 'none') onChange('')
    else if (t === 'url') onChange('https://')
    else if (t === 'view') onChange('view:home')
    else if (t === 'mega') onChange('mega:categories')
    else onChange(`${t}:`)
  }
  const options: Option[] | null =
    type === 'view' ? LINK_VIEWS.map((v) => ({ value: v.view, label: v.label }))
    : type === 'page' ? targets.pages
    : type === 'category' ? targets.categories
    : type === 'brand' ? targets.brands
    : type === 'collection' ? targets.collections
    : type === 'mega' ? [{ value: 'categories', label: 'All categories' }, { value: 'brands', label: 'All brands' }, { value: 'collections', label: 'All collections' }]
    : null

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          {TYPES.filter((t) => (t.value !== 'mega' || allowMega) && (t.value !== 'none' || allowNone)).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {type === 'none' ? null : options ? (
        <Select value={arg || undefined} onValueChange={(v) => onChange(`${type}:${v}`)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={options.length ? 'Choose…' : 'Nothing to choose yet'} /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="flex-1"
          value={type === 'url' ? value : arg}
          onChange={(e) => onChange(type === 'url' ? e.target.value : `${type}:${e.target.value}`)}
          placeholder={type === 'url' ? 'https://… or /path' : 'slug'}
        />
      )}
    </div>
  )
}
