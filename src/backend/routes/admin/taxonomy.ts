// Admin CRUD for product categories and brands. Deleting one un-links its products (onDelete: SetNull).
import { db } from '@/backend/lib/db'
import { adminResource } from '@/backend/lib/admin-resource'
import { HttpError } from '@/backend/lib/auth'

export const categories = adminResource({
  model: db.category,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  include: { parent: { select: { id: true, name: true } }, _count: { select: { products: true, children: true } } },
  slugFrom: 'name',
  // Full "Parent > Child > Leaf" path for labels and sorting in the admin.
  list: (items: { id: string; name: string; parentId: string | null }[]) => {
    const byId = new Map(items.map((c) => [c.id, c]))
    const path = (c: { name: string; parentId: string | null }, hops = 0): string => {
      const parent = c.parentId ? byId.get(c.parentId) : undefined
      return parent && hops < 20 ? `${path(parent, hops + 1)} › ${c.name}` : c.name
    }
    return items.map((c) => ({ ...c, path: path(c) })).sort((a, b) => a.path.localeCompare(b.path))
  },
  fields: {
    name: { type: 'text', required: true, max: 120 },
    nameAr: { type: 'text', max: 120 },
    imageUrl: { type: 'text', max: 1000 },
    icon: { type: 'text', max: 60 },
    parentId: { type: 'ref' },
    sortOrder: { type: 'int', min: 0, max: 100000 },
    isActive: { type: 'bool' },
  },
  // Categories nest to any depth; a category cannot be placed under itself or its own descendants.
  validate: async (data, id) => {
    if (typeof data.parentId !== 'string') return
    if (data.parentId === id) throw new HttpError(400, 'A category cannot be its own parent')
    const all = await db.category.findMany({ select: { id: true, parentId: true } })
    const parentOf = new Map(all.map((c) => [c.id, c.parentId]))
    if (!parentOf.has(data.parentId)) throw new HttpError(400, 'Parent category not found')
    for (let at: string | null | undefined = data.parentId, hops = 0; at && hops < 100; at = parentOf.get(at), hops++) {
      if (at === id) throw new HttpError(400, 'A category cannot be moved under one of its own sub-categories')
    }
  },
})

export const brands = adminResource({
  model: db.brand,
  orderBy: { name: 'asc' },
  include: { _count: { select: { products: true } } },
  slugFrom: 'name',
  fields: {
    name: { type: 'text', required: true, max: 120 },
    logoUrl: { type: 'text', max: 1000 },
    description: { type: 'text', max: 2000 },
    isActive: { type: 'bool' },
  },
})

// Custom product fields (also created automatically by catalogue import). Values: Product.attributes[slug].
export const productFields = adminResource({
  model: db.productField,
  orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  slugFrom: 'label',
  fields: {
    label: { type: 'text', required: true, max: 120 },
    sortOrder: { type: 'int', min: 0, max: 100000 },
    showOnStorefront: { type: 'bool' },
  },
})
